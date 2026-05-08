export default async function handler(request, response) {
  const apiKey = process.env.VITE_GNEWS_API_KEY;
  const category = request.query?.category || "science";

  if (!apiKey) {
    return response.status(500).json({ message: "Missing GNews API key." });
  }

  try {
    const params = new URLSearchParams({
      category,
      lang: "en",
      country: "us",
      max: "5",
      apikey: apiKey
    });
    const upstream = await fetch(`https://gnews.io/api/v4/top-headlines?${params}`);
    const data = await upstream.json();

    if (!upstream.ok) {
      return response.status(upstream.status).json({
        message: data.errors?.[0] || data.message || "GNews request failed."
      });
    }

    response.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({
      message: "News service failed.",
      detail: error.message
    });
  }
}
