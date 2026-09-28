(function () {
  "use strict";

  var state = { raw: null, records: [], lines: [] };
  var charts = { topStations: null, lineUsage: null, dailyUsage: null };
  var els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    els.startDate = qs("start-date");
    els.endDate = qs("end-date");
    els.lineSelect = qs("line-select");
    els.resetBtn = qs("reset-filters");
    els.filterMessage = qs("filter-message");
    els.themeToggle = qs("theme-toggle");
    els.kpiBoardings = qs("kpi-boardings");
    els.kpiAlightings = qs("kpi-alightings");
    els.kpiUsage = qs("kpi-usage");
    els.kpiWeekdayAvg = qs("kpi-weekday-avg");
    els.kpiWeekendAvg = qs("kpi-weekend-avg");
    els.tableBody = qs("detail-table-body");
    els.tableNote = qs("detail-table-note");
    els.emptyState = qs("empty-state");
    els.dashboardContent = qs("dashboard-content");
  }

  function formatNumber(n) {
    return new Intl.NumberFormat("ko-KR").format(n);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("subway-dashboard-theme", theme);
    } catch (e) {
      /* private mode / storage disabled: ignore */
    }
    els.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    els.themeToggle.textContent = theme === "dark" ? "☀ 라이트 모드" : "🌙 다크 모드";
  }

  function initTheme() {
    var stored = null;
    try {
      stored = localStorage.getItem("subway-dashboard-theme");
    } catch (e) {
      stored = null;
    }
    var prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored || (prefersDark ? "dark" : "light"));
  }

  function populateLineOptions(lines) {
    els.lineSelect.innerHTML = "";
    var allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.textContent = "전체 노선";
    els.lineSelect.appendChild(allOpt);
    lines.forEach(function (line) {
      var opt = document.createElement("option");
      opt.value = line;
      opt.textContent = line;
      els.lineSelect.appendChild(opt);
    });
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function renderTopStationsChart(data) {
    destroyChart("topStations");
    var ctx = qs("chart-top-stations").getContext("2d");
    charts.topStations = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(function (d) {
          return d.station;
        }),
        datasets: [
          {
            label: "이용량 (승차+하차)",
            data: data.map(function (d) {
              return d.total_usage;
            }),
            backgroundColor: "#2563eb",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { callback: formatNumber } } },
      },
    });
  }

  function renderLineUsageChart(data) {
    destroyChart("lineUsage");
    var ctx = qs("chart-line-usage").getContext("2d");
    charts.lineUsage = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(function (d) {
          return d.line;
        }),
        datasets: [
          {
            label: "노선별 이용량",
            data: data.map(function (d) {
              return d.total_usage;
            }),
            backgroundColor: "#0d9488",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: formatNumber } } },
      },
    });
  }

  function renderDailyUsageChart(data) {
    destroyChart("dailyUsage");
    var ctx = qs("chart-daily-usage").getContext("2d");
    charts.dailyUsage = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(function (d) {
          return d.date;
        }),
        datasets: [
          {
            label: "날짜별 이용량",
            data: data.map(function (d) {
              return d.total_usage;
            }),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.25)",
            tension: 0.2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: formatNumber } } },
      },
    });
  }

  function renderTable(records) {
    var MAX_ROWS = 500;
    var sorted = records.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.boardings + b.alightings - (a.boardings + a.alightings);
    });

    var shown = sorted.slice(0, MAX_ROWS);
    els.tableBody.innerHTML = "";
    var frag = document.createDocumentFragment();
    shown.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        r.date +
        "</td><td>" +
        r.line +
        "</td><td>" +
        r.station +
        "</td><td>" +
        formatNumber(r.boardings) +
        "</td><td>" +
        formatNumber(r.alightings) +
        "</td><td>" +
        formatNumber(r.boardings + r.alightings) +
        "</td>";
      frag.appendChild(tr);
    });
    els.tableBody.appendChild(frag);

    els.tableNote.textContent =
      sorted.length > MAX_ROWS
        ? "전체 " + formatNumber(sorted.length) + "건 중 상위 " + formatNumber(MAX_ROWS) + "건을 표시합니다."
        : "전체 " + formatNumber(sorted.length) + "건을 표시합니다.";
  }

  function renderKPIs(kpis) {
    els.kpiBoardings.textContent = formatNumber(kpis.totalBoardings);
    els.kpiAlightings.textContent = formatNumber(kpis.totalAlightings);
    els.kpiUsage.textContent = formatNumber(kpis.totalUsage);
    els.kpiWeekdayAvg.textContent = formatNumber(kpis.weekdayDailyAverage);
    els.kpiWeekendAvg.textContent = formatNumber(kpis.weekendDailyAverage);
  }

  function render() {
    var A = window.SubwayAnalysis;
    var startDate = els.startDate.value || null;
    var endDate = els.endDate.value || null;
    var line = els.lineSelect.value || "ALL";

    var validation = A.validateDateRange(startDate, endDate);
    if (!validation.valid) {
      els.filterMessage.textContent = validation.message;
      els.filterMessage.hidden = false;
      els.dashboardContent.hidden = true;
      els.emptyState.hidden = true;
      return;
    }
    els.filterMessage.textContent = "";
    els.filterMessage.hidden = true;

    var filtered = A.filterRecords(state.records, { startDate: startDate, endDate: endDate, line: line });

    if (filtered.length === 0) {
      els.dashboardContent.hidden = true;
      els.emptyState.hidden = false;
      return;
    }
    els.emptyState.hidden = true;
    els.dashboardContent.hidden = false;

    renderKPIs(A.computeKPIs(filtered));
    renderTopStationsChart(A.computeTopStations(filtered, 10));
    renderLineUsageChart(A.computeLineUsage(filtered));
    renderDailyUsageChart(A.computeDailyUsage(filtered));
    renderTable(filtered);
  }

  function bindEvents() {
    els.startDate.addEventListener("change", render);
    els.endDate.addEventListener("change", render);
    els.lineSelect.addEventListener("change", render);
    els.resetBtn.addEventListener("click", function () {
      els.startDate.value = state.raw.metadata.date_start;
      els.endDate.value = state.raw.metadata.date_end;
      els.lineSelect.value = "ALL";
      render();
    });
    els.themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  async function init() {
    cacheEls();
    initTheme();

    try {
      var data = await window.SubwayData.loadDashboardData();
      state.raw = data;
      state.records = data.records;
      state.lines = window.SubwayAnalysis.getLines(data.records);

      populateLineOptions(state.lines);
      els.startDate.value = data.metadata.date_start;
      els.startDate.min = data.metadata.date_start;
      els.startDate.max = data.metadata.date_end;
      els.endDate.value = data.metadata.date_end;
      els.endDate.min = data.metadata.date_start;
      els.endDate.max = data.metadata.date_end;
      els.lineSelect.value = "ALL";

      bindEvents();
      render();
    } catch (err) {
      els.filterMessage.textContent = "데이터를 불러오는 중 오류가 발생했습니다: " + err.message;
      els.filterMessage.hidden = false;
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
