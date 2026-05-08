const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ message: "Use POST." });
  }

  const token = process.env.VITE_AI_TOKEN;
  if (!token) {
    return response.status(500).json({ message: "Missing Hugging Face token." });
  }

  try {
    const { question, dashboardData } = request.body || {};
    if (!question || !dashboardData) {
      return response.status(400).json({ message: "Question and dashboard data are required." });
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
      return response.status(hfResponse.status).json({
        message: data.error || "Hugging Face request failed."
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
