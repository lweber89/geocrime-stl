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

test("lockExtent keeps the whole-city zoom as the minimum and limits panning, and updates when the box is resized", () => {
  const calls = { minZoom: [], maxBounds: [] }, handlers = {};
  let size = { x: 800, y: 600 }, zoomFor = 11;
  const map = {
    getSize: () => size, getBoundsZoom: () => zoomFor,
    setMinZoom: (z) => calls.minZoom.push(z), setMaxBounds: (b) => calls.maxBounds.push(b),
    on: (ev, fn) => { handlers[ev] = fn; },
  };
  CRIME.lockExtent(map, [[38.5, -90.3], [38.7, -90.1]]);
  assert.deepEqual(calls.minZoom, [11]);
  const [b] = calls.maxBounds;
  assert.ok(b[0][0] < 38.5 && b[0][1] < -90.3 && b[1][0] > 38.7 && b[1][1] > -90.1, "pan limit is a little larger than the city");
  zoomFor = 12; size = { x: 1400, y: 900 }; handlers.resize();
  assert.deepEqual(calls.minZoom, [11, 12]);
  size = { x: 0, y: 0 }; handlers.resize();
  assert.deepEqual(calls.minZoom, [11, 12], "an unlaid-out box leaves the last minimum alone");
});
