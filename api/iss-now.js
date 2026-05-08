export default async function handler(_request, response) {
  try {
    const upstream = await fetch("http://api.open-notify.org/iss-now.json");
    const data = await upstream.json();

    if (!upstream.ok || data.message !== "success") {
      return response.status(502).json({ message: "Unable to fetch ISS location." });
    }

    response.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({
      message: "ISS location service failed.",
      detail: error.message
    });
  }
}
