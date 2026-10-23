/* hotspots.js: the Hotspots page. A hexagon map plus ranked lists (hot spots, neighborhoods, wards, blocks).
 * The maths (grid, counting, busy-month test) is in hotspots-core.js; this file is the page.
 * Offense category, firearm and period are kept in the page link, shared with the map and charts pages.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const num = (n) => Number(n).toLocaleString("en-US");
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monLabel = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const CITY_BOUNDS = [[38.532, -90.32], [38.774, -90.166]];
  const HEX_WIDTH = 250;                 // metres, flat to flat
  const MIN_CELL = 5;                    // cells with fewer offenses in the period are left blank
  const MIN_RATE_POP = 500;              // neighborhoods with fewer residents get a count but no rate
  const WINDOW = 12;                     // months looked at for "busy month after month"
  const RAMP = ["#fff1d6", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"];           // same fifths as the map's ward and neighborhood shading
  const UP = ["#fc8d59", "#d7301f"], DOWN = ["#8db8e8", "#2b6cb0"], FLAT = "#d9d7cf";
  const MAP_RANGE = { p3: "last3", p6: "last6", p12: "last12", p24: "all", all: "all" };
  const PERIOD_N = { p3: 3, p6: 6, p12: 12, p24: 24 };

  let D, map, hexLayer, hexByKey = new Map(), st = { cat: "", fa: false, per: "p12", tab: "hex", mode: "count", sort: "rate" };
  let view = null;                       // everything computed for the current filters

  // ------------------------------------------------------------ state in the page link
  function readState() {
    const p = new URLSearchParams(location.hash.slice(1));
    st.cat = p.get("cat") || ""; st.fa = p.get("fa") === "1";
    st.per = PERIOD_N[p.get("per")] || p.get("per") === "all" ? p.get("per") : "p12";
    st.tab = ["hex", "nbhd", "ward", "block"].includes(p.get("tab")) ? p.get("tab") : "hex";
    st.mode = ["count", "change", "chronic"].includes(p.get("mode")) ? p.get("mode") : "count";
  }
  function writeState() {
    const p = new URLSearchParams();
    if (st.cat) p.set("cat", st.cat);
    if (st.fa) p.set("fa", "1");
    const shared = p.toString();                                    // what the other pages understand
    if (st.per !== "p12") p.set("per", st.per);
    if (st.tab !== "hex") p.set("tab", st.tab);
    if (st.mode !== "count") p.set("mode", st.mode);
    history.replaceState(null, "", p.toString() ? "#" + p : location.pathname);
    const map1 = document.querySelector('a[data-nav="map"]'), ch = document.querySelector('a[data-nav="charts"]');
    if (map1) map1.href = "./" + (shared ? "#" + shared : "");
    if (ch) ch.href = "charts.html" + (shared || st.per !== "p12" ? "#" + new URLSearchParams([...new URLSearchParams(shared), ...(st.per !== "p12" ? [["per", st.per]] : [])]) : "");
  }
  const mapHash = (extra = {}) => {                                  // a link into the crime map that keeps the filters
    const p = new URLSearchParams();
    if (st.cat) p.set("cat", st.cat);
    if (st.fa) p.set("fa", "1");
    for (const [k, v] of Object.entries(extra)) if (v !== "" && v != null) p.set(k, v);
    return "./#" + p;
  };

  // ------------------------------------------------------------ numbers for the current filters
  function compute() {
    const keys = D.months.map((x) => x.m);
    const n = st.per === "all" ? keys.length : Math.min(PERIOD_N[st.per], keys.length);
    const months = keys.slice(keys.length - n);
    const priorKeys = keys.length - 2 * n >= 0 ? keys.slice(keys.length - 2 * n, keys.length - n) : null;
    const window = keys.slice(-WINDOW);
    const recs = D.records.filter((a) => (!st.cat || a.cat === st.cat) && (!st.fa || a.firearm));
    const cells = HOT.bin(recs, { width: HEX_WIDTH });
    const meas = HOT.measure(cells, { months, prior: priorKeys, window });
    view = { keys, n, months, priorKeys, window, recs, ...meas, inP: new Set(months), inQ: priorKeys ? new Set(priorKeys) : null };
  }

  // ------------------------------------------------------------ the hexagon map
  function styleFor(c) {
    const m = st.mode;
    if (m === "count") {
      if (c.n < MIN_CELL) return null;
      return RAMP[HOT.classOf(c.n, view.countBreaks)];
    }
    if (m === "change") {
      if (c.prior == null || Math.max(c.n, c.prior) < MIN_CELL) return null;
      const d = c.change, lo = Math.max(2, Math.ceil(view.tau / 3));
      return d >= view.tau ? UP[1] : d >= lo ? UP[0] : d <= -view.tau ? DOWN[1] : d <= -lo ? DOWN[0] : FLAT;
    }
    if (!c.high) return null;
    return RAMP[Math.min(4, Math.ceil(c.high / (view.windowMonths / 5)) - 1)];
  }

  function describeCell(c) {
    const d = HOT.describe(c);
    return [d.place, d.nbhd].filter(Boolean).join(", ") || "Location withheld";
  }

  function cellTip(c) {
    const change = c.prior == null ? "" : `<br>${pctText(c.n, c.prior)} vs. the previous ${view.n} months (${num(c.prior)})`;
    return `<strong>${esc(describeCell(c))}</strong><br>${num(c.n)} offenses in the period${change}<br>${c.high} of the last ${view.windowMonths} months among the busiest`;
  }

  function pctText(n, prior) {
    if (prior == null) return "–";
    if (!prior) return n ? "new" : "–";
    const p = Math.round((100 * (n - prior)) / prior);
    return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) + "%";
  }

  function renderMap() {
    if (hexLayer) { map.removeLayer(hexLayer); hexLayer = null; }
    hexByKey = new Map();
    const shown = view.cells;
    view.countBreaks = HOT.breaks(shown.filter((c) => c.n >= MIN_CELL).map((c) => c.n), 5);
    const absCh = shown.filter((c) => c.prior != null && Math.max(c.n, c.prior) >= MIN_CELL).map((c) => Math.abs(c.change)).sort((a, b) => a - b);
    view.tau = Math.max(3, HOT.quantile(absCh, 0.8));
    const surface = css("--surface");
    hexLayer = L.layerGroup().addTo(map);
    let drawn = 0;
    for (const c of shown) {
      const fill = styleFor(c);
      if (!fill) continue;
      const poly = L.polygon(HOT.cornersOf(c.q, c.r, HEX_WIDTH), { color: surface, weight: 1, opacity: 0.9, fillColor: fill, fillOpacity: 0.78 });
      poly.bindTooltip(() => cellTip(c), { sticky: true });
      poly.on("click", () => focusCell(c.key));
      poly.addTo(hexLayer);
      hexByKey.set(c.key, { poly, c });
      drawn++;
    }
    legend(drawn);
    $("rangeNote").textContent = `${monLabel(view.months[0])} – ${monLabel(view.months.at(-1))} · ${num(view.recs.filter((a) => view.inP.has(a.m)).length)} offenses`;
    $("mapnote").textContent = st.mode === "change" && !view.priorKeys
      ? "There is not enough history to compare with an earlier period. Choose a shorter period."
      : `Each hexagon is about ${HEX_WIDTH} m across (a few blocks). Cells with fewer than ${MIN_CELL} offenses are left blank. These are counts, not rates.`;
  }

  function legend(drawn) {
    const sw = (c, t) => `<div><i style="background:${c};width:14px;height:14px;border-radius:3px"></i>${t}</div>`;
    const fmt = (x) => num(Math.round(x));
    let h = "";
    if (st.mode === "count") {
      const b = [MIN_CELL, ...view.countBreaks, Infinity];
      h = `<div style="margin-bottom:4px"><strong>Offenses per hexagon</strong></div>` + RAMP.map((c, i) =>
        sw(c, i === 4 ? `${fmt(b[i])}+` : `${fmt(b[i])} – ${fmt(b[i + 1] - 1)}`)).join("");
    } else if (st.mode === "change") {
      const lo = Math.max(2, Math.ceil(view.tau / 3));
      h = `<div style="margin-bottom:4px"><strong>Change vs. the previous ${view.n} months</strong></div>`
        + sw(UP[1], `Up ${fmt(view.tau)}+`) + sw(UP[0], `Up ${lo} – ${fmt(view.tau - 1)}`) + sw(FLAT, "About the same")
        + sw(DOWN[0], `Down ${lo} – ${fmt(view.tau - 1)}`) + sw(DOWN[1], `Down ${fmt(view.tau)}+`);
    } else {
      const w = view.windowMonths;
      h = `<div style="margin-bottom:4px"><strong>Months among the busiest<br>(of the last ${w})</strong></div>` + RAMP.map((c, i) =>
        sw(c, `${Math.floor((i * w) / 5) + 1} – ${Math.floor(((i + 1) * w) / 5)}`)).join("");
    }
    $("legend").innerHTML = h + (drawn ? "" : `<div class="muted" style="margin-top:4px">Nothing to show for these choices.</div>`);
  }

  function focusCell(key) {
    const h = hexByKey.get(key);
    if (!h) return;
    const pts = HOT.cornersOf(h.c.q, h.c.r, HEX_WIDTH);
    const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]), pad = 0.0035;
    map.fitBounds([[Math.min(...lats) - pad, Math.min(...lons) - pad], [Math.max(...lats) + pad, Math.max(...lons) + pad]]);
    h.poly.setStyle({ color: css("--ink"), weight: 3 });
    h.poly.bringToFront();
    h.poly.openTooltip(L.latLng(HOT.centerOf(h.c.q, h.c.r, HEX_WIDTH).lat, HOT.centerOf(h.c.q, h.c.r, HEX_WIDTH).lon));
    if (window.matchMedia("(max-width: 760px)").matches) $("map").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ------------------------------------------------------------ the lists
  const rowLink = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;

  function hexList() {
    const cells = view.cells, items = [];
    const row = (c, rank, right) => {
      const ctr = HOT.centerOf(c.q, c.r, HEX_WIDTH);
      return `<li class="hrow"><button type="button" class="hname" data-cell="${esc(c.key)}"><span class="rank">${rank}</span> ${esc(describeCell(c))}</button>
        <span class="hval">${right}</span>
        <a class="hgo" href="${esc(mapHash({ pt: ctr.lat.toFixed(5) + "," + ctr.lon.toFixed(5), lbl: describeCell(c), radius: "0.25" }))}">See crime near here</a></li>`;
    };
    const list = (title, arr, right, note) => `<h3>${esc(title)}</h3>${note ? `<p class="small muted">${note}</p>` : ""}<ol class="hlist">${
      arr.length ? arr.map((c, i) => row(c, i + 1, right(c))).join("") : '<li class="muted">Nothing to show.</li>'}</ol>`;
    if (st.mode === "count") {
      const arr = cells.filter((c) => c.n >= MIN_CELL).sort((a, b) => b.n - a.n).slice(0, 15);
      items.push(list("Most offenses", arr, (c) => `${num(c.n)}<small> ${pctText(c.n, c.prior)}</small>`,
        `Hexagons with the most reported offenses in the period. The small figure is the change from the previous ${view.n} months.`));
    } else if (st.mode === "change") {
      if (!view.priorKeys) return '<p class="muted">There is not enough history to compare with an earlier period. Choose a shorter period.</p>';
      const pool = cells.filter((c) => c.prior != null && Math.max(c.n, c.prior) >= MIN_CELL);
      items.push(list("Biggest increases", pool.filter((c) => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 8), (c) => `+${num(c.change)}<small> ${num(c.prior)} → ${num(c.n)}</small>`,
        `Change in offenses compared with the previous ${view.n} months. Small numbers can swing a lot.`));
      items.push(list("Biggest decreases", pool.filter((c) => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 8), (c) => `−${num(-c.change)}<small> ${num(c.prior)} → ${num(c.n)}</small>`));
    } else {
      const arr = cells.filter((c) => c.high).sort((a, b) => b.high - a.high || b.n - a.n).slice(0, 15);
      items.push(list(`Busy in the most months (of ${view.windowMonths})`, arr, (c) => `${c.high}<small> months · ${num(c.n)} offenses</small>`,
        `A month counts as busy when a hexagon had at least ${num(view.busy)} offenses, the level only about one in ten active hexagon-months reaches.`));
    }
    return items.join("");
  }

  function areaRows(kind) {
    const isW = kind === "ward", feats = isW ? D.wards : D.nbhdShapes;
    if (!feats) return null;
    const cur = new Map(), prev = new Map();
    for (const a of view.recs) {
      const k = isW ? a.ward : a.nbhd;
      if (!k) continue;
      if (view.inP.has(a.m)) cur.set(k, (cur.get(k) || 0) + 1);
      if (view.inQ && view.inQ.has(a.m)) prev.set(k, (prev.get(k) || 0) + 1);
    }
    return feats.features.map((f) => {
      const name = isW ? String(f.properties.ward) : f.properties.name, pop = f.properties.pop, n = cur.get(name) || 0, p = view.inQ ? prev.get(name) || 0 : null;
      return { name, label: isW ? `Ward ${name}` : name, pop, n, prior: p, rate: pop >= (isW ? 1 : MIN_RATE_POP) ? (n / pop) * 1000 : null,
               change: p == null ? null : p ? (n - p) / p : n ? Infinity : 0 };
    });
  }

  function areaList(kind) {
    const rows = areaRows(kind);
    if (!rows) return '<p class="muted">Outlines are not in this data feed.</p>';
    const isW = kind === "ward", key = { rate: (r) => r.rate ?? -1, n: (r) => r.n, change: (r) => (r.change == null ? -Infinity : r.change) }[st.sort];
    rows.sort((a, b) => key(b) - key(a) || b.n - a.n);
    const th = (k, t, cls = "") => `<th class="${cls}"><button type="button" data-sort="${k}" aria-pressed="${st.sort === k}">${t}${st.sort === k ? " ↓" : ""}</button></th>`;
    const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString();
    return `<table class="hot"><thead><tr><th>${isW ? "Ward" : "Neighborhood"}</th>${th("n", "Offenses", "r")}${th("rate", "Per 1,000", "r")}${th("change", "Change", "r")}</tr></thead><tbody>${
      rows.map((r) => `<tr><td>${rowLink(mapHash(isW ? { ward: r.name } : { nbhd: r.name }), r.label)}</td><td class="r">${num(r.n)}</td>
        <td class="r">${r.rate == null ? '<span class="muted" title="Fewer than ' + MIN_RATE_POP + ' residents">–</span>' : fmt(r.rate)}</td>
        <td class="r">${r.prior == null ? "–" : pctText(r.n, r.prior)}</td></tr>`).join("")}</tbody></table>
      <p class="small muted">Per 1,000 residents, 2020 census${isW ? "" : "; neighborhoods with fewer than " + MIN_RATE_POP + " residents have no rate"}. Change is against the previous ${view.n} months. Click a name to see it on the crime map.</p>`;
  }

  function blockList() {
    const by = new Map();
    for (const a of view.recs) {
      if (a.masked || !a.addr) continue;
      const inP = view.inP.has(a.m), inQ = view.inQ && view.inQ.has(a.m);
      if (!inP && !inQ) continue;
      let b = by.get(a.addr);
      if (!b) { b = { addr: a.addr, n: 0, prior: 0, inc: new Set(), cats: new Map(), nbhd: a.nbhd }; by.set(a.addr, b); }
      if (inP) { b.n++; b.inc.add(a.inc); b.cats.set(a.cat, (b.cats.get(a.cat) || 0) + 1); }
      if (inQ) b.prior++;
    }
    const rows = [...by.values()].filter((b) => b.n).sort((a, b) => b.n - a.n).slice(0, 25);
    if (!rows.length) return '<p class="muted">No offenses with a street address for these choices.</p>';
    const top = (m) => [...m].sort((x, y) => y[1] - x[1])[0][0];
    return `<ol class="hlist">${rows.map((b, i) => `<li class="hrow"><span class="hname"><span class="rank">${i + 1}</span> ${esc(HOT.title(b.addr))}<span class="muted small"> · ${esc(b.nbhd || "")}</span></span>
      <span class="hval">${num(b.n)}<small> ${num(b.inc.size)} incidents · ${view.inQ ? pctText(b.n, b.prior) : ""}</small></span>
      <span class="small muted hmain">Most common: ${esc(top(b.cats))}</span>
      <a class="hgo" href="${esc(mapHash({ q: b.addr, range: MAP_RANGE[st.per] }))}">See on the map</a></li>`).join("")}</ol>
      <p class="small muted">Blocks with the most offenses (street address as reported). Stores, hospitals and other places that routinely report can rank high. Offenses whose location is withheld are not listed.</p>`;
  }

  function renderList() {
    $("list").innerHTML = st.tab === "hex" ? hexList() : st.tab === "block" ? blockList() : areaList(st.tab);
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === st.tab));
    document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === st.mode));
  }

  function render() {
    writeState();
    compute();
    renderMap();
    renderList();
  }

  // ------------------------------------------------------------ start
  function initMap() {
    map = L.map("map", { preferCanvas: true, zoomSnap: 0.25 }).fitBounds(CITY_BOUNDS);
    const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark";
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: dark ? "tiles-dark" : "tiles-light",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (D.city) L.geoJSON(D.city, { interactive: false, style: { color: css("--outline"), weight: 2.5, opacity: 0.85, fill: false } }).addTo(map);
  }

  async function main() {
    D = await CRIME.load();
    D.records.forEach((a) => { a.m = a.t.slice(0, 7); });          // month key, used for all the counting
    const mon = (m) => new Date(m + "-15T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("sub").textContent = `Where reported offenses cluster, ${mon(D.months[0].m)} – ${mon(D.months.at(-1).m)}. The City adds each month around the 5th of the next.`;
    const esc2 = esc;
    $("cat").innerHTML = '<option value="">All offense types</option>' + D.types.map((t) =>
      `<optgroup label="${esc2(t)}">${D.cats[t].map((c) => `<option value="${esc2(c)}">${esc2(c)}</option>`).join("")}</optgroup>`).join("");
    readState();
    $("cat").value = st.cat; $("fa").checked = st.fa; $("per").value = st.per;
    initMap();
    $("cat").addEventListener("change", () => { st.cat = $("cat").value; render(); });
    $("fa").addEventListener("change", () => { st.fa = $("fa").checked; render(); });
    $("per").addEventListener("change", () => { st.per = $("per").value; render(); });
    $("reset").addEventListener("click", () => { st = { ...st, cat: "", fa: false, per: "p12" }; $("cat").value = ""; $("fa").checked = false; $("per").value = "p12"; render(); });
    document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.addEventListener("click", () => { st.mode = b.dataset.mode; writeState(); renderMap(); renderList(); }));
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { st.tab = b.dataset.tab; writeState(); renderList(); }));
    $("list").addEventListener("click", (e) => {
      const cell = e.target.closest("[data-cell]"), sort = e.target.closest("[data-sort]");
      if (cell) focusCell(cell.dataset.cell);
      if (sort) { st.sort = sort.dataset.sort; renderList(); }
    });
    render();
  }

  main().catch((e) => { $("sub").textContent = "Could not load data: " + e.message + " (open the page through a local web server, not by double-clicking the file)."; });
})();
