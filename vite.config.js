import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";

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
              max: "5",
              apikey: apiKey
            });
            const upstream = await fetch(`https://gnews.io/api/v4/top-headlines?${params}`);
            return sendJson(response, upstream.status, await upstream.json());
          }

          if (url.pathname === "/api/chat" && request.method === "POST") {
            const token = env.VITE_AI_TOKEN;
            if (!token) return sendJson(response, 500, { message: "Missing Hugging Face token." });

            const { question, dashboardData } = await readBody(request);
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
            if (!upstream.ok) return sendJson(response, upstream.status, { message: data.error });
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
