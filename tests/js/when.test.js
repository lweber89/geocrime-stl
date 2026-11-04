const test = require("node:test");
const assert = require("node:assert/strict");
const WHEN = require("../../dashboard/when.js");

// Jan 2024 .. Sep 2026, the way the real feed looks today
const months = (from, to) => { const out = []; for (let k = from; k <= to; k = WHEN.addMonths(k, 1)) out.push(k); return out; };
const KEYS = months("2024-01", "2026-09");

test("presets resolve to the right months", () => {
  assert.deepEqual(WHEN.resolve("latest", KEYS).months, ["2026-09"]);
  assert.deepEqual(WHEN.resolve("l3", KEYS).months, ["2026-07", "2026-08", "2026-09"]);
  assert.equal(WHEN.resolve("l6", KEYS).n, 6);
  assert.equal(WHEN.resolve("l12", KEYS).from, "2025-10");
  assert.equal(WHEN.resolve("l24", KEYS).from, "2024-10");
  assert.equal(WHEN.resolve("all", KEYS).n, 33);
  assert.equal(WHEN.resolve("ytd", KEYS).from, "2026-01");
  assert.equal(WHEN.resolve("ytd", KEYS).n, 9);
});

test("a preset longer than the data shows all the data", () => {
  const short = months("2026-05", "2026-09");
  assert.equal(WHEN.resolve("l12", short).n, 5);
  assert.equal(WHEN.resolve("ytd", short).from, "2026-05", "year to date starts at the first month if the year began before the data");
});

test("one month and spans resolve, clamp to the data, and reject what is not there", () => {
  assert.deepEqual(WHEN.resolve("2025-03", KEYS).months, ["2025-03"]);
  assert.equal(WHEN.resolve("2023-12", KEYS), null, "a month before the data");
  assert.equal(WHEN.resolve("2026-10", KEYS), null, "a month after the data");
  assert.equal(WHEN.resolve("2025-03..2025-05", KEYS).n, 3);
  assert.equal(WHEN.resolve("2023-06..2024-02", KEYS).from, "2024-01", "a span is clamped to the data");
  assert.equal(WHEN.resolve("2023-06..2023-09", KEYS), null, "a span wholly outside the data");
  assert.equal(WHEN.resolve("2025-05..2025-03", KEYS), null, "a backwards span");
  assert.equal(WHEN.resolve("banana", KEYS), null);
  assert.equal(WHEN.resolve("l6", []), null);
});

test("the comparison for a preset is the same number of months immediately before", () => {
  const p = WHEN.prior("l6", KEYS);
  assert.deepEqual([p.months[0], p.months.at(-1), p.n], ["2025-10", "2026-03", 6]);
  assert.equal(p.label, "the previous 6 months");
  const one = WHEN.prior("latest", KEYS);
  assert.deepEqual(one.months, ["2026-08"]);
  assert.equal(one.label, "Aug 2026");
});

test("Year to date is compared with the same months of the previous year", () => {
  const p = WHEN.prior("ytd", KEYS);
  assert.deepEqual(p.months, months("2025-01", "2025-09"));
  assert.equal(p.label, "the same months of 2025");
});

test("Year to date has no comparison when the data does not reach back a full year", () => {
  assert.equal(WHEN.prior("ytd", months("2024-01", "2024-09")), null, "nothing before January 2024");
  assert.equal(WHEN.prior("ytd", months("2025-03", "2025-09")), null, "the data starts in March, so the year to date is not a full run from January");
});

test("no comparison when the earlier months are not all in the data", () => {
  assert.equal(WHEN.prior("all", KEYS), null);
  assert.equal(WHEN.prior("l24", months("2025-01", "2026-09")), null);
  assert.ok(WHEN.prior("l12", KEYS));
  assert.equal(WHEN.prior("2024-01", KEYS), null);
  assert.deepEqual(WHEN.prior("2024-02", KEYS).months, ["2024-01"]);
  assert.equal(WHEN.prior("nonsense", KEYS), null);
});

test("a span is compared with the equal number of months right before it", () => {
  const p = WHEN.prior("2026-03..2026-09", KEYS);
  assert.equal(p.n, 7);
  assert.deepEqual([p.months[0], p.months.at(-1)], ["2025-08", "2026-02"]);
});

test("labels and date lines read plainly", () => {
  assert.equal(WHEN.label("latest", KEYS), "Latest month (Sep 2026)");
  assert.equal(WHEN.label("l6", KEYS), "Last 6 months");
  assert.equal(WHEN.label("ytd", KEYS), "Year to date");
  assert.equal(WHEN.label("all", KEYS), "All data");
  assert.equal(WHEN.label("2025-03", KEYS), "Mar 2025");
  assert.equal(WHEN.label("2025-03..2025-09", KEYS), "Mar – Sep 2025");
  assert.equal(WHEN.label("2025-11..2026-02", KEYS), "Nov 2025 – Feb 2026");
  assert.equal(WHEN.dates("l6", KEYS), "Apr – Sep 2026");
  assert.equal(WHEN.dates("l12", KEYS), "Oct 2025 – Sep 2026");
  assert.equal(WHEN.dates("latest", KEYS), "Sep 2026");
  assert.equal(WHEN.label("banana", KEYS), "");
});

test("the panel offers six presets in the agreed order", () => {
  assert.deepEqual(WHEN.presets(KEYS).map((p) => p.when), ["latest", "l3", "l6", "l12", "ytd", "all"]);
});

test("the month grid has a row per year and marks months the data does not have", () => {
  const g = WHEN.grid(KEYS);
  assert.deepEqual(g.map((y) => y.year), [2024, 2025, 2026]);
  assert.ok(g.every((y) => y.months.length === 12));
  assert.equal(g[0].months[0].has, true);
  assert.equal(g[2].months[8].has, true);
  assert.equal(g[2].months[9].has, false, "October 2026 is not in the data yet");
  assert.equal(g[2].months[9].key, "2026-10");
  assert.deepEqual(WHEN.grid([]), []);
});
