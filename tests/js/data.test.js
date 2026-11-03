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
    getCenter: () => ({ lat: 38.6, lng: -90.2 }), once: () => {}, fitBounds: () => {},
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

test("lockExtent sends a drag that ends off the city back to the whole-city view, and leaves other drags alone", () => {
  const h = {}, fits = [];
  let center = { lat: 38.6, lng: -90.2 };
  const map = {
    getSize: () => ({ x: 800, y: 600 }), getBoundsZoom: () => 11, setMinZoom() {}, setMaxBounds() {},
    on: (ev, fn) => { h[ev] = fn; }, once() {}, getCenter: () => center, fitBounds: (b, o) => fits.push([b, o]),
  };
  const city = [[38.5, -90.3], [38.7, -90.1]];
  CRIME.lockExtent(map, city);
  h.moveend();                                            // a move that was not a drag (zoom to a ward, pin drop): nothing happens
  assert.equal(fits.length, 0);
  h.dragend(); h.moveend();                               // a drag that ends with the center still over the city: stays put
  assert.equal(fits.length, 0);
  center = { lat: 38.75, lng: -90.2 };                    // dragged north of the city
  h.dragend(); h.moveend();
  assert.equal(fits.length, 1);
  assert.deepEqual(fits[0][0], city);
  assert.deepEqual(fits[0][1], { padding: [20, 20] });    // same padding as the Reset button
});

test("pct writes a change as an arrow and a sign, with no color needed", () => {
  assert.equal(CRIME.pct(112, 100), "▲ +12%");
  assert.equal(CRIME.pct(92, 100), "▼ −8%");
  assert.equal(CRIME.pct(100, 100), "No change");
  assert.equal(CRIME.pct(1000, 999), "No change");        // 0.1% rounds to 0%
  assert.equal(CRIME.pct(100, 99), "▲ +1%");
});

test("pct copes with nothing to compare against", () => {
  assert.equal(CRIME.pct(5, null), "–");
  assert.equal(CRIME.pct(5, 0), "new");
  assert.equal(CRIME.pct(0, 0), "–");
});
