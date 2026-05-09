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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ message: "Use POST." });
  }

  try {
    const { question, dashboardData } = request.body || {};
    if (!question || !dashboardData) {
      return response.status(400).json({ message: "Question and dashboard data are required." });
    }

    const directAnswer = answerFromDashboard(question, dashboardData);
    if (directAnswer) {
      return response.status(200).json({ answer: directAnswer });
    }

    const token = process.env.VITE_AI_TOKEN;
    if (!token) {
      return response.status(500).json({ message: "Missing Hugging Face token." });
    }

    const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
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

    const raw = await hfResponse.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 180) };
    }

    if (!hfResponse.ok) {
      const message = textFrom(data.error) || textFrom(data.message);
      return response.status(200).json({
        answer: message.includes("not supported by any provider")
          ? fallbackAnswer()
          : `I can only answer from the current dashboard data. ${message || ""}`.trim()
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    return response.status(200).json({
      answer: (answer || "I can only answer from the current dashboard data.").trim()
    });
  } catch (error) {
    return response.status(500).json({
      message: "Chat service failed.",
      detail: error.message
    });
  }
}
