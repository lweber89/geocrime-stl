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

test("lockExtent keeps the whole-city zoom as the minimum, sets no hard pan limit, and updates when the box is resized", () => {
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
  assert.equal(calls.maxBounds.length, 0, "a hard pan limit would push edge wards off-center");
  zoomFor = 12; size = { x: 1400, y: 900 }; handlers.resize();
  assert.deepEqual(calls.minZoom, [11, 12]);
  size = { x: 0, y: 0 }; handlers.resize();
  assert.deepEqual(calls.minZoom, [11, 12], "an unlaid-out box leaves the last minimum alone");
});

test("lockExtent sends any move that ends with the map center off the city back to the whole-city view", () => {
  const h = {}, fits = [];
  let center = { lat: 38.6, lng: -90.2 };
  const map = {
    getSize: () => ({ x: 800, y: 600 }), getBoundsZoom: () => 11, setMinZoom() {},
    on: (ev, fn) => { h[ev] = fn; }, once() {}, getCenter: () => center, fitBounds: (b, o) => fits.push([b, o]),
  };
  const city = [[38.5, -90.3], [38.7, -90.1]];
  CRIME.lockExtent(map, city);
  h.moveend();                                            // a move that ends over the city (ward zoom, pin drop, small pan): stays put
  assert.equal(fits.length, 0);
  center = { lat: 38.75, lng: -90.2 };                    // ends north of the city, however it got there (drag, keyboard)
  h.moveend();
  assert.equal(fits.length, 1);
  assert.deepEqual(fits[0][0], city);
  assert.deepEqual(fits[0][1], { padding: [20, 20] });    // same padding as the Reset button
});

test("pct writes a change as a sign and a number, with no color needed", () => {
  assert.equal(CRIME.pct(112, 100), "+12%");
  assert.equal(CRIME.pct(92, 100), "−8%");
  assert.equal(CRIME.pct(100, 100), "No change");
  assert.equal(CRIME.pct(1000, 999), "No change");        // 0.1% rounds to 0%
  assert.equal(CRIME.pct(100, 99), "+1%");
});

test("pct shows a count, not a percentage, when the earlier period was small", () => {
  assert.equal(CRIME.MIN_BASE, 10);
  assert.equal(CRIME.pct(6, 3), "+3 offenses");
  assert.equal(CRIME.pct(4, 3), "+1 offense");
  assert.equal(CRIME.pct(1, 9), "−8 offenses");
  assert.equal(CRIME.pct(3, 3), "No change");
  assert.equal(CRIME.pct(12, 10), "+20%");               // 10 is enough for a percentage
  assert.equal(CRIME.pct(8, 9), "−1 offense");
});

test("pct copes with nothing to compare against", () => {
  assert.equal(CRIME.pct(5, null), "–");
  assert.equal(CRIME.pct(5, 0), "new");
  assert.equal(CRIME.pct(0, 0), "–");
});

test("dataNote says what data is available, so it is not read as the chosen period", () => {
  const months = [{ m: "2024-01" }, { m: "2026-09" }];
  assert.equal(CRIME.dataNote(months), "Data available: Jan 2024 – Sep 2026 · Updated monthly.");
});

// ---- Group B (arrest-only) offenses: left out unless the link says gb=1 ----
const feed = (withTable) => {
  const manifest = {
    built: "1", through: "2026-09-30", completeThrough: "2026-09", months: [{ m: "2026-09", n: 4 }],
    ...(withTable ? { categories: [
      { cat: "Robbery", code: "120", group: "Property", violent: 1 },
      { cat: "Simple Assault", code: "13B", group: "Persons", violent: 0 },
      { cat: "Trespass of Real Property", code: "90J", group: "Group B", violent: 0 },
      { cat: "All Other Offenses", code: "90Z", group: "Group B", violent: 0 },
    ] } : {}),
  };
  const month = {
    m: "2026-09",
    d: { type: ["Property", "Person", "Society"], cat: ["Robbery", "Simple Assault", "Trespass of Real Property", "All Other Offenses"],
         off: ["x"], nbhd: ["Downtown"], ward: ["1"] },
    r: [[1, "2026-09-01T10:00", 38.6, -90.2, "1 MAIN ST", 0, 0, 0, 0, "1", 0, 0, 0, 0],
        [2, "2026-09-02T10:00", 38.6, -90.2, "2 MAIN ST", 1, 1, 0, 0, "1", 0, 0, 0, 0],
        [3, "2026-09-03T10:00", 38.6, -90.2, "3 MAIN ST", 2, 2, 0, 0, "1", 0, 0, 0, 0],
        [4, "2026-09-04T10:00", 38.6, -90.2, "4 MAIN ST", 2, 3, 0, 0, "1", 0, 0, 0, 0]],
  };
  return async (url) => ({ ok: true, json: async () => (url.includes("manifest") ? manifest : url.includes("2026-09") ? month : {}) });
};
const withFeed = async (withTable, hash, opts) => {
  global.fetch = feed(withTable); global.location = { hash }; 
  try { return await CRIME.load(opts); } finally { delete global.fetch; delete global.location; }
};

test("Group B offenses are left out by default, and the page says how many", async () => {
  const D = await withFeed(true, "");
  assert.deepEqual(D.records.map((a) => a.cat), ["Robbery", "Simple Assault"]);
  assert.equal(D.includeGroupB, false);
  assert.equal(D.groupBLeftOut, 2);
  assert.ok(!D.cats.Society, "no category menu entry for a group that is left out");
});

test("gb=1 in the link brings Group B back, and rows keep their ids", async () => {
  const D = await withFeed(true, "#gb=1");
  assert.equal(D.records.length, 4);
  assert.equal(D.includeGroupB, true);
  assert.equal(D.records[2].id, "2026-09-2");
  const off = await withFeed(true, "");
  assert.equal(off.records[1].id, "2026-09-1", "ids do not depend on the choice");
});

test("each row carries its NIBRS group and the FBI violent flag", async () => {
  const D = await withFeed(true, "#gb=1");
  assert.deepEqual(D.records.map((a) => [a.group, a.violent]), [["Property", true], ["Persons", false], ["Group B", false], ["Group B", false]]);
});

test("a feed without the category table (or a brand-new category) still shows everything", async () => {
  const D = await withFeed(false, "");
  assert.equal(D.records.length, 4);
  assert.ok(D.records.every((a) => a.group === null && a.violent === false));
});

test("carryGroupB keeps the choice in a rewritten link only when it is on", async () => {
  await withFeed(true, "#gb=1");
  const p = new URLSearchParams(); CRIME.carryGroupB(p);
  assert.equal(p.get("gb"), "1");
  await withFeed(true, "");
  const q = new URLSearchParams(); CRIME.carryGroupB(q);
  assert.equal(q.has("gb"), false);
});
