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

    const prompt = `<s>[INST]
You are the OrbitWire dashboard assistant. Answer only from the DASHBOARD_DATA JSON.
If the answer is not present in the dashboard data, say: "I can only answer from the current dashboard data."
Do not use outside knowledge. Keep answers brief and helpful.

DASHBOARD_DATA:
${JSON.stringify(dashboardData).slice(0, 12000)}

QUESTION:
${question}
[/INST]`;

    const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 220,
          temperature: 0.2,
          return_full_text: false
        }
      })
    });

    const data = await hfResponse.json();
    if (!hfResponse.ok) {
      return response.status(hfResponse.status).json({
        message: data.error || "Hugging Face request failed."
      });
    }

    const answer = Array.isArray(data)
      ? data[0]?.generated_text
      : data.generated_text || data[0]?.generated_text;

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
