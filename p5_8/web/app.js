const API_BASE_URL = "http://localhost:8000";

// ---- Режим аудиторії: ?view=executive|analyst|demo ----
const VIEW = new URLSearchParams(location.search).get("view") || "analyst";
const VISIBLE = {
  executive: ["insight", "trend"],
  analyst: ["insight", "trend", "dist", "heatmap", "table"],
  demo: ["trend", "dist", "heatmap"],
};
const HIDE_SOURCE = VIEW === "demo";
document.querySelectorAll("[data-block]").forEach(el => {
  el.classList.toggle("hidden", !(VISIBLE[VIEW] || VISIBLE.analyst).includes(el.dataset.block));
});
document.querySelectorAll("[data-view]").forEach(a => a.classList.toggle("active", a.dataset.view === VIEW));
if (HIDE_SOURCE) document.querySelectorAll(".src").forEach(el => el.remove());

const $ = id => document.getElementById(id);
const COLORS = ["#4b5320", "#1f4e79", "#8b7d6b", "#c9a400", "#6b8e23", "#5f7a99", "#a0522d", "#2f4f4f"];
const charts = {};
let page = 1;

async function api(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
  const res = await fetch(`${API_BASE_URL}${path}${qs.toString() ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function currentFilters() {
  return {
    from: $("f-from").value, to: $("f-to").value, sector: $("f-sector").value,
    direction: $("f-direction").value, event_type: $("f-type").value, min_intensity: $("f-min").value,
  };
}

function drawChart(id, type, labels, data, label) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), {
    type,
    data: { labels, datasets: [{ label, data, backgroundColor: type === "line" ? "rgba(75,83,32,.15)" : COLORS,
                                 borderColor: type === "line" ? "#4b5320" : "#fff", fill: type === "line", tension: .25 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: type === "doughnut", position: "right" } },
               scales: type === "doughnut" ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

async function loadKpiAndTrend(f) {
  const [k, trend] = await Promise.all([api("/kpi", f), api("/trend", { ...f, group: $("f-group").value })]);
  $("k-total").textContent = k.total_incidents;
  $("k-int").textContent = k.total_intensity;
  $("k-avg").textContent = k.avg_intensity;
  $("k-top").textContent = k.top_direction || "–";
  drawChart("c-trend", "line", trend.map(r => r.t), trend.map(r => r.value), "Інцидентів");

  // Короткий текстовий «інсайт» для керівника
  if (trend.length >= 2) {
    const half = Math.floor(trend.length / 2);
    const sum = a => a.reduce((s, r) => s + r.value, 0);
    const first = sum(trend.slice(0, half)) / half, second = sum(trend.slice(half)) / (trend.length - half);
    const change = first ? Math.round((second - first) / first * 100) : 0;
    const peak = trend.reduce((a, b) => (b.value > a.value ? b : a));
    $("insight").innerHTML = `За обраний період зафіксовано <b>${k.total_incidents}</b> інцидентів, середня інтенсивність <b>${k.avg_intensity}</b>. ` +
      `Найактивніший напрямок — <b>${k.top_direction}</b>. Пік активності: <b>${peak.t}</b> (${peak.value}). ` +
      `У другій половині періоду активність ${change >= 0 ? "зросла" : "знизилась"} на <b>${Math.abs(change)}%</b>.`;
  } else {
    $("insight").textContent = k.total_incidents ? "Замало даних для оцінки тренду." : "За обраними фільтрами подій немає.";
  }
}

async function loadDistributions(f) {
  const [d, t] = await Promise.all([api("/distribution/directions", f), api("/distribution/types", f)]);
  drawChart("c-dir", "bar", d.map(r => r.label), d.map(r => r.value), "Інцидентів");
  drawChart("c-type", "doughnut", t.map(r => r.label), t.map(r => r.value), "Інцидентів");
}

async function loadHeatmap(f) {
  const h = await api("/heatmap", f);
  const max = Math.max(1, ...h.rows.flatMap(r => r.values));
  $("heatmap").innerHTML = `<tr><th>Сектор</th>${h.columns.map(c => `<th>${c.slice(5)}</th>`).join("")}</tr>` +
    h.rows.map(r => `<tr><th>${r.sector}</th>${r.values.map(v =>
      `<td style="background:rgba(139,26,26,${(v / max).toFixed(2)});color:${v / max > .55 ? "#fff" : "#222"}">${v}</td>`).join("")}</tr>`).join("");
}

async function loadIncidents(f) {
  const r = await api("/incidents", { ...f, page, page_size: 10 });
  const pages = Math.max(1, Math.ceil(r.total / r.page_size));
  document.querySelector("#incidents tbody").innerHTML = r.items.map(i =>
    `<tr><td>${i.id}</td><td>${i.occurred_at.slice(0, 16)}</td><td>${i.sector}</td><td>${i.direction}</td>` +
    `<td>${i.event_type}</td><td>${i.intensity}</td>${HIDE_SOURCE ? "" : `<td>${i.source || ""}</td>`}` +
    `<td><button class="details" data-id="${i.id}">Деталі</button></td></tr>`).join("");
  $("page-info").textContent = `Сторінка ${r.page} з ${pages} · всього ${r.total}`;
  $("prev").disabled = page <= 1;
  $("next").disabled = page >= pages;
}

async function showDetails(id) {
  const i = await api(`/incidents/${id}`);
  const labels = { id: "ID", occurred_at: "Час", sector: "Сектор", direction: "Напрямок", event_type: "Тип",
                   intensity: "Інтенсивність", source: "Джерело", summary: "Опис" };
  $("modal-body").innerHTML = Object.entries(labels)
    .filter(([k]) => !(HIDE_SOURCE && k === "source"))
    .map(([k, l]) => `<dt>${l}</dt><dd>${i[k] ?? "–"}</dd>`).join("");
  $("modal").classList.remove("hidden");
}

async function refresh() {
  const f = currentFilters();
  const tasks = [loadKpiAndTrend(f)];
  const shown = VISIBLE[VIEW] || VISIBLE.analyst;
  if (shown.includes("dist")) tasks.push(loadDistributions(f));
  if (shown.includes("heatmap")) tasks.push(loadHeatmap(f));
  if (shown.includes("table")) tasks.push(loadIncidents(f));
  try { await Promise.all(tasks); }
  catch (e) { $("insight").textContent = "Помилка зв'язку з API: " + e.message; $("insight").closest("section").classList.remove("hidden"); }
}

async function init() {
  try {
    const fl = await api("/filters");
    const fill = (id, arr) => arr.forEach(v => $(id).insertAdjacentHTML("beforeend", `<option>${v}</option>`));
    fill("f-sector", fl.sectors); fill("f-direction", fl.directions); fill("f-type", fl.event_types);
    $("f-from").min = $("f-to").min = fl.min_date;
    $("f-from").max = $("f-to").max = fl.max_date;
  } catch (e) { /* refresh() покаже помилку */ }
  $("apply").onclick = () => { page = 1; refresh(); };
  $("reset").onclick = () => { document.querySelectorAll(".filters input, .filters select").forEach(el => (el.value = el.id === "f-group" ? "day" : "")); page = 1; refresh(); };
  $("prev").onclick = () => { page--; loadIncidents(currentFilters()); };
  $("next").onclick = () => { page++; loadIncidents(currentFilters()); };
  document.querySelector("#incidents tbody").addEventListener("click", e => { if (e.target.dataset.id) showDetails(e.target.dataset.id); });
  $("modal-close").onclick = () => $("modal").classList.add("hidden");
  $("modal").onclick = e => { if (e.target.id === "modal") $("modal").classList.add("hidden"); };
  refresh();
}
init();
