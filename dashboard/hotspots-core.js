/* hotspots-core.js: the maths behind the Hotspots page, with no map or page code so it can be tested on its own
 * (node --test tests/js/hotspots.test.js).
 *
 * A hex grid is laid over the city (flat-to-flat width in metres) and every offense is dropped into the cell it falls in.
 * For each cell we keep: offenses per month, and which neighborhood and street the offenses were reported at,
 * so a cell can be described to a reader ("Dutchtown, near 3300 block of Gravois").
 *
 *   const cells = HOT.bin(records, { width: 250 })      records: { lat, lon, m: "YYYY-MM", nbhd, addr, masked }
 *   HOT.measure(cells, { months, prior, window })       counts for the period, the previous period and persistence
 */
(() => {
  "use strict";

  const LAT0 = 38.63, LON0 = -90.2, KY = 110540, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
  const SQRT3 = Math.sqrt(3);

  // pointy-top hexagons in axial coordinates (q, r); R is the centre-to-corner distance
  const radius = (width) => width / SQRT3;

  function cellOf(lat, lon, width) {
    const R = radius(width), x = (lon - LON0) * KX, y = (lat - LAT0) * KY;
    const fq = ((SQRT3 / 3) * x - y / 3) / R, fr = ((2 / 3) * y) / R;
    // round the fractional cube coordinates to the nearest hexagon
    let q = Math.round(fq), r = Math.round(fr), s = Math.round(-fq - fr);
    const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s + fq + fr);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return { q, r };
  }

  function centerOf(q, r, width) {
    const R = radius(width), x = R * SQRT3 * (q + r / 2), y = R * 1.5 * r;
    return { lat: LAT0 + y / KY, lon: LON0 + x / KX };
  }

  function cornersOf(q, r, width) {
    const R = radius(width), x0 = R * SQRT3 * (q + r / 2), y0 = R * 1.5 * r, out = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      out.push([LAT0 + (y0 + R * Math.sin(a)) / KY, LON0 + (x0 + R * Math.cos(a)) / KX]);
    }
    return out;
  }

  const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

  // Drop every located record into its cell. Masked records (sensitive offenses) count, but never name a street.
  function bin(records, { width = 250 } = {}) {
    const cells = new Map();
    for (const a of records) {
      if (a.lat == null || a.lon == null) continue;
      const { q, r } = cellOf(a.lat, a.lon, width), key = q + "," + r;
      let c = cells.get(key);
      if (!c) { c = { key, q, r, width, byMonth: new Map(), nbhds: new Map(), addrs: new Map() }; cells.set(key, c); }
      bump(c.byMonth, a.m);
      if (a.nbhd) bump(c.nbhds, a.nbhd);
      if (!a.masked && a.addr) bump(c.addrs, a.addr);
    }
    return cells;
  }

  const top = (map) => { let best = null, n = -1; for (const [k, v] of map) if (v > n) { best = k; n = v; } return best; };

  // The value at fraction p (0-1) of a list, e.g. p = 0.9 is the 90th percentile.
  function quantile(sorted, p) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  }

  // Counts per cell for the chosen months, the same number of months before them, and in how many of the recent months
  // the cell was among the busiest. Cells with nothing in any of these are dropped.
  function measure(cells, { months, prior = null, window = [] }) {
    const inP = new Set(months), inQ = prior ? new Set(prior) : null;
    // "busy" for a month = at or above the 90th percentile of the non-empty cell counts in the window (and at least 3)
    const all = [];
    for (const c of cells.values()) for (const m of window) { const n = c.byMonth.get(m); if (n) all.push(n); }
    all.sort((x, y) => x - y);
    const busy = Math.max(3, quantile(all, 0.9));
    const out = [];
    for (const c of cells.values()) {
      let n = 0, p = 0, high = 0;
      for (const [m, v] of c.byMonth) { if (inP.has(m)) n += v; if (inQ && inQ.has(m)) p += v; }
      for (const m of window) if ((c.byMonth.get(m) || 0) >= busy) high++;
      if (n || p || high) out.push({ ...c, n, prior: inQ ? p : null, change: inQ ? n - p : null, high });
    }
    return { cells: out, busy, windowMonths: window.length };
  }

  // A short, readable name for a cell: its main neighborhood and the street most offenses were reported at.
  function describe(c) {
    const nb = top(c.nbhds), addr = top(c.addrs);
    const block = addr ? addr.replace(/^(\d+)\s/, (m, d) => (Number(d) < 100 ? "" : `${Math.floor(Number(d) / 100) * 100} block of `)) : null;   // "0 block of" reads badly
    return { nbhd: nb, place: block ? title(block) : null };
  }

  function title(s) {
    return String(s).toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase()).replace(/\b(Of|Block)\b/g, (w) => w.toLowerCase());
  }

  // Cut points so each of `k` classes holds about the same number of values (quintiles for k = 5).
  function breaks(values, k = 5) {
    const v = [...values].sort((x, y) => x - y);
    return Array.from({ length: k - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / k)] ?? 0);
  }
  const classOf = (value, brk) => brk.filter((b) => value >= b).length;

  const api = { cellOf, centerOf, cornersOf, bin, measure, describe, quantile, breaks, classOf, title };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.HOT = api;
})();
