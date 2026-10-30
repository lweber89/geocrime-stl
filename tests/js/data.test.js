const test = require("node:test");
const assert = require("node:assert/strict");
const CRIME = require("../../dashboard/data.js");

test("span names the first and last month the data covers", () => {
  const months = [{ m: "2024-01" }, { m: "2024-02" }, { m: "2026-09" }];
  assert.equal(CRIME.span(months), "Jan 2024 – Sep 2026");
});

test("span copes with a single month and with December", () => {
  assert.equal(CRIME.span([{ m: "2026-12" }]), "Dec 2026 – Dec 2026");
});
