document.addEventListener("DOMContentLoaded", () => {
  // Адреса API (FastAPI). Очікуваний формат відповіді — див. README.md
  const API_URL = "http://localhost:8000/reports";

  // Кольори з брендбуку (ті самі, що в :root у styles.css)
  const COLOR_PRIMARY = "#005a34";
  const COLOR_ACCENT = "#ffdd00";
  const SERIES_COLORS = ["#005a34", "#ffdd00", "#4f7c63", "#8a8d91", "#b8a200", "#a9c5b4"];

  // Довідники
  const SOURCES = ["Донесення підрозділів", "БпЛА", "Радіорозвідка", "OSINT", "Спостереження"];
  const STATUSES = {
    new: { name: "Надійшло", css: "badge-new" },
    processed: { name: "Оброблено", css: "badge-processed" },
    generalized: { name: "Узагальнено", css: "badge-generalized" },
  };
  // Категорія відомостей -> умовний знак (SIDC, MIL-STD-2525C, противник)
  const CATEGORIES = {
    "Особовий склад": "SHGPUCI----E---",
    "Бронетехніка": "SHGPUCA----E---",
    "Артилерія": "SHGPUCF----E---",
    "ППО": "SHGPUCD----E---",
    "Логістика": "SHGPUSS----E---",
  };
  const RELIABILITY = ["A", "B", "C", "D", "E", "F"]; // надійність джерела
  const CREDIBILITY = ["1", "2", "3", "4", "5", "6"]; // достовірність інформації
  const MAP_CENTER = [48.7, 32.0]; // умовний район (центр України)

  let allData = []; // усі накопичені повідомлення
  let periodDays = 30; // вибраний період
  let map;
  let markersLayer;
  const charts = {};

  // ---------- Завантаження даних ----------

  async function fetchData() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      allData = result.data.map(normalize);
      setStatus("API: OK", "status-ok");
    } catch (error) {
      console.error("Помилка отримання даних:", error);
      if (!allData.length) {
        allData = generateDemoData(); // демо-дані генеруємо один раз
      }
      setStatus("API недоступний — демо-дані", "status-demo");
    }
    render();
  }

  // Приводимо запис до єдиного вигляду
  function normalize(row) {
    return {
      id: row.id,
      receivedAt: new Date(row.received_at),
      source: row.source_type,
      category: row.category,
      reliability: row.reliability,
      credibility: String(row.credibility),
      status: row.status,
      lat: Number(row.lat),
      lon: Number(row.lon),
      summary: row.summary || "",
    };
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Умовні райони для демо-даних: центр і категорії, що в ньому трапляються
  const DEMO_AREAS = [
    { center: [49.25, 30.75], categories: ["Особовий склад", "Логістика"] },
    { center: [49.25, 32.25], categories: ["Артилерія", "Особовий склад"] },
    { center: [48.75, 31.25], categories: ["Бронетехніка"] },
    { center: [48.75, 33.25], categories: ["ППО", "Логістика"] },
    { center: [48.25, 32.25], categories: ["Артилерія", "Бронетехніка"] },
    { center: [48.25, 30.25], categories: ["ППО"] },
  ];

  // Синтетичні повідомлення за 90 діб (якщо бекенд не запущено)
  function generateDemoData() {
    const data = [];
    const now = Date.now();
    let id = 1;
    for (let day = 89; day >= 0; day--) {
      const count = 5 + Math.floor(Math.random() * 12);
      for (let i = 0; i < count; i++) {
        const receivedAt = new Date(now - day * 86400000 - Math.random() * 86400000);
        const area = randomItem(DEMO_AREAS);
        const category = randomItem(area.categories);
        // Що старіше повідомлення, то більша ймовірність, що його вже узагальнено
        const r = Math.random() * (day + 2);
        const status = r > 3 ? "generalized" : r > 1 ? "processed" : "new";
        data.push({
          id: id++,
          receivedAt,
          source: randomItem(SOURCES),
          category,
          reliability: RELIABILITY[Math.min(5, Math.floor(Math.random() * Math.random() * 6))],
          credibility: CREDIBILITY[Math.min(5, Math.floor(Math.random() * Math.random() * 6))],
          status,
          lat: area.center[0] + (Math.random() - 0.5) * 0.3,
          lon: area.center[1] + (Math.random() - 0.5) * 0.3,
          summary: `Умовне повідомлення №${id - 1}: ${category.toLowerCase()}`,
        });
      }
    }
    return data;
  }

  function setStatus(text, cssClass) {
    const status = document.getElementById("api-status");
    status.textContent = text;
    status.className = `status ${cssClass}`;
    document.getElementById("last-update").textContent =
      "Оновлено: " + new Date().toLocaleTimeString("uk-UA");
  }

  // ---------- Допоміжні функції ----------

  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function countBy(data, key) {
    const totals = {};
    data.forEach((entry) => {
      totals[entry[key]] = (totals[entry[key]] || 0) + 1;
    });
    return totals;
  }

  function percent(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  function isReliable(entry) {
    return "AB".includes(entry.reliability) && "12".includes(entry.credibility);
  }

  function periodData() {
    const from = Date.now() - periodDays * 86400000;
    return allData.filter((entry) => entry.receivedAt.getTime() >= from);
  }

  // ---------- Рендер ----------

  function render() {
    const data = periodData();
    updateKpi(data);
    updateSummary(data);
    updatePipeline(data);
    updateAccumChart(data);
    updateBarChart("source-chart", countBy(data, "source"));
    updateDoughnut("category-chart", countBy(data, "category"));
    updateMatrix(data);
    updateMap(data);
    updateTable(data);
  }

  function updateKpi(data) {
    const dayAgo = Date.now() - 86400000;
    const generalized = data.filter((entry) => entry.status === "generalized").length;
    const reliable = data.filter(isReliable).length;

    document.getElementById("kpi-total").textContent = data.length;
    document.getElementById("kpi-day").textContent =
      data.filter((entry) => entry.receivedAt.getTime() >= dayAgo).length;
    document.getElementById("kpi-generalized").textContent = `${percent(generalized, data.length)} %`;
    document.getElementById("kpi-reliable").textContent = `${percent(reliable, data.length)} %`;
  }

  // Текстове зведення формується автоматично з агрегатів
  function updateSummary(data) {
    const box = document.getElementById("summary-text");
    if (!data.length) {
      box.innerHTML = "<p>За вибраний період повідомлень немає.</p>";
      return;
    }
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
    const [topSource, topSourceCount] = top(countBy(data, "source"));
    const [topCategory, topCategoryCount] = top(countBy(data, "category"));
    const pending = data.filter((entry) => entry.status !== "generalized").length;

    box.innerHTML = `
      <p>За останні <strong>${periodDays} діб</strong> накопичено <strong>${data.length}</strong> повідомлень
        (у середньому ${(data.length / periodDays).toFixed(1)} за добу).</p>
      <p>Основне джерело — <strong>${topSource}</strong> (${percent(topSourceCount, data.length)} %).
        Найбільше відомостей щодо категорії <strong>${topCategory}</strong> (${topCategoryCount}).</p>
      <p>Достовірними (A–B / 1–2) оцінено <strong>${percent(data.filter(isReliable).length, data.length)} %</strong> інформації.
        Очікують узагальнення: <strong>${pending}</strong>.</p>`;
  }

  // Етапи: надійшло -> оброблено -> узагальнено (кожен наступний входить у попередній)
  function updatePipeline(data) {
    const counts = countBy(data, "status");
    const stages = [
      { name: "Надійшло", value: data.length },
      { name: "Оброблено", value: (counts.processed || 0) + (counts.generalized || 0) },
      { name: "Узагальнено", value: counts.generalized || 0 },
    ];
    document.getElementById("pipeline").innerHTML = stages
      .map((stage) => {
        const p = percent(stage.value, data.length);
        return `<div>
          <div class="stage-head"><span>${stage.name}</span><strong>${stage.value} (${p} %)</strong></div>
          <div class="stage-bar"><div class="stage-fill" style="width:${p}%"></div></div>
        </div>`;
      })
      .join("");
  }

  function replaceChart(id, config) {
    if (charts[id]) {
      charts[id].destroy();
    }
    charts[id] = new Chart(document.getElementById(id), config);
  }

  // Комбінований графік: стовпчики по добах + лінія наростаючого підсумку
  function updateAccumChart(data) {
    const byDay = {};
    for (let i = periodDays - 1; i >= 0; i--) {
      byDay[dayKey(new Date(Date.now() - i * 86400000))] = 0;
    }
    data.forEach((entry) => {
      const key = dayKey(entry.receivedAt);
      if (key in byDay) byDay[key]++;
    });
    const labels = Object.keys(byDay);
    const daily = Object.values(byDay);
    let running = 0;
    const cumulative = daily.map((value) => (running += value));

    replaceChart("accum-chart", {
      data: {
        labels,
        datasets: [
          { type: "bar", label: "За добу", data: daily, backgroundColor: COLOR_ACCENT, yAxisID: "y" },
          {
            type: "line",
            label: "Накопичено",
            data: cumulative,
            borderColor: COLOR_PRIMARY,
            backgroundColor: "rgba(0, 90, 52, 0.12)",
            fill: true,
            pointRadius: 0,
            tension: 0.2,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { beginAtZero: true, position: "left", title: { display: true, text: "за добу" } },
          y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "накопичено" } },
        },
      },
    });
  }

  function updateBarChart(id, counts) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    replaceChart(id, {
      type: "bar",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{ label: "Повідомлень", data: entries.map((e) => e[1]), backgroundColor: COLOR_PRIMARY }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  function updateDoughnut(id, counts) {
    const labels = Object.keys(counts).sort();
    replaceChart(id, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: labels.map((label) => counts[label]),
            backgroundColor: labels.map((_, index) => SERIES_COLORS[index % SERIES_COLORS.length]),
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  // Теплова матриця оцінки інформації (надійність × достовірність)
  function updateMatrix(data) {
    const cells = {};
    data.forEach((entry) => {
      const key = entry.reliability + entry.credibility;
      cells[key] = (cells[key] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(cells));

    let html = "<div></div>" + CREDIBILITY.map((c) => `<div class="axis">${c}</div>`).join("");
    RELIABILITY.forEach((r) => {
      html += `<div class="axis">${r}</div>`;
      CREDIBILITY.forEach((c) => {
        const value = cells[r + c] || 0;
        const alpha = value / max;
        const color = alpha > 0.55 ? "#ffffff" : "#333333";
        html += `<div style="background: rgba(0, 90, 52, ${alpha.toFixed(2)}); color:${color}">${value}</div>`;
      });
    });
    document.getElementById("admiralty").innerHTML = html;
  }

  // Іконка Leaflet з SVG-знаком milsymbol
  function milIcon(sidc, options) {
    const symbol = new ms.Symbol(sidc, { size: 26, ...options });
    const anchor = symbol.getAnchor();
    const size = symbol.getSize();
    return L.divIcon({
      className: "mil-icon",
      html: symbol.asSVG(),
      iconSize: [size.width, size.height],
      iconAnchor: [anchor.x, anchor.y],
    });
  }

  // Узагальнення для карти: повідомлення однієї категорії в одному районі
  // (квадрат GRID_STEP градусів) об'єднуються в один знак
  const GRID_STEP = 0.5;

  function groupByArea(data) {
    const groups = {};
    data.forEach((entry) => {
      const key = [
        entry.category,
        Math.floor(entry.lat / GRID_STEP),
        Math.floor(entry.lon / GRID_STEP),
      ].join("|");
      if (!groups[key]) {
        groups[key] = { category: entry.category, items: [] };
      }
      groups[key].items.push(entry);
    });
    return Object.values(groups).map((group) => {
      const n = group.items.length;
      return {
        category: group.category,
        count: n,
        lat: group.items.reduce((s, e) => s + e.lat, 0) / n,
        lon: group.items.reduce((s, e) => s + e.lon, 0) / n,
        reliable: group.items.filter(isReliable).length,
        sources: [...new Set(group.items.map((e) => e.source))],
        last: new Date(Math.max(...group.items.map((e) => e.receivedAt))),
      };
    });
  }

  // На карті — лише узагальнені повідомлення (підсумкова обстановка)
  function updateMap(data) {
    if (!map) {
      map = L.map("map").setView(MAP_CENTER, 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    }
    markersLayer.clearLayers();

    const generalized = data.filter((entry) => entry.status === "generalized" && !Number.isNaN(entry.lat));

    groupByArea(generalized).forEach((group) => {
      const sidc = CATEGORIES[group.category] || "SHGPU----------";
      // Підпис біля знака — кількість повідомлень; групи без достовірних відомостей напівпрозорі
      const icon = milIcon(sidc, {
        quantity: String(group.count),
        fillOpacity: group.reliable ? 1 : 0.4,
      });
      // Невеликий зсув за категорією, щоб знаки в одному районі не перекривались
      const shift = (Object.keys(CATEGORIES).indexOf(group.category) - 2) * 0.12;
      L.marker([group.lat, group.lon + shift], { icon })
        .bindPopup(
          `<strong>${group.category}</strong><br>` +
            `Повідомлень: ${group.count} (достовірних: ${group.reliable})<br>` +
            `Джерела: ${group.sources.join(", ")}<br>` +
            `Останнє: ${group.last.toLocaleString("uk-UA")}`
        )
        .addTo(markersLayer);
    });

    const legend = document.getElementById("map-legend");
    legend.innerHTML = Object.entries(CATEGORIES)
      .map(([name, sidc]) => `<div class="legend-item">${new ms.Symbol(sidc, { size: 16 }).asSVG()}<span>${name}</span></div>`)
      .join("");
  }

  // Журнал: останні 200 повідомлень, нові зверху
  function updateTable(data) {
    const tbody = document.querySelector("#records-table tbody");
    tbody.innerHTML = [...data]
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, 200)
      .map((entry) => {
        const status = STATUSES[entry.status] || { name: entry.status, css: "" };
        return `<tr>
          <td>${entry.receivedAt.toLocaleString("uk-UA")}</td>
          <td>${entry.source}</td>
          <td>${entry.category}</td>
          <td>${entry.reliability}${entry.credibility}</td>
          <td><span class="badge ${status.css}">${status.name}</span></td>
          <td>${entry.summary}</td>
        </tr>`;
      })
      .join("");
  }

  // ---------- Події ----------

  document.querySelectorAll(".period button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".period button").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      periodDays = Number(button.dataset.days);
      render();
    });
  });

  document.getElementById("refresh-btn").addEventListener("click", fetchData);

  fetchData();
  setInterval(fetchData, 30000); // Оновлення кожні 30 секунд
});
