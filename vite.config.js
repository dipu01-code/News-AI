import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.message || value.error || JSON.stringify(value);
  return String(value);
}

function fallbackAnswer() {
  return "I can only answer from the current dashboard data. Try asking about the ISS latitude, longitude, speed, nearest location, astronauts in space, or loaded news articles.";
}

function answerFromDashboard(question, dashboardData) {
  const ask = question.toLowerCase();
  const iss = dashboardData?.iss || {};
  const astronauts = dashboardData?.astronauts || {};
  const news = dashboardData?.news || [];
  const mentionsDelhi = ask.includes("delhi");
  const mentionsSingapore = ask.includes("singapore");

  if (
    ask.includes("longitude") ||
    ask.includes("longitube") ||
    ask.includes("ongitube") ||
    ask.includes("lng") ||
    ask.includes("long ")
  ) {
    if (mentionsDelhi || (mentionsSingapore && !iss.currentLocation?.toLowerCase().includes("singapore"))) {
      return fallbackAnswer();
    }
    return iss.longitude === undefined
      ? "I can only answer from the current dashboard data."
      : `The current ISS longitude shown on the dashboard is ${iss.longitude}.`;
  }

  if (ask.includes("latitude")) {
    if (mentionsDelhi || (mentionsSingapore && !iss.currentLocation?.toLowerCase().includes("singapore"))) {
      return fallbackAnswer();
    }
    return iss.latitude === undefined
      ? "I can only answer from the current dashboard data."
      : `The current ISS latitude shown on the dashboard is ${iss.latitude}.`;
  }

  if (ask.includes("speed")) {
    return iss.speedKmh === undefined
      ? "I can only answer from the current dashboard data."
      : `The current ISS speed shown on the dashboard is ${Math.round(iss.speedKmh).toLocaleString()} km/h.`;
  }

  if (ask.includes("location") || ask.includes("where") || ask.includes("place")) {
    return iss.currentLocation
      ? `The ISS is currently nearest to ${iss.currentLocation}.`
      : "I can only answer from the current dashboard data.";
  }

  if (ask.includes("astronaut") || ask.includes("people") || ask.includes("space")) {
    const names = astronauts.names?.length ? ` Names: ${astronauts.names.join(", ")}.` : "";
    return `There are ${astronauts.total || 0} people in space right now.${names}`;
  }

  if (ask.includes("article") || ask.includes("news")) {
    if (!news.length) return "There are no news articles loaded in the dashboard data right now.";
    const categories = news.reduce((counts, article) => {
      counts[article.category] = (counts[article.category] || 0) + 1;
      return counts;
    }, {});
    const breakdown = Object.entries(categories)
      .map(([category, count]) => `${category}: ${count}`)
      .join(", ");
    return `There are ${news.length} news articles loaded. Category breakdown: ${breakdown}.`;
  }

  return "";
}

function sendJson(response, status, data) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function devApiPlugin(env) {
  return {
    name: "orbitwire-dev-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, "http://localhost");

        try {
          if (url.pathname === "/api/iss-now") {
            const upstream = await fetch("http://api.open-notify.org/iss-now.json");
            return sendJson(response, upstream.status, await upstream.json());
          }

          if (url.pathname === "/api/astros") {
            const upstream = await fetch("http://api.open-notify.org/astros.json");
            return sendJson(response, upstream.status, await upstream.json());
          }

          if (url.pathname === "/api/news") {
            const category = url.searchParams.get("category") || "science";
            const apiKey = env.VITE_GNEWS_API_KEY;
            if (!apiKey) return sendJson(response, 500, { message: "Missing GNews API key." });

            const params = new URLSearchParams({
              category,
              lang: "en",
              country: "us",
              max: "10",
              apikey: apiKey
            });
            const upstream = await fetch(`https://gnews.io/api/v4/top-headlines?${params}`);
            return sendJson(response, upstream.status, await upstream.json());
          }

          if (url.pathname === "/api/chat" && request.method === "POST") {
            const { question, dashboardData } = await readBody(request);
            const directAnswer = answerFromDashboard(question, dashboardData);
            if (directAnswer) return sendJson(response, 200, { answer: directAnswer });

            const token = env.VITE_AI_TOKEN;
            if (!token) return sendJson(response, 500, { message: "Missing Hugging Face token." });

            const upstream = await fetch("https://router.huggingface.co/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: HF_MODEL,
                stream: false,
                max_tokens: 220,
                temperature: 0.2,
                messages: [
                  {
                    role: "system",
                    content:
                      'You are the OrbitWire dashboard assistant. Answer only from the DASHBOARD_DATA JSON. If the answer is not present, say: "I can only answer from the current dashboard data." Do not use outside knowledge. Keep answers brief.'
                  },
                  {
                    role: "user",
                    content: `DASHBOARD_DATA:\n${JSON.stringify(dashboardData).slice(0, 12000)}\n\nQUESTION:\n${question}`
                  }
                ]
              })
            });
            const data = await upstream.json();
            if (!upstream.ok) {
              const message = textFrom(data.error) || textFrom(data.message);
              return sendJson(response, 200, {
                answer: message.includes("not supported by any provider")
                  ? fallbackAnswer()
                  : `I can only answer from the current dashboard data. ${message || ""}`.trim()
              });
            }
            return sendJson(response, 200, {
              answer:
                data.choices?.[0]?.message?.content?.trim() ||
                "I can only answer from the current dashboard data."
            });
          }
        } catch (error) {
          return sendJson(response, 500, { message: error.message });
        }

        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), devApiPlugin(env)]
  };
});
