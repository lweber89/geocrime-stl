const test = require("node:test");
const assert = require("node:assert/strict");
const HOT = require("../../dashboard/hotspots-core.js");

const dist = (a, b) => Math.hypot((a.lat - b.lat) * 110540, (a.lon - b.lon) * 111320 * Math.cos((38.63 * Math.PI) / 180));

test("a cell's centre falls back into the same cell, and neighbours are one width apart", () => {
  for (const [q, r] of [[0, 0], [5, -3], [-12, 20]]) {
    const c = HOT.centerOf(q, r, 250);
    assert.deepEqual(HOT.cellOf(c.lat, c.lon, 250), { q, r });
  }
  const a = HOT.centerOf(3, 4, 250);
  for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]]) assert.ok(Math.abs(dist(a, HOT.centerOf(3 + dq, 4 + dr, 250)) - 250) < 1);
});

test("points near a corner still land in the cell whose centre is closest", () => {
  const w = 250;
  for (let i = 0; i < 500; i++) {
    const lat = 38.55 + Math.random() * 0.2, lon = -90.3 + Math.random() * 0.15;
    const { q, r } = HOT.cellOf(lat, lon, w);
    const d = dist({ lat, lon }, HOT.centerOf(q, r, w));
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]])
      assert.ok(d <= dist({ lat, lon }, HOT.centerOf(q + dq, r + dr, w)) + 1e-6);
  }
});

test("corners form a hexagon of the right width", () => {
  const c = HOT.cornersOf(0, 0, 250);
  assert.equal(c.length, 6);
  const [a, b] = [c[0], c[3]];                      // opposite corners are 2R apart, R = 250 / sqrt(3)
  assert.ok(Math.abs(dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }) - (2 * 250) / Math.sqrt(3)) < 1);
});

const rec = (m, over = {}) => ({ lat: 38.63, lon: -90.2, m, nbhd: "Downtown", addr: "1234 MARKET ST", masked: false, ...over });

test("bin counts by month and never names a street for masked offenses", () => {
  const cells = HOT.bin([rec("2026-01"), rec("2026-01"), rec("2026-02", { masked: true, addr: "" }), rec("2026-02", { lat: null })]);
  assert.equal(cells.size, 1);
  const c = [...cells.values()][0];
  assert.equal(c.byMonth.get("2026-01"), 2);
  assert.equal(c.byMonth.get("2026-02"), 1, "masked offenses still count");
  assert.equal([...c.addrs.values()].reduce((a, b) => a + b, 0), 2, "only the two unmasked ones name a street");
  assert.deepEqual(HOT.describe(c), { nbhd: "Downtown", place: "1200 block of Market St" });
});

test("measure: period, previous period and months among the busiest", () => {
  const rows = [];
  for (const [m, n] of [["2026-01", 1], ["2026-02", 1], ["2026-03", 6], ["2026-04", 7]]) for (let i = 0; i < n; i++) rows.push(rec(m));
  for (let i = 0; i < 2; i++) rows.push(rec("2026-04", { lat: 38.7, lon: -90.25 }));        // a quiet cell elsewhere
  const cells = HOT.bin(rows);
  const r = HOT.measure(cells, { months: ["2026-03", "2026-04"], prior: ["2026-01", "2026-02"], window: ["2026-01", "2026-02", "2026-03", "2026-04"] });
  const busy = r.cells.find((c) => c.n === 13), quiet = r.cells.find((c) => c.n === 2);
  assert.equal(busy.prior, 2);
  assert.equal(busy.change, 11);
  assert.equal(quiet.change, 2);
  assert.equal(r.busy, 7, "90th percentile of the non-empty cell-months (1, 1, 2, 6, 7)");
  assert.equal(busy.high, 1, "only April reaches the busy line");
  assert.equal(quiet.high, 0);
  const none = HOT.measure(cells, { months: ["2026-03"], prior: null, window: [] });
  assert.equal(none.cells[0].prior, null);
});

test("breaks and classes split values into equal-sized groups", () => {
  const brk = HOT.breaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert.deepEqual(brk, [3, 5, 7, 9]);
  assert.equal(HOT.classOf(1, brk), 0);
  assert.equal(HOT.classOf(10, brk), 4);
});

test("addresses below 100 are not called the 0 block", () => {
  const c = HOT.bin([rec("2026-01", { addr: "0 FINE ARTS DR" })]).values().next().value;
  assert.equal(HOT.describe(c).place, "Fine Arts Dr");
});
