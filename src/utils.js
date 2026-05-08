export const NEWS_CATEGORIES = ["science", "technology"];
export const NEWS_CACHE_TTL = 15 * 60 * 1000;
export const ISS_POLL_MS = 15 * 1000;

export function haversineKm(a, b) {
  const radius = 6371;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function calculateSpeedKmh(previous, current) {
  if (!previous || !current || previous.timestamp === current.timestamp) return 0;
  const hours = Math.abs(current.timestamp - previous.timestamp) / 3600;
  if (!hours) return 0;
  return haversineKm(previous, current) / hours;
}

const places = [
  { name: "Pacific Ocean", lat: 0, lng: -150, type: "ocean" },
  { name: "Atlantic Ocean", lat: 5, lng: -35, type: "ocean" },
  { name: "Indian Ocean", lat: -20, lng: 80, type: "ocean" },
  { name: "Southern Ocean", lat: -60, lng: 20, type: "ocean" },
  { name: "Arctic Ocean", lat: 78, lng: 0, type: "ocean" },
  { name: "New York City", lat: 40.7128, lng: -74.006, type: "city" },
  { name: "London", lat: 51.5072, lng: -0.1276, type: "city" },
  { name: "Paris", lat: 48.8566, lng: 2.3522, type: "city" },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, type: "city" },
  { name: "Delhi", lat: 28.6139, lng: 77.209, type: "city" },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, type: "city" },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, type: "city" },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, type: "city" },
  { name: "Sao Paulo", lat: -23.5558, lng: -46.6396, type: "city" },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, type: "city" },
  { name: "Moscow", lat: 55.7558, lng: 37.6173, type: "city" },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, type: "city" },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, type: "city" },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, type: "city" },
  { name: "Honolulu", lat: 21.3099, lng: -157.8581, type: "city" }
];

export function nearestPlace(lat, lng) {
  const current = { lat, lng };
  return places
    .map((place) => ({
      ...place,
      distance: haversineKm(current, { lat: place.lat, lng: place.lng })
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

export function formatTime(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function getCached(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (!cached || Date.now() - cached.savedAt > NEWS_CACHE_TTL) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function setCached(key, data) {
  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
}

export function makeDashboardContext({ iss, positions, astros, articles }) {
  return {
    iss: {
      latitude: iss?.lat,
      longitude: iss?.lng,
      speedKmh: iss?.speed,
      currentLocation: iss?.place,
      trackedPositions: positions.length,
      lastUpdated: iss?.time
    },
    astronauts: {
      total: astros?.number || 0,
      names: astros?.people?.map((person) => person.name) || []
    },
    news: articles.map((article) => ({
      title: article.title,
      source: article.source?.name,
      author: article.author || "Not available",
      category: article.category,
      date: article.publishedAt,
      description: article.description
    }))
  };
}
