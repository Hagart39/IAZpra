// Практична 5.5: заповнення 4 графічних блоків даними з mock.js
const COLORS = ["#005a34", "#556b2f", "#1f4e79", "#c9a400"];
const today = new Date();

const people = mockData.groups.flatMap(g =>
  g.students.map(s => ({ ...s, group: g.group_name, rank: s.rank_name }))
);
const age = d => Math.floor((today - new Date(d)) / (365.25 * 24 * 3600 * 1000));

// 1. KPI-картки
const avgAge = (people.reduce((a, p) => a + age(p.birth_date), 0) / people.length).toFixed(1);
const officers = people.filter(p => p.rank_name === "Лейтенант").length;
const kpis = [
  ["Особовий склад", people.length],
  ["Груп", mockData.groups.length],
  ["Середній вік", avgAge],
  ["Офіцерів", officers],
];
document.getElementById("kpi").innerHTML = kpis
  .map(([label, val]) => `<div class="kpi"><span>${val}</span><small>${label}</small></div>`)
  .join("");

// 2. Стовпчиковий графік: чисельність за групами
new Chart(document.getElementById("chartGroups"), {
  type: "bar",
  data: {
    labels: mockData.groups.map(g => g.group_name),
    datasets: [{ label: "Осіб", data: mockData.groups.map(g => g.students.length), backgroundColor: "#005a34" }],
  },
  options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
});

// 3. Кільцева діаграма: структура за званнями
const rankCounts = {};
people.forEach(p => (rankCounts[p.rank] = (rankCounts[p.rank] || 0) + 1));
new Chart(document.getElementById("chartRanks"), {
  type: "doughnut",
  data: { labels: Object.keys(rankCounts), datasets: [{ data: Object.values(rankCounts), backgroundColor: COLORS }] },
  options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } },
});

// 4. Карта Leaflet: умовні пункти розміщення груп
const locations = [[50.45, 30.52, "Київ"], [49.84, 24.03, "Львів"], [48.46, 35.05, "Дніпро"]];
const map = L.map("map").setView([49.2, 30.5], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
mockData.groups.forEach((g, i) => {
  const [lat, lng, city] = locations[i % locations.length];
  L.circleMarker([lat, lng], { radius: 6 + g.students.length, color: "#005a34", fillColor: "#ffdd00", fillOpacity: 0.8 })
    .addTo(map)
    .bindPopup(`<b>${g.group_name}</b><br>${city}<br>Осіб: ${g.students.length}`);
});
map.fitBounds(locations.map(([lat, lng]) => [lat, lng]), { padding: [25, 25] });

// Таблиця з фільтром за групою
const tbody = document.querySelector("#students tbody");
const filter = document.getElementById("groupFilter");
mockData.groups.forEach(g => filter.insertAdjacentHTML("beforeend", `<option>${g.group_name}</option>`));
function renderTable() {
  tbody.innerHTML = people
    .filter(p => !filter.value || p.group === filter.value)
    .map(p => `<tr><td>${p.full_name}</td><td>${p.birth_date}</td><td>${age(p.birth_date)}</td><td>${p.rank}</td><td>${p.group}</td></tr>`)
    .join("");
}
filter.addEventListener("change", renderTable);
renderTable();
