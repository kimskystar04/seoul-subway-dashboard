const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../js/analysis.js");

// Mon 2026-08-03, Sat 2026-08-08, Sun 2026-08-09
const records = [
  { date: "2026-08-03", line: "2호선", station: "강남", boardings: 100, alightings: 80 },
  { date: "2026-08-03", line: "2호선", station: "잠실(송파구청)", boardings: 50, alightings: 40 },
  { date: "2026-08-03", line: "9호선", station: "강남", boardings: 10, alightings: 5 },
  { date: "2026-08-08", line: "2호선", station: "강남", boardings: 30, alightings: 20 },
  { date: "2026-08-09", line: "9호선", station: "잠실(송파구청)", boardings: 15, alightings: 5 },
];

test("filterRecords: date range", () => {
  const out = A.filterRecords(records, { startDate: "2026-08-08", endDate: "2026-08-09" });
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => r.date >= "2026-08-08" && r.date <= "2026-08-09"));
});

test("filterRecords: line filter", () => {
  const out = A.filterRecords(records, { line: "9호선" });
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => r.line === "9호선"));
});

test("filterRecords: ALL line keeps everything", () => {
  const out = A.filterRecords(records, { line: "ALL" });
  assert.equal(out.length, records.length);
});

test("computeKPIs: totals", () => {
  const kpis = A.computeKPIs(records);
  assert.equal(kpis.totalBoardings, 100 + 50 + 10 + 30 + 15);
  assert.equal(kpis.totalAlightings, 80 + 40 + 5 + 20 + 5);
  assert.equal(kpis.totalUsage, kpis.totalBoardings + kpis.totalAlightings);
});

test("computeWeekdayWeekendAverages: splits Mon-Fri vs Sat-Sun", () => {
  const { weekdayAvg, weekendAvg, weekdayDays, weekendDays } = A.computeWeekdayWeekendAverages(records);
  // 2026-08-03 is a Monday -> weekday usage = 100+80+50+40+10+5 = 285
  // 2026-08-08 Sat = 30+20=50, 2026-08-09 Sun = 15+5=20 -> weekend total 70 over 2 days
  assert.equal(weekdayDays, 1);
  assert.equal(weekendDays, 2);
  assert.equal(weekdayAvg, 285);
  assert.equal(weekendAvg, 35);
});

test("computeTopStations: merges same station name across lines", () => {
  const top = A.computeTopStations(records, 10);
  const gangnam = top.find((s) => s.station === "강남");
  // 강남 appears on 2호선 (100+80) + 9호선 (10+5) + 2호선 08-08 (30+20) = 245
  assert.equal(gangnam.total_usage, 100 + 80 + 10 + 5 + 30 + 20);
  assert.ok(top[0].total_usage >= top[1].total_usage);
});

test("computeLineUsage: groups by line", () => {
  const lines = A.computeLineUsage(records);
  const line2 = lines.find((l) => l.line === "2호선");
  const line9 = lines.find((l) => l.line === "9호선");
  assert.equal(line2.total_usage, 100 + 80 + 50 + 40 + 30 + 20);
  assert.equal(line9.total_usage, 10 + 5 + 15 + 5);
});

test("computeDailyUsage: sorted ascending by date", () => {
  const daily = A.computeDailyUsage(records);
  const dates = daily.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());
  const first = daily.find((d) => d.date === "2026-08-03");
  assert.equal(first.total_usage, 100 + 80 + 50 + 40 + 10 + 5);
});

test("getLines: unique sorted list", () => {
  assert.deepEqual(A.getLines(records), ["2호선", "9호선"]);
});

test("validateDateRange: start after end is invalid", () => {
  const result = A.validateDateRange("2026-08-10", "2026-08-01");
  assert.equal(result.valid, false);
  assert.ok(result.message.length > 0);
});

test("validateDateRange: start before end is valid", () => {
  const result = A.validateDateRange("2026-08-01", "2026-08-10");
  assert.equal(result.valid, true);
});

test("filterRecords: single-day selection still yields usable KPIs", () => {
  const out = A.filterRecords(records, { startDate: "2026-08-08", endDate: "2026-08-08" });
  assert.equal(out.length, 1);
  const kpis = A.computeKPIs(out);
  assert.equal(kpis.totalUsage, 30 + 20);
});

test("filterRecords: filter producing zero results", () => {
  const out = A.filterRecords(records, { startDate: "2026-09-01", endDate: "2026-09-30" });
  assert.equal(out.length, 0);
});
