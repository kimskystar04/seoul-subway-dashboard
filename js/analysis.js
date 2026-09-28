/*
 * Pure filter/aggregation functions for the Seoul subway dashboard.
 * No DOM access here so this file can run unmodified under Node's
 * built-in test runner (tests/analysis.test.js) and in the browser
 * (loaded as a plain <script>, exposing window.SubwayAnalysis).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SubwayAnalysis = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function filterRecords(records, options) {
    var opts = options || {};
    var startDate = opts.startDate;
    var endDate = opts.endDate;
    var line = opts.line;

    return records.filter(function (r) {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      if (line && line !== "ALL" && r.line !== line) return false;
      return true;
    });
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function isWeekday(dateStr) {
    var d = new Date(dateStr + "T00:00:00Z");
    var day = d.getUTCDay(); // 0 Sun .. 6 Sat
    return day >= 1 && day <= 5;
  }

  function dailyUsageMap(records) {
    var map = new Map();
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var usage = r.boardings + r.alightings;
      map.set(r.date, (map.get(r.date) || 0) + usage);
    }
    return map;
  }

  function computeWeekdayWeekendAverages(records) {
    var daily = dailyUsageMap(records);
    var weekdayTotal = 0,
      weekdayDays = 0,
      weekendTotal = 0,
      weekendDays = 0;

    daily.forEach(function (usage, date) {
      if (isWeekday(date)) {
        weekdayTotal += usage;
        weekdayDays += 1;
      } else {
        weekendTotal += usage;
        weekendDays += 1;
      }
    });

    return {
      weekdayAvg: weekdayDays ? round2(weekdayTotal / weekdayDays) : 0,
      weekendAvg: weekendDays ? round2(weekendTotal / weekendDays) : 0,
      weekdayDays: weekdayDays,
      weekendDays: weekendDays,
    };
  }

  function computeKPIs(records) {
    var boardings = 0,
      alightings = 0;
    for (var i = 0; i < records.length; i++) {
      boardings += records[i].boardings;
      alightings += records[i].alightings;
    }
    var averages = computeWeekdayWeekendAverages(records);

    return {
      totalBoardings: boardings,
      totalAlightings: alightings,
      totalUsage: boardings + alightings,
      weekdayDailyAverage: averages.weekdayAvg,
      weekendDailyAverage: averages.weekendAvg,
    };
  }

  function computeTopStations(records, n) {
    var limit = n || 10;
    var map = new Map();
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var usage = r.boardings + r.alightings;
      map.set(r.station, (map.get(r.station) || 0) + usage);
    }
    var list = [];
    map.forEach(function (total_usage, station) {
      list.push({ station: station, total_usage: total_usage });
    });
    list.sort(function (a, b) {
      return b.total_usage - a.total_usage;
    });
    return list.slice(0, limit);
  }

  function computeLineUsage(records) {
    var map = new Map();
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var usage = r.boardings + r.alightings;
      map.set(r.line, (map.get(r.line) || 0) + usage);
    }
    var list = [];
    map.forEach(function (total_usage, line) {
      list.push({ line: line, total_usage: total_usage });
    });
    list.sort(function (a, b) {
      return b.total_usage - a.total_usage;
    });
    return list;
  }

  function computeDailyUsage(records) {
    var map = dailyUsageMap(records);
    var list = [];
    map.forEach(function (total_usage, date) {
      list.push({ date: date, total_usage: total_usage });
    });
    list.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
    return list;
  }

  function getLines(records) {
    var set = new Set(
      records.map(function (r) {
        return r.line;
      })
    );
    return Array.from(set).sort();
  }

  function validateDateRange(startDate, endDate) {
    if (startDate && endDate && startDate > endDate) {
      return {
        valid: false,
        message: "시작일이 종료일보다 늦습니다. 필터가 적용되지 않았습니다.",
      };
    }
    return { valid: true, message: "" };
  }

  return {
    filterRecords: filterRecords,
    computeKPIs: computeKPIs,
    computeTopStations: computeTopStations,
    computeLineUsage: computeLineUsage,
    computeDailyUsage: computeDailyUsage,
    computeWeekdayWeekendAverages: computeWeekdayWeekendAverages,
    getLines: getLines,
    validateDateRange: validateDateRange,
    isWeekday: isWeekday,
  };
});
