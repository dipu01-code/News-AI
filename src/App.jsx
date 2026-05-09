import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Crosshair,
  Grid2X2,
  Moon,
  Radio,
  RefreshCcw,
  Rocket,
  Satellite,
  Search,
  Settings,
  Sun,
  Trash2,
  UserCircle,
  Users,
  Wifi,
  X
} from "lucide-react";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import L from "leaflet";
import {
  NEWS_CATEGORIES,
  calculateSpeedKmh,
  formatTime,
  getCached,
  ISS_POLL_MS,
  makeDashboardContext,
  nearestPlace,
  setCached
} from "./utils.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

const markerIcon = L.divIcon({
  className: "iss-marker",
  html: "<div class='iss-marker-core'>ISS</div>",
  iconSize: [54, 54],
  iconAnchor: [27, 27]
});

function readableMessage(value, fallback = "Something went wrong.") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.message || value.error || value.detail || JSON.stringify(value);
  }
  return String(value);
}

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <span />
      <strong />
      <p />
      <p />
    </div>
  );
}

function IssMap({ positions, current }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pathRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("map")) return undefined;
    const map = L.map("map", { zoomControl: true }).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    const marker = L.marker([0, 0], { icon: markerIcon }).addTo(map);
    const path = L.polyline([], { color: "#28d7a2", weight: 3 }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;
    pathRef.current = path;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const leafletMap = mapRef.current;
    if (!current || !leafletMap || !markerRef.current || !pathRef.current) return;
    const latLng = [current.lat, current.lng];
    const pathPoints = positions.map((item) => [item.lat, item.lng]);
    markerRef.current
      .setLatLng(latLng)
      .bindTooltip(
        `Lat ${current.lat.toFixed(2)}, Lng ${current.lng.toFixed(2)}<br/>${current.place}`,
        { direction: "top" }
      );
    pathRef.current.setLatLngs(pathPoints);
    leafletMap.setView(latLng, Math.max(2, leafletMap.getZoom()), { animate: true });
  }, [current, positions]);

  return <div id="map" className="map-panel" />;
}

