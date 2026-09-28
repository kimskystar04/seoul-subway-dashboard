/* Loads the pre-processed dashboard JSON. The browser never reads the raw CSV. */
(function (root) {
  "use strict";

  async function loadDashboardData(url) {
    var target = url || "data/processed/dashboard_data.json";
    var res = await fetch(target);
    if (!res.ok) {
      throw new Error("대시보드 데이터를 불러오지 못했습니다 (" + res.status + ")");
    }
    return res.json();
  }

  root.SubwayData = { loadDashboardData: loadDashboardData };
})(window);
