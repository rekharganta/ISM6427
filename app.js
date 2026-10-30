const DEFAULT = { name: "Boca Raton", lat: 26.3587, lon: -80.0831 };

const CODES = {
  0: ["Clear", "☀️", "🌙"], 1: ["Mostly Clear", "🌤️", "🌙"], 2: ["Partly Cloudy", "⛅", "☁️"],
  3: ["Cloudy", "☁️", "☁️"], 45: ["Fog", "🌫️", "🌫️"], 48: ["Fog", "🌫️", "🌫️"],
  51: ["Light Drizzle", "🌦️", "🌧️"], 53: ["Drizzle", "🌦️", "🌧️"], 55: ["Heavy Drizzle", "🌧️", "🌧️"],
  61: ["Light Rain", "🌦️", "🌧️"], 63: ["Rain", "🌧️", "🌧️"], 65: ["Heavy Rain", "🌧️", "🌧️"],
  71: ["Light Snow", "🌨️", "🌨️"], 73: ["Snow", "🌨️", "🌨️"], 75: ["Heavy Snow", "❄️", "❄️"],
  80: ["Showers", "🌦️", "🌧️"], 81: ["Showers", "🌧️", "🌧️"], 82: ["Heavy Showers", "⛈️", "⛈️"],
  95: ["Thunderstorm", "⛈️", "⛈️"], 96: ["Thunderstorm", "⛈️", "⛈️"], 99: ["Thunderstorm", "⛈️", "⛈️"],
};
const info = (code, isDay = 1) => {
  const c = CODES[code] || ["—", "🌡️", "🌡️"];
  return { text: c[0], icon: isDay ? c[1] : c[2] };
};

const $ = (id) => document.getElementById(id);
const round = Math.round;

async function loadWeather({ name, lat, lon }) {
  $("place").textContent = name;
  $("desc").textContent = "Loading…";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
    `&hourly=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    render(await res.json());
  } catch {
    $("desc").textContent = "Couldn't load weather.";
  }
}

function render(d) {
  const c = d.current;
  const now = info(c.weather_code, c.is_day);

  $("temp").textContent = `${round(c.temperature_2m)}°`;
  $("desc").textContent = now.text;
  $("hilo").textContent = `H:${round(d.daily.temperature_2m_max[0])}°  L:${round(d.daily.temperature_2m_min[0])}°`;
  $("feels").textContent = `${round(c.apparent_temperature)}°`;
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${round(c.wind_speed_10m)} mph`;
  $("uv").textContent = round(d.daily.uv_index_max[0]);

  // Next 24 hours, starting at the current hour
  const start = d.hourly.time.findIndex((t) => t >= c.time.slice(0, 13));
  $("hourly").innerHTML = d.hourly.time
    .slice(start, start + 24)
    .map((t, i) => {
      const h = start + i;
      const label = i === 0 ? "Now" : new Date(t).toLocaleTimeString([], { hour: "numeric" });
      return `<div class="hour"><span>${label}</span>
        <span class="icon">${info(d.hourly.weather_code[h], d.hourly.is_day[h]).icon}</span>
        <span>${round(d.hourly.temperature_2m[h])}°</span></div>`;
    })
    .join("");

  // 7-day with range bars
  const min = Math.min(...d.daily.temperature_2m_min);
  const max = Math.max(...d.daily.temperature_2m_max);
  const span = max - min || 1;
  $("daily").innerHTML = d.daily.time
    .map((t, i) => {
      const lo = d.daily.temperature_2m_min[i];
      const hi = d.daily.temperature_2m_max[i];
      const day = i === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString([], { weekday: "short" });
      const left = ((lo - min) / span) * 100;
      const width = ((hi - lo) / span) * 100;
      return `<li><span>${day}</span>
        <span class="icon">${info(d.daily.weather_code[i]).icon}</span>
        <span class="lo">${round(lo)}°</span>
        <div class="bar"><span style="left:${left}%;width:${width}%"></span></div>
        <span>${round(hi)}°</span></li>`;
    })
    .join("");
}

$("search").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("city").value.trim();
  if (!q) return;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`);
    const data = await res.json();
    if (!data.results?.length) {
      $("desc").textContent = `No results for "${q}"`;
      return;
    }
    const r = data.results[0];
    $("city").value = "";
    loadWeather({ name: r.name, lat: r.latitude, lon: r.longitude });
  } catch {
    $("desc").textContent = "Search failed.";
  }
});

// Saved settings (wrapped in try/catch because storage can be blocked)
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};

// Theme: system follows the device; light and dark override it
function setTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  store.set("theme", theme === "system" ? null : theme);
  document.querySelectorAll(".theme button").forEach((b) =>
    b.setAttribute("aria-checked", b.dataset.theme === theme)
  );
}
document.querySelectorAll(".theme button").forEach((b) =>
  b.addEventListener("click", () => setTheme(b.dataset.theme))
);
setTheme(store.get("theme") || "system");

// Greeting: ask for a name the first time, then remember it
function showGreeting() {
  const name = store.get("name");
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  $("greeting").textContent = name ? `${part}, ${name}` : part;
  $("name-form").hidden = !!name;
}
$("greeting").addEventListener("click", () => {
  $("name").value = store.get("name") || "";
  $("name-form").hidden = false;
  $("name").focus();
});
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  store.set("name", $("name").value.trim());
  showGreeting();
});
showGreeting();

loadWeather(DEFAULT);
