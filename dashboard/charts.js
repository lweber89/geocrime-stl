/* charts.js: trends for whatever area is chosen (whole city, a ward, a neighborhood, or a circle around an address).
 *
 * The area and offense filters come from the page link, the same fields the map uses, so "Charts" from the map
 * shows the same place. Only the time period here is separate: the month-by-month and year-over-year charts
 * always show all months, and the period menu scopes the totals and the breakdown charts.
 * All charts are plain SVG/HTML built here (no chart library), redrawn when the window is resized.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const CATCH_ALL = "All Other Offenses";
  const TYPES = ["Person", "Property", "Society", "Other"];
  const typeColor = (t) => css("--type-" + t.toLowerCase());
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monLabel = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const monStart = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  const monEnd = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0, 23, 59, 59);
  const monKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const num = (n) => Number(n).toLocaleString("en-US");
  const compact = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace(".0K", "K") : String(n));
  const NS = "http://www.w3.org/2000/svg";
  const METERS_PER_MILE = 1609.344;
  const HOURS = ["12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let D, scoped = [], area = {}, period = "p12", other = new URLSearchParams();
  const wardPop = new Map(), nbhdPop = new Map();
  let cityPop = 0;

  function el(tag, attrs = {}, kids = []) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    kids.forEach((c) => n.appendChild(c));
    return n;
  }
  const text = (s, attrs) => { const t = el("text", attrs); t.textContent = s; return t; };

  // ------------------------------------------------------------ state (shared with the map through the page link)
  const AREA_FIELDS = ["ward", "nbhd", "pt", "lbl", "radius", "cat"];

  function readState() {
    const p = new URLSearchParams(location.hash.slice(1));
    area = {};
    for (const k of AREA_FIELDS) area[k] = p.get(k) || "";
    area.fa = p.get("fa") === "1";
    period = p.get("per") || "p12";
    other = new URLSearchParams();                     // everything else (the map's period, filters...) is passed through untouched
    p.forEach((v, k) => { if (!AREA_FIELDS.includes(k) && k !== "fa" && k !== "per") other.set(k, v); });
  }

  function writeState() {
    const p = new URLSearchParams(other);
    for (const k of AREA_FIELDS) if (area[k] && !(k === "radius" && !area.pt)) p.set(k, area[k]);
    if (area.fa) p.set("fa", "1");
    if (period !== "p12") p.set("per", period);
    history.replaceState(null, "", p.toString() ? "#" + p : location.pathname);
    const link = document.querySelector('a[data-nav="map"]');
    if (link) link.href = "./" + (p.toString() ? "#" + p : "");
  }

  function describeArea() {
    if (area.pt) return `Within ${RADIUS.label(area.radius)} of ${area.lbl || "the chosen spot"}`;
    if (area.nbhd) return area.nbhd;
    if (area.ward) return `Ward ${area.ward}`;
    return "Whole city";
  }

  function populationOfArea() {
    if (area.pt) return null;
    if (area.nbhd) return nbhdPop.get(area.nbhd) || null;
    if (area.ward) return wardPop.get(area.ward) || null;
    return cityPop;
  }

  // ------------------------------------------------------------ data selection
  function areaMatcher() {
    let near = null;
    if (area.pt) {
      const [la, lo] = area.pt.split(",").map(Number);
      const m2 = (RADIUS.snap(area.radius) * METERS_PER_MILE) ** 2, kx = 111320 * Math.cos((la * Math.PI) / 180);
      near = (a) => a.lat != null && ((a.lat - la) * 110540) ** 2 + ((a.lon - lo) * kx) ** 2 <= m2;
    }
    return (a) => (!near || near(a)) && (!area.ward || a.ward === area.ward) && (!area.nbhd || a.nbhd === area.nbhd)
      && (!area.cat || a.cat === area.cat) && (!area.fa || a.firearm);
  }

  function periodBounds() {
    const keys = D.months.map((x) => x.m), n = { p3: 3, p6: 6, p12: 12, p24: 24, all: keys.length }[period] || 12;
    const used = Math.min(n, keys.length);
    return { from: monStart(keys[keys.length - used]), to: monEnd(keys.at(-1)), n: used };
  }

  // ------------------------------------------------------------ small building blocks
  const tip = () => $("tip");

  function showTip(evt, build) {
    const t = tip();
    t.replaceChildren();
    build(t);
    t.hidden = false;
    const pad = 12, r = t.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = Math.max(8, x) + "px";
    t.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => { tip().hidden = true; };

  function tipHead(t, s) { const d = document.createElement("div"); d.className = "tip-head"; d.textContent = s; t.appendChild(d); }
  function tipRow(t, color, name, value) {
    const r = document.createElement("div"); r.className = "tip-row";
    const key = document.createElement("i"); key.className = "tip-key"; if (color) key.style.background = color;
    const n = document.createElement("span"); n.className = "tip-name"; n.textContent = name;
    const v = document.createElement("strong"); v.textContent = value;
    r.append(key, n, v);
    t.appendChild(r);
  }

  function niceMax(v) {                                   // four equal, round steps (e.g. 0, 250, 500, 750, 1,000)
    const raw = Math.max(1, v) / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p * 4;
  }

  function yAxis(svg, m, W, H, max, ticks = 4) {
    for (let i = 0; i <= ticks; i++) {
      const v = (max * i) / ticks, y = H - m.b - ((H - m.t - m.b) * i) / ticks;
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: i === 0 ? "axis" : "grid" }));
      svg.appendChild(text(compact(Math.round(v)), { x: m.l - 6, y: y + 3.5, "text-anchor": "end", class: "ax" }));
    }
  }

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function legend(box, items) {
    box.replaceChildren();
    for (const [color, name] of items) {
      const s = document.createElement("span"); s.className = "lg";
      const i = document.createElement("i"); i.style.background = color;
      s.append(i, document.createTextNode(name));
      box.appendChild(s);
    }
  }

  function fillTable(details, headers, rows) {
    const table = details.querySelector("table");
    table.replaceChildren();
    const thead = table.createTHead().insertRow();
    headers.forEach((h) => { const th = document.createElement("th"); th.textContent = h; thead.appendChild(th); });
    const body = table.createTBody();
    rows.forEach((r) => { const tr = body.insertRow(); r.forEach((c) => { tr.insertCell().textContent = c; }); });
  }

  // ------------------------------------------------------------ chart 1: offenses per month, stacked by type
  function drawMonthly() {
    const box = $("c-monthly"), W = Math.max(280, box.clientWidth), H = 300, m = { l: 40, r: 6, t: 8, b: 36 };
    const all = D.months.map((x) => x.m), keys = all.slice(-periodBounds().n), idx = new Map(keys.map((k, i) => [k, i]));   // the months of the chosen period
    const rows = keys.map(() => ({ Person: 0, Property: 0, Society: 0, Other: 0, total: 0 }));
    for (const a of scoped) { const i = idx.get(a.t.slice(0, 7)); if (i != null) { rows[i][a.type]++; rows[i].total++; } }
    const max = niceMax(Math.max(1, ...rows.map((r) => r.total)));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Offenses per month, stacked by type, ${monLabel(keys[0])} to ${monLabel(keys.at(-1))}` });
    yAxis(svg, m, W, H, max);
    const slot = (W - m.l - m.r) / keys.length, bw = Math.min(24, slot - 3), scale = (H - m.t - m.b) / max, base = H - m.b;
    keys.forEach((k, i) => {
      const x = m.l + i * slot + (slot - bw) / 2, r = rows[i];
      const top = TYPES.map((t) => r[t] > 0).lastIndexOf(true);
      let cum = 0;
      TYPES.forEach((t, ti) => {
        if (!r[t]) return;
        const h = r[t] * scale, y0 = base - cum - h;
        const isTop = ti === top;
        const seg = isTop ? el("path", { d: roundedTop(x, y0, bw, h, 4) }) : el("rect", { x, y: y0 + (h > 4 ? 2 : 0), width: bw, height: h > 4 ? h - 2 : h });
        seg.setAttribute("fill", typeColor(t));
        svg.appendChild(seg);
        cum += h;
      });
      const mon = Number(k.slice(5, 7)), step = Math.ceil(30 / slot);        // label every month if there is room, else every 2nd, 3rd...
      if (i % step === 0 || mon === 1 && step < 4) {
        svg.appendChild(text(MON[mon - 1], { x: x + bw / 2, y: H - 20, "text-anchor": "middle", class: "ax" }));
        if (mon === 1 || i === 0) svg.appendChild(text(k.slice(0, 4), { x: x + bw / 2, y: H - 7, "text-anchor": "middle", class: "ax-strong" }));
      }
      const hit = el("rect", { x: m.l + i * slot, y: m.t, width: slot, height: H - m.t - m.b, fill: "transparent", tabindex: 0, class: "hit",
        "aria-label": `${monLabel(k)}: ${num(r.total)} offenses` });
      const show = (e) => showTip(e.clientX !== undefined && e.type !== "focus" ? e : { clientX: hit.getBoundingClientRect().left + slot / 2, clientY: hit.getBoundingClientRect().top + 40 }, (t) => {
        tipHead(t, monLabel(k));
        [...TYPES].reverse().forEach((ty) => tipRow(t, typeColor(ty), ty, num(r[ty])));
        tipRow(t, null, "All offenses", num(r.total));
      });
      hit.addEventListener("pointermove", show); hit.addEventListener("focus", show);
      hit.addEventListener("pointerleave", hideTip); hit.addEventListener("blur", hideTip);
      svg.appendChild(hit);
    });
    box.replaceChildren(svg);
    legend($("lg-monthly"), TYPES.map((t) => [typeColor(t), t]));
    fillTable($("t-monthly"), ["Month", ...TYPES, "All"], keys.map((k, i) => [monLabel(k), ...TYPES.map((t) => num(rows[i][t])), num(rows[i].total)]));
  }

  // ------------------------------------------------------------ chart 2: year over year, one line per year
  function drawYoY() {
    const box = $("c-yoy"), W = Math.max(280, box.clientWidth), H = 250, m = { l: 40, r: 40, t: 10, b: 26 };
    const keys = new Set(D.months.map((x) => x.m)), years = [...new Set(D.months.map((x) => x.m.slice(0, 4)))].slice(-5);          // at most the latest five years, so the lines stay readable
    const val = new Map();
    for (const a of scoped) { const k = a.t.slice(0, 7); val.set(k, (val.get(k) || 0) + 1); }
    const series = years.map((y) => Array.from({ length: 12 }, (_, i) => { const k = `${y}-${String(i + 1).padStart(2, "0")}`; return keys.has(k) ? val.get(k) || 0 : null; }));
    const max = niceMax(Math.max(1, ...series.flat().filter((v) => v != null)));
    const px = (i) => m.l + ((i + 0.5) / 12) * (W - m.l - m.r), py = (v) => H - m.b - (v / max) * (H - m.t - m.b);
    const color = (yi) => `color-mix(in srgb, ${css("--series")} ${years.length === 1 ? 100 : Math.round(45 + (55 * yi) / (years.length - 1))}%, ${css("--surface")})`;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Offenses per month, one line for each year" });
    yAxis(svg, m, W, H, max);
    MON.forEach((mm, i) => { if (W >= 480 || i % 2 === 0) svg.appendChild(text(mm, { x: px(i), y: H - 8, "text-anchor": "middle", class: "ax" })); });
    series.forEach((s, yi) => {
      let d = "", pen = false;
      s.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`; pen = true; });
      svg.appendChild(el("path", { d, fill: "none", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", style: `stroke:${color(yi)}` }));
      s.forEach((v, i) => { if (v != null) svg.appendChild(el("circle", { cx: px(i), cy: py(v), r: 4, "stroke-width": 2, class: "dot", style: `fill:${color(yi)}` })); });
    });
    const li = series.length - 1, last = series[li].map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    if (last >= 0) svg.appendChild(text(years[li], { x: px(last) + 9, y: py(series[li][last]) + 4, class: "ax-strong" }));    // label the newest year only; the legend names the rest
    const cross = el("line", { y1: m.t, y2: H - m.b, class: "cross", visibility: "hidden" });
    svg.appendChild(cross);
    const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent", class: "hit" });
    hit.addEventListener("pointermove", (e) => {
      const r = hit.getBoundingClientRect(), i = Math.min(11, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 12)));
      cross.setAttribute("x1", px(i)); cross.setAttribute("x2", px(i)); cross.setAttribute("visibility", "visible");
      showTip(e, (t) => {
        tipHead(t, MON[i]);
        [...years.keys()].reverse().forEach((yi) => tipRow(t, color(yi), years[yi], series[yi][i] == null ? "no data" : num(series[yi][i])));
      });
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
    svg.appendChild(hit);
    box.replaceChildren(svg);
    const lg = $("lg-yoy"); lg.replaceChildren();
    years.forEach((y, yi) => { const s = document.createElement("span"); s.className = "lg line"; const i = document.createElement("i"); i.style.background = color(yi); s.append(i, document.createTextNode(y)); lg.appendChild(s); });
    fillTable($("t-yoy"), ["Month", ...years], MON.map((mm, i) => [mm, ...series.map((s) => (s[i] == null ? "no data" : num(s[i])))]));
  }

  // ------------------------------------------------------------ chart 3: most common offenses in the period
  function drawCategories(inPeriod) {
    const box = $("c-cats"), cats = new Map();
    for (const a of inPeriod) { const c = cats.get(a.cat) || { n: 0, type: a.type }; c.n++; cats.set(a.cat, c); }
    // the police catch-all would top the list without saying anything, so it is left out of the ranking (and noted below)
    const named = [...cats].filter(([c]) => c !== CATCH_ALL), pool = named.length ? named : [...cats];
    const top = pool.sort((x, y) => y[1].n - x[1].n).slice(0, 10), max = top.length ? top[0][1].n : 1;
    const left = named.length && cats.get(CATCH_ALL) ? cats.get(CATCH_ALL).n : 0;
    $("n-cats").textContent = left ? `Not ranked: ${num(left)} offenses (${Math.round((100 * left) / inPeriod.length)}%) in "${CATCH_ALL}", the police catch-all category. They are included in every total.` : "";
    box.replaceChildren();
    if (!top.length) { box.textContent = "No offenses reported."; }
    top.forEach(([name, c]) => {
      const row = document.createElement("div"); row.className = "cat-row"; row.tabIndex = 0;
      const n = document.createElement("span"); n.className = "cat-name"; n.textContent = name;
      const track = document.createElement("span"); track.className = "cat-track";
      const bar = document.createElement("b"); bar.style.width = (100 * c.n / max).toFixed(1) + "%"; bar.style.background = typeColor(c.type);
      track.appendChild(bar);
      const v = document.createElement("span"); v.className = "cat-n"; v.textContent = num(c.n);
      row.append(n, track, v);
      const show = (e) => showTip(e, (t) => { tipHead(t, name); tipRow(t, typeColor(c.type), c.type + " offenses", num(c.n)); tipRow(t, null, "Share of period", Math.round((100 * c.n) / inPeriod.length) + "%"); });
      row.addEventListener("pointermove", show);
      row.addEventListener("focus", () => show({ clientX: row.getBoundingClientRect().left + 40, clientY: row.getBoundingClientRect().bottom }));
      row.addEventListener("pointerleave", hideTip); row.addEventListener("blur", hideTip);
      box.appendChild(row);
    });
    legend($("lg-cats"), TYPES.map((t) => [typeColor(t), t]));
    fillTable($("t-cats"), ["Category", "Type", "Offenses"], top.map(([name, c]) => [name, c.type, num(c.n)]));
  }

  // Part of the day, from the clock hour. St. Louis sunrise and sunset move through the year, so these are approximate.
  const PARTS = [["Night", "8 pm – 5 am"], ["Dawn", "5 – 7 am"], ["Day", "7 am – 5 pm"], ["Dusk", "5 – 8 pm"]];
  const partOf = (h) => (h >= 20 || h < 5 ? 0 : h < 7 ? 1 : h < 17 ? 2 : 3);
  const partColor = (i) => css("--tod-" + PARTS[i][0].toLowerCase());

  // ------------------------------------------------------------ charts 4 and 5: simple columns (hour of day, day of week)
  function columnChart(box, { values, labels, labelAt, title, tipTitle, fill, tipExtra }) {
    const W = Math.max(280, box.clientWidth), H = 190, m = { l: 40, r: 6, t: 8, b: 26 };
    const max = niceMax(Math.max(1, ...values)), slot = (W - m.l - m.r) / values.length, bw = Math.min(24, slot - 3), scale = (H - m.t - m.b) / max;
    const total = values.reduce((a, b) => a + b, 0);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": title });
    yAxis(svg, m, W, H, max, 4);
    values.forEach((v, i) => {
      const x = m.l + i * slot + (slot - bw) / 2, h = v * scale;
      if (v) svg.appendChild(el("path", { d: roundedTop(x, H - m.b - h, bw, h, 4), class: "col", ...(fill ? { style: `fill:${fill(i)}` } : {}) }));
      if (labelAt(i)) svg.appendChild(text(labels[i], { x: x + bw / 2, y: H - 8, "text-anchor": "middle", class: "ax" }));
      const hit = el("rect", { x: m.l + i * slot, y: m.t, width: slot, height: H - m.t - m.b, fill: "transparent", tabindex: 0, class: "hit", "aria-label": `${tipTitle(i)}: ${num(v)} offenses` });
      const show = (e) => showTip(e.type === "focus" ? { clientX: hit.getBoundingClientRect().left + slot / 2, clientY: hit.getBoundingClientRect().top + 30 } : e, (t) => {
        tipHead(t, tipTitle(i)); if (tipExtra) tipExtra(t, i); tipRow(t, null, "Offenses", num(v)); tipRow(t, null, "Share", total ? Math.round((100 * v) / total) + "%" : "–");
      });
      hit.addEventListener("pointermove", show); hit.addEventListener("focus", show);
      hit.addEventListener("pointerleave", hideTip); hit.addEventListener("blur", hideTip);
      svg.appendChild(hit);
    });
    box.replaceChildren(svg);
  }

  function drawTiming(inPeriod) {
    const known = inPeriod.filter((a) => !a.est), hours = Array(24).fill(0), days = Array(7).fill(0);
    known.forEach((a) => { hours[a.date.getHours()]++; });
    inPeriod.forEach((a) => { days[a.date.getDay()]++; });
    columnChart($("c-hours"), { values: hours, labels: HOURS, labelAt: (i) => i % (document.documentElement.clientWidth < 520 ? 6 : 3) === 0,
      title: "Offenses by hour of day, colored by part of the day", tipTitle: (i) => `${HOURS[i]} to ${HOURS[(i + 1) % 24]}`,
      fill: (i) => partColor(partOf(i)), tipExtra: (t, i) => { const p = partOf(i); tipRow(t, partColor(p), PARTS[p][0], PARTS[p][1]); } });
    legend($("lg-hours"), PARTS.map(([n, r], i) => [partColor(i), `${n} (${r})`]));
    $("n-hours").textContent = `Left out: ${num(inPeriod.length - known.length)} offenses (${inPeriod.length ? Math.round((100 * (inPeriod.length - known.length)) / inPeriod.length) : 0}%) whose exact time was not recorded, which the City's data often shows as exactly midnight or noon.`;
    columnChart($("c-days"), { values: days, labels: DAYS.map((d) => d.slice(0, 3)), labelAt: () => true, title: "Offenses by day of week", tipTitle: (i) => DAYS[i], fill: () => css("--series-soft") });
    fillTable($("t-hours"), ["Hour", "Part of day", "Offenses"], hours.map((v, i) => [`${HOURS[i]} to ${HOURS[(i + 1) % 24]}`, PARTS[partOf(i)][0], num(v)]));
    fillTable($("t-days"), ["Day", "Offenses"], days.map((v, i) => [DAYS[i], num(v)]));
  }

  // ------------------------------------------------------------ tiles
  function drawTiles(inPeriod, pb) {
    const n = inPeriod.length, pct = (x) => (n ? Math.round((100 * x) / n) + "%" : "–");
    const pop = populationOfArea();
    const matchArea = areaMatcher();
    // the same number of months immediately before the period, with the same area and filters
    const pFrom = new Date(pb.from.getFullYear(), pb.from.getMonth() - pb.n, 1), pTo = new Date(pb.from.getTime() - 1);
    const hasPrior = period !== "all" && pFrom >= monStart(D.months[0].m);
    const prior = hasPrior ? D.records.filter((a) => a.date >= pFrom && a.date <= pTo && matchArea(a)).length : null;
    const change = prior == null ? ["–", "change vs. the previous period (not enough history)"]
      : !prior ? ["–", "change vs. the previous period (none reported then)"]
      : [(n >= prior ? "+" : "−") + Math.abs(Math.round((100 * (n - prior)) / prior)) + "%", `vs. the previous ${pb.n} months (${num(prior)})`];
    const tiles = [
      [num(n), `reported offenses, ${pb.n === D.months.length && period === "all" ? "all dates" : `last ${pb.n} months`}`],
      pop ? [(Math.round((10000 * n) / pop) / 10).toLocaleString(), `per 1,000 residents in this period (${num(pop)} people, 2020 census)`] : null,
      change,
      [pct(inPeriod.filter((a) => a.type === "Person").length), "crimes against persons"],
      [pct(inPeriod.filter((a) => a.firearm).length), "involved a firearm"],
    ].filter(Boolean);
    $("tiles").replaceChildren(...tiles.map(([v, l]) => {
      const d = document.createElement("div"); d.className = "tile";
      const a = document.createElement("div"); a.className = "v"; a.textContent = v;
      const b = document.createElement("div"); b.className = "l"; b.textContent = l;
      d.append(a, b); return d;
    }));
  }

  // ------------------------------------------------------------ page
  function renderAll() {
    writeState();
    scoped = D.records.filter(areaMatcher());
    const pb = periodBounds(), inPeriod = scoped.filter((a) => a.date >= pb.from && a.date <= pb.to);
    $("areaTitle").textContent = describeArea();
    $("cap-monthly").textContent = `By type of offense, ${monLabel(D.months.slice(-pb.n)[0].m)} – ${monLabel(D.months.at(-1).m)} (follows the period menu).`;
    $("periodText").textContent = `${monLabel(monKey(pb.from))} – ${monLabel(monKey(pb.to))}`;
    $("addrChip").hidden = !area.pt;
    for (const id of ["ward", "nbhd"]) {                 // locked while a spot is chosen; "Clear" brings them back
      $(id).disabled = !!area.pt;
      $(id).title = area.pt ? "Clear the address to choose a ward or neighborhood." : "";
    }
    drawTiles(inPeriod, pb);
    drawMonthly(); drawYoY(); drawCategories(inPeriod); drawTiming(inPeriod);
    $("empty").hidden = scoped.length > 0;
  }

  function wire() {
    const sync = () => { $("ward").value = area.ward; $("nbhd").value = area.nbhd; $("cat").value = area.cat; $("fa").checked = area.fa; $("per").value = period; };
    $("ward").addEventListener("change", () => { area.ward = $("ward").value; if (area.ward) { area.nbhd = ""; area.pt = area.lbl = ""; } sync(); renderAll(); });
    $("nbhd").addEventListener("change", () => { area.nbhd = $("nbhd").value; if (area.nbhd) { area.ward = ""; area.pt = area.lbl = ""; } sync(); renderAll(); });
    $("cat").addEventListener("change", () => { area.cat = $("cat").value; renderAll(); });
    $("fa").addEventListener("change", () => { area.fa = $("fa").checked; renderAll(); });
    $("per").addEventListener("change", () => { period = $("per").value; renderAll(); });
    $("addrClear").addEventListener("click", () => { area.pt = area.lbl = ""; renderAll(); });
    $("reset").addEventListener("click", () => { area = { ward: "", nbhd: "", pt: "", lbl: "", radius: "", cat: "", fa: false }; period = "p12"; sync(); renderAll(); });
    let t; const redraw = () => { clearTimeout(t); t = setTimeout(() => { if (D) renderAll(); }, 120); };
    window.addEventListener("resize", redraw);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
    return sync;
  }

  async function main() {
    D = await CRIME.load();
    D.wards && D.wards.features.forEach((f) => { wardPop.set(String(f.properties.ward), f.properties.pop); cityPop += f.properties.pop; });
    D.nbhdShapes && D.nbhdShapes.features.forEach((f) => nbhdPop.set(f.properties.name, f.properties.pop));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    $("ward").innerHTML = '<option value="">Any ward</option>' + [...wardPop.keys()].sort((a, b) => a - b).map((w) => `<option value="${w}">Ward ${w}</option>`).join("");
    $("nbhd").innerHTML = '<option value="">Any neighborhood</option>' + D.nbhds.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    const counts = new Map(); D.records.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    $("cat").innerHTML = '<option value="">All offense types</option>' + D.types.map((t) =>
      `<optgroup label="${esc(t)}">${D.cats[t].map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</optgroup>`).join("");
    $("sub").textContent = `Reported offenses, ${CRIME.span(D.months)} · Updated monthly`;
    readState();
    const sync = wire();
    sync();
    renderAll();
  }

  main().catch((e) => { $("sub").textContent = "Could not load data: " + e.message + " (open the page through a local web server, not by double-clicking the file)."; });
})();