function Dashboard() {
  const [theme, setTheme] = useTheme();
  const [positions, setPositions] = useState([]);
  const [astros, setAstros] = useState(null);
  const [issLoading, setIssLoading] = useState(true);
  const [issError, setIssError] = useState("");
  const [newsByCategory, setNewsByCategory] = useState({});
  const [newsLoading, setNewsLoading] = useState({});
  const [newsError, setNewsError] = useState({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [activeCategory, setActiveCategory] = useState("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("orbitwire_chat") || "[]");
    } catch {
      return [];
    }
  });

  const currentIss = positions.at(-1);
  const articles = useMemo(
    () => Object.values(newsByCategory).flat(),
    [newsByCategory]
  );

  function notify(message, type = "success") {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200);
  }

  async function fetchIss() {
    setIssError("");
    try {
      const response = await fetch("/api/iss-now");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ISS request failed.");

      const lat = Number(data.iss_position.latitude);
      const lng = Number(data.iss_position.longitude);
      const place = nearestPlace(lat, lng);
      setPositions((previousPositions) => {
        const previous = previousPositions.at(-1);
        const nextRaw = { lat, lng, timestamp: Number(data.timestamp) };
        const speed = calculateSpeedKmh(previous, nextRaw);
        const next = {
          ...nextRaw,
          speed: Number(speed.toFixed(2)),
          place: `${place.name} (${Math.round(place.distance)} km away)`,
          time: formatTime(Number(data.timestamp))
        };
        return [...previousPositions, next].slice(-30);
      });
      setIssLoading(false);
    } catch (error) {
      setIssError(error.message);
      setIssLoading(false);
    }
  }

  async function fetchAstros() {
    try {
      const response = await fetch("/api/astros");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Astronaut request failed.");
      setAstros(data);
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function fetchNews(category, force = false) {
    const cacheKey = `gnews_${category}`;
    if (!force) {
      const cached = getCached(cacheKey);
      if (cached) {
        setNewsByCategory((items) => ({ ...items, [category]: cached }));
        return;
      }
    }

    setNewsLoading((items) => ({ ...items, [category]: true }));
    setNewsError((items) => ({ ...items, [category]: "" }));
    try {
      const response = await fetch(`/api/news?category=${encodeURIComponent(category)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "News request failed.");
      const normalized = (data.articles || []).slice(0, 5).map((article) => ({
        ...article,
        category,
        author: article.source?.name || "Editorial Desk"
      }));
      setCached(cacheKey, normalized);
      setNewsByCategory((items) => ({ ...items, [category]: normalized }));
      notify(`${category} news refreshed`);
    } catch (error) {
      setNewsError((items) => ({ ...items, [category]: error.message }));
    } finally {
      setNewsLoading((items) => ({ ...items, [category]: false }));
    }
  }

  useEffect(() => {
    fetchIss();
    fetchAstros();
    NEWS_CATEGORIES.forEach((category) => fetchNews(category));
    const timer = setInterval(fetchIss, ISS_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("orbitwire_chat", JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const visibleArticles = useMemo(() => {
    return articles
      .filter((article) => activeCategory === "all" || article.category === activeCategory)
      .filter((article) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return [article.title, article.description, article.source?.name, article.category]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (sortBy === "source") return (a.source?.name || "").localeCompare(b.source?.name || "");
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });
  }, [articles, activeCategory, search, sortBy]);

  const speedChartData = {
    labels: positions.map((item) => item.time),
    datasets: [
      {
        label: "ISS speed km/h",
        data: positions.map((item) => item.speed),
        borderColor: "#28d7a2",
        backgroundColor: "rgba(40, 215, 162, 0.16)",
        tension: 0.35,
        fill: true
      }
    ]
  };

  const distributionData = {
    labels: NEWS_CATEGORIES,
    datasets: [
      {
        data: NEWS_CATEGORIES.map((category) => newsByCategory[category]?.length || 0),
        backgroundColor: ["#4f8cff", "#f7b955"],
        borderWidth: 0
      }
    ]
  };

  async function sendMessage(event) {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || isTyping) return;

    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages.slice(-30));
    setChatInput("");
    setIsTyping(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          dashboardData: makeDashboardContext({
            iss: currentIss,
            positions,
            astros,
            articles
          })
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readableMessage(data.message || data.error, "Chat failed."));
      setMessages((items) => [...items, { role: "assistant", content: data.answer }].slice(-30));
    } catch (error) {
      setMessages((items) =>
        [...items, { role: "assistant", content: `Error: ${readableMessage(error.message)}` }].slice(-30)
      );
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <main className="app-shell command-shell">
      <Toasts toasts={toasts} />
      <header className="command-topbar">
        <div className="brand-lockup">
          <h1>ORBITAL_COMMAND</h1>
          <span>LV_TRACKER_V.9</span>
        </div>
        <nav className="top-nav" aria-label="Primary">
          <a href="#dashboard">Dashboard</a>
          <a href="#tracker" className="active">Live Tracker</a>
          <a href="#intel">News Hub</a>
          <a href="#analytics">Analytics</a>
        </nav>
        <div className="top-actions">
          <Wifi size={22} />
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Settings size={24} />
          <UserCircle size={26} />
        </div>
      </header>

      <div className="command-frame">
        <aside className="command-sidebar">
          <div>
            <strong>STATION_CMD</strong>
            <span>ISS-ALPHA_V4</span>
          </div>
          <a href="#dashboard" className="nav-item active"><Grid2X2 size={20} /> Dashboard</a>
          <a href="#tracker" className="nav-item"><Satellite size={20} /> Live Tracker</a>
          <a href="#intel" className="nav-item"><Radio size={20} /> News Hub</a>
          <a href="#analytics" className="nav-item"><BarChart3 size={20} /> Analytics</a>
          <a href="#crew" className="nav-item"><Users size={20} /> Astronauts</a>
          <button className="emergency-button"><AlertTriangle size={16} /> Emergency_Vent</button>
        </aside>

        <div className="command-main">
          <section id="dashboard" className="hero-console">
            <div className="orbital-globe" />
            <div className="station-clock">
              <span>Station_Time_UTC</span>
              <strong>{currentIss?.time || "--:--:--"}</strong>
            </div>

            <article className="command-card coordinates-card">
              <span className="eyebrow">Current Coordinates</span>
              <h2>ISS_ALPHA_V4</h2>
              {issLoading ? (
                <SkeletonCard />
              ) : issError ? (
                <div className="error-box compact">
                  <strong>Signal interrupted.</strong>
                  <p>{issError}</p>
                  <button onClick={fetchIss}>Retry</button>
                </div>
              ) : (
                <div className="coordinate-pair">
                  <div>
                    <span>Latitude</span>
                    <strong>{currentIss?.lat.toFixed(4)} N</strong>
                  </div>
                  <div>
                    <span>Longitude</span>
                    <strong>{currentIss?.lng.toFixed(4)} W</strong>
                  </div>
                </div>
              )}
            </article>

            <article className="command-card telemetry-card">
              <div><span>Velocity</span><strong>{Math.round(currentIss?.speed || 0).toLocaleString()} km/h</strong></div>
              <div><span>Nadir Point</span><strong>{currentIss?.place || "Awaiting signal"}</strong></div>
              <div><span>Positions</span><strong>{positions.slice(-15).length} tracked</strong></div>
            </article>

            <button className="mission-button"><Rocket size={22} /> Mission_Abort</button>
            <div className="telemetry-link">
              <RefreshCcw size={20} />
              <div>
                <span>Telemetry link: nominal</span>
                <strong>Next sync: 0.8s</strong>
              </div>
            </div>
          </section>

          <section id="tracker" className="tracker-grid">
            <article className="command-card stat-card">
              <span>Orbital Speed</span>
              <strong>{Math.round(currentIss?.speed || 0).toLocaleString()}</strong>
              <small>km/h</small>
            </article>
            <article className="command-card stat-card cyan">
              <span>Altitude (MSL)</span>
              <strong>421.4</strong>
              <small>km</small>
            </article>
            <article className="command-card stat-card">
              <span>Current Coordinates</span>
              <p>LAT <strong>{currentIss?.lat.toFixed(4) || "--"}</strong></p>
              <p>LON <strong>{currentIss?.lng.toFixed(4) || "--"}</strong></p>
            </article>
            <article className="command-card map-wrap map-console">
              <div className="map-label">Live Tracking Active</div>
              <h2>ISS Ground Track</h2>
              <IssMap positions={positions.slice(-15)} current={currentIss} />
              <button
                className="secondary-button map-refresh"
                onClick={() => {
                  fetchIss();
                  fetchAstros();
                  notify("ISS data refreshed");
                }}
              >
                <Crosshair size={16} /> Recenter
              </button>
            </article>
            <article className="command-card telemetry-feed">
              <div className="section-title">
                <div>
                  <span className="eyebrow">Breaking Telemetry</span>
                  <h2>Mission Feed</h2>
                </div>
                <span className="realtime-badge">Real-Time</span>
              </div>
              {["Minor pressure oscillation detected in Node 3.", "EVA prep initiated for external sensor maintenance.", "Adjusted burn scheduled to avoid debris cluster.", "Protein crystal growth experiment frozen."].map((item, index) => (
                <div className="feed-item" key={item}>
                  <span>{["System_Alpha", "Astronaut_Log", "Trajectory_Upd", "Experiment_V7"][index]}</span>
                  <p>{item}</p>
                </div>
              ))}
            </article>
          </section>

          <section id="intel" className="command-card news-panel">
            <div className="section-title news-title">
              <div>
                <p className="eyebrow">Orbital Intelligence</p>
                <h2>News Hub</h2>
              </div>
              <div className="news-controls">
                <label className="search-box">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search intel"
                  />
                </label>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="date">Sort by date</option>
                  <option value="source">Sort by source</option>
                </select>
              </div>
            </div>

            <div className="news-layout">
              <div className="distribution">
                <Doughnut
                  data={distributionData}
                  options={{
                    plugins: { legend: { position: "bottom" } },
                    onClick: (_event, elements) => {
                      if (!elements.length) return;
                      setActiveCategory(NEWS_CATEGORIES[elements[0].index]);
                    }
                  }}
                />
                <button className="secondary-button full" onClick={() => setActiveCategory("all")}>
                  Show all articles
                </button>
              </div>

              <div className="article-zone">
                <div className="category-row">
                  {NEWS_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      className={activeCategory === category ? "active" : ""}
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {NEWS_CATEGORIES.map((category) =>
                  newsError[category] ? (
                    <div className="error-box" key={category}>
                      <strong>{category} feed failed.</strong>
                      <p>{newsError[category]}</p>
                      <button onClick={() => fetchNews(category, true)}>Retry</button>
                    </div>
                  ) : null
                )}
                <div className="article-grid">
                  {Object.values(newsLoading).some(Boolean) && !visibleArticles.length
                    ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
                    : visibleArticles.map((article) => (
                        <article className="article-card" key={`${article.category}-${article.url}`}>
                          <img src={article.image || "/placeholder-news.svg"} alt="" />
                          <div>
                            <span className="article-meta">
                              {article.category} / {article.source?.name || "Unknown source"}
                            </span>
                            <h3>{article.title}</h3>
                            <p>{article.description || "No description available."}</p>
                            <div className="article-footer">
                              <time>{new Date(article.publishedAt).toLocaleDateString()}</time>
                              <a href={article.url} target="_blank" rel="noreferrer">
                                Read_Intel
                              </a>
                            </div>
                          </div>
                        </article>
                      ))}
                </div>
                <div className="refresh-row">
                  {NEWS_CATEGORIES.map((category) => (
                    <button
                      className="secondary-button"
                      key={category}
                      onClick={() => fetchNews(category, true)}
                    >
                      <RefreshCcw size={15} /> Refresh {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="analytics" className="analytics-grid">
            <article className="command-card chart-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Measured in km/h // Delta variants</p>
                  <h2>Velocity Telemetry</h2>
                </div>
                <strong>{Math.round(currentIss?.speed || 0).toLocaleString()} km/h</strong>
              </div>
              <Line
                data={speedChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } }
                }}
              />
            </article>
            <article id="crew" className="command-card people-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Biometric feed active</p>
                  <h2>Astronauts Directory</h2>
                </div>
                <strong className="big-number">{astros?.number ?? "..."}</strong>
              </div>
              <div className="chips crew-list">
                {(astros?.people || []).map((person, index) => (
                  <span key={person.name}>#ISS-{String(index + 1).padStart(3, "0")} / {person.name}</span>
                ))}
              </div>
            </article>
          </section>
        </div>
      </div>

      <button className="chat-fab" onClick={() => setChatOpen(true)} aria-label="Open chatbot">
        <Bot />
      </button>

      {chatOpen ? (
        <aside className="chat-window">
          <header>
            <div>
              <strong>Vigil AI Assistant</strong>
              <span>Dashboard-only intelligence</span>
            </div>
            <button onClick={() => setChatOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </header>
          <div className="messages">
            {messages.length === 0 ? (
              <p className="empty-chat">Awaiting_input... Ask about ISS telemetry, crew, or news intel.</p>
            ) : (
              messages.map((message, index) => (
                <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.content}
                </div>
              ))
            )}
            {isTyping ? <div className="message assistant typing">Typing...</div> : null}
          </div>
          <form onSubmit={sendMessage}>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="AWAITING_INPUT..."
            />
            <button>Send</button>
          </form>
          <button
            className="clear-chat"
            onClick={() => {
              setMessages([]);
              localStorage.removeItem("orbitwire_chat");
            }}
          >
            <Trash2 size={15} /> Clear chat
          </button>
        </aside>
      ) : null}
    </main>
  );
}

export default Dashboard;
