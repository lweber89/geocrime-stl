(() => {
  "use strict";

  const TYPES = ["Person", "Property", "Society", "Other"];   // worst first: drives colour priority on the map
  const PAGE = 100;
  const DEFAULT_RADIUS = "0.5", TREND_MONTHS = 24;       // the report chart always shows the latest 24 months
  const CITY_SQ_MILES = 62.11, METERS_PER_MILE = 1609.344;
  const RADIUS_LABEL = { 0.25: "¼ mile", 0.5: "½ mile", 1: "1 mile" };
  const CITY_BOUNDS = [[38.532, -90.32], [38.774, -90.166]];
  const CITY_MAX_MONTHS = 6;                                  // whole-city views are limited to 6 months of dots; a ward or neighborhood can show any period
  const HEAT = { 0.2: "#ffe08a", 0.45: "#fdae61", 0.7: "#f46d43", 0.9: "#d73027", 1.0: "#7f0000" };
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { title } = CRIME;
  const typeColor = (t) => css("--type-" + t.toLowerCase());
  const DATE = { month: "short", day: "numeric", year: "numeric" };
  const fmtDate = (a) => a.date.toLocaleString("en-US", a.est ? DATE : { ...DATE, hour: "numeric", minute: "2-digit" });

  let D, filtered = [], sortKey = "t", sortDir = -1, page = 0, open = new Set();
  let map, pointLayer, heatLayer, layerChoice = "auto";   // "auto" picks by date span; the buttons override it
  let defaultRange = "all", cityLimited = false, bounds = null, priorInfo = null;
  let wardLayer, outlineLayer, wardCounts = new Map(), nbhdCounts = new Map(), wardFeatures = new Map(), nbhdFeatures = new Map(), wardNbhds = new Map();
  let addrLayer, center = null, curMatches = null, pinMode = false;          // center: the searched address and radius, or null
  const incCount = new Map();

  // ------------------------------------------------------------ filters
  const FIELDS = ["q", "range", "month", "ward", "nbhd", "pt", "lbl", "radius", "cat"];   // pt = "lat,lon" of a searched address

  // ---- date ranges: calendar months, because the City publishes whole months (no "last 7 days")
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monLabel = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const monStart = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  const monEnd = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0, 23, 59, 59);
  const fmtDay = (d) => d.toLocaleDateString("en-US", DATE);

  const monKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthsIn = (from, to) => (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;

  // The chosen period as { from, to } Dates. A picked month wins over the preset menu.
  function rangeBounds(f) {
    const keys = D.months.map((x) => x.m), last = keys.at(-1), first = keys[0];
    const back = (n) => keys[Math.max(0, keys.length - n)];
    const v = f.month ? "m:" + f.month : f.range;
    if (v.startsWith("m:")) return { from: monStart(v.slice(2)), to: monEnd(v.slice(2)) };
    if (v === "last3") return { from: monStart(back(3)), to: monEnd(last) };
    if (v === "last6") return { from: monStart(back(6)), to: monEnd(last) };
    if (v === "last12") return { from: monStart(back(12)), to: monEnd(last) };
    if (v === "all") return { from: monStart(first), to: monEnd(last) };
    if (v === "ytd") { const jan = last.slice(0, 4) + "-01"; return { from: monStart(jan < first ? first : jan), to: monEnd(last) }; }
    return { from: monStart(last), to: monEnd(last) };
  }

  function buildRangeOptions() {
    const keys = D.months.map((x) => x.m), last = keys.at(-1);
    const opt = (v, t, extra = "") => `<option value="${v}"${extra}>${esc(t)}</option>`;
    defaultRange = "m:" + last;
    $("range").innerHTML =
      opt("m:" + last, `Latest month (${monLabel(last)})`)
      + opt("last3", "Last 3 months")
      + opt("last6", "Last 6 months")
      + opt("last12", "Last 12 months")
      + opt("ytd", "Year to date")
      + opt("all", "All dates")
      + opt("month", "Single month", " hidden");               // shown only while a month is picked
    $("month").innerHTML = opt("", "Or pick a month…") + [...keys].reverse().map((k) => opt(k, monLabel(k))).join("");
    $("range").value = defaultRange;
  }

  function readFilters() {
    const f = {};
    for (const k of FIELDS) f[k] = $(k).value;
    f.fa = $("fa").checked;
    f.hide = TYPES.filter((t) => !$("t-" + t).checked);
    return f;
  }

  function writeHash(f) {
    const p = new URLSearchParams();
    for (const k of FIELDS) if (f[k] && !(k === "range" && (f[k] === defaultRange || f[k] === "month")) && !(k === "radius" && f[k] === DEFAULT_RADIUS)) p.set(k, f[k]);
    if (f.fa) p.set("fa", "1");
    if (f.hide.length) p.set("hide", f.hide.join(","));
    history.replaceState(null, "", p.toString() ? "#" + p : location.pathname);
    const charts = document.querySelector('a[data-nav="charts"]');       // the Charts page opens on the same area and filters
    if (charts) charts.href = "charts.html" + (p.toString() ? "#" + p : "");
  }

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of FIELDS) if (p.has(k)) $(k).value = p.get(k);
    if (!$("radius").value) $("radius").value = DEFAULT_RADIUS;
    $("address").value = $("pt").value ? $("lbl").value : "";
    if ($("pt").value) { $("ward").value = ""; $("nbhd").value = ""; }   // a spot and a ward/neighborhood never go together (old links might)
    if (!$("month").value) $("month").value = "";                // unknown month in the link
    $("range").value = $("month").value ? "month" : ($("range").value || defaultRange);   // old or unknown ranges fall back
    $("fa").checked = p.get("fa") === "1";
    const hide = (p.get("hide") || "").split(",");
    TYPES.forEach((t) => ($("t-" + t).checked = !hide.includes(t)));
  }

  function resetControls() {
    for (const k of ["q", "month", "ward", "cat", "nbhd", "pt", "lbl", "address"]) $(k).value = "";
    $("radius").value = DEFAULT_RADIUS;
    setAddrMsg("");
    $("fa").checked = false;
    TYPES.forEach((t) => ($("t-" + t).checked = true));
    $("range").value = defaultRange;
    layerChoice = "auto";
  }

  const monthsOf = (range) => { const b = rangeBounds({ range, month: "" }); return monthsIn(b.from, b.to); };

  function apply() {
    let f = readFilters();
    // Whole-city views are limited to 6 months; longer periods need a ward, neighborhood or address search.
    center = null;
    if (f.pt) {
      const [la, lo] = f.pt.split(",").map(Number);
      if (Number.isFinite(la) && Number.isFinite(lo)) center = { lat: la, lon: lo, m2: (Number(f.radius) * METERS_PER_MILE) ** 2, kx: 111320 * Math.cos((la * Math.PI) / 180) };
    }
    // around a single spot the ward and neighborhood menus are locked; "Clear address" is the way back to them
    for (const id of ["ward", "nbhd"]) {
      $(id).disabled = !!center;
      $(id).title = center ? "Clear the address or pin to choose a ward or neighborhood." : "";
    }
    const citywide = !f.ward && !f.nbhd && !center && !f.q.trim();
    cityLimited = false;
    if (citywide && !f.month && monthsOf(f.range) > CITY_MAX_MONTHS) { $("range").value = "last6"; f = readFilters(); cityLimited = true; }
    for (const o of $("range").options) o.disabled = o.value !== "month" && citywide && monthsOf(o.value) > CITY_MAX_MONTHS;
    $("range").title = "Longer periods are available when you choose a ward, a neighborhood or search an address.";
    writeHash(f);
    bounds = rangeBounds(f);
    const { from, to } = bounds;
    const n = monthsIn(from, to);
    const terms = f.q.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const near = (a) => a.lat != null && ((a.lat - center.lat) * 110540) ** 2 + ((a.lon - center.lon) * center.kx) ** 2 <= center.m2;
    const matches = (a, withWard = true, withArea = true, withNbhd = true, withCat = true) => {
      if (withArea && center && !near(a)) return false;
      if (withWard && f.ward && a.ward !== f.ward) return false;
      if (f.hide.includes(a.type)) return false;
      if (withCat && f.cat && a.cat !== f.cat) return false;
      if (withNbhd && f.nbhd && a.nbhd !== f.nbhd) return false;
      if (f.fa && !a.firearm) return false;
      return !terms.length || terms.every((t) => a.text.includes(t));
    };
    curMatches = matches;
    // the numbers in the category menu: offenses of each category in the chosen period and area (ignoring the category choice itself)
    const catCounts = new Map();
    for (const a of D.records) if (a.date >= from && a.date <= to && matches(a, true, true, true, false)) catCounts.set(a.cat, (catCounts.get(a.cat) || 0) + 1);
    for (const o of $("cat").options) if (o.value) o.textContent = `${o.value} (${(catCounts.get(o.value) || 0).toLocaleString()})`;
    $("cat").title = "The number beside each category is how many offenses it has in the period and area you have chosen.";
    filtered = D.records.filter((a) => a.date >= from && a.date <= to && matches(a));
    // counts for the ward and neighborhood maps ignore the ward and neighborhood filters, so every area stays on the map
    wardCounts = new Map(); nbhdCounts = new Map();
    for (const a of D.records) if (a.date >= from && a.date <= to && matches(a, false, true, false)) {
      if (a.ward) wardCounts.set(a.ward, (wardCounts.get(a.ward) || 0) + 1);
      if (a.nbhd) nbhdCounts.set(a.nbhd, (nbhdCounts.get(a.nbhd) || 0) + 1);
    }

    // the same number of months immediately before, with the same filters (null if the data does not go back that far)
    const pFrom = new Date(from.getFullYear(), from.getMonth() - n, 1), pTo = new Date(from.getTime() - 1);
    priorInfo = pFrom < monStart(D.months[0].m) ? null : {
      count: D.records.filter((a) => a.date >= pFrom && a.date <= pTo && matches(a)).length,
      label: n === 1 ? monLabel(monKey(pFrom)) : `the previous ${n} months`,
    };
    page = 0;
    $("addrClear").hidden = !center;
    $("reportBtn").hidden = !center;
    renderAll();
    if (center) openReport(); else closePanel();
  }

  // ------------------------------------------------------------ tiles
  function changeTile(n) {
    if (!priorInfo) return ["–", "change vs. the previous period (not enough history)"];
    const p = priorInfo.count;
    if (!p) return ["–", `change vs. ${priorInfo.label} (none reported)`];
    const pc = Math.round((100 * (n - p)) / p);
    return [pc === 0 ? "No change" : (pc > 0 ? "+" : "−") + Math.abs(pc) + "%", `vs. ${priorInfo.label} (${p.toLocaleString()} offenses)`, pc === 0 ? "sm" : ""];
  }

  // offenses per 1,000 residents (2020 census), for the selected neighborhood or ward, or the whole city
  function rateTile(n) {
    if (center) return null;                                   // no population for a circle
    const w = $("ward").value, nb = $("nbhd").value;
    let pop = 0, where = "whole city";
    if (nb && nbhdFeatures.has(nb)) { pop = nbhdFeatures.get(nb).properties.pop; where = nb; }
    else if (nb) return null;
    else if (w) { pop = wardFeatures.get(w)?.properties.pop || 0; where = "Ward " + w; }
    else pop = [...wardFeatures.values()].reduce((x, f) => x + f.properties.pop, 0);
    if (!pop) return null;
    return [(Math.round((10 * 1000 * n) / pop) / 10).toLocaleString(), `offenses per 1,000 residents in this period (${where}, 2020 census)`];
  }

  function renderTiles() {
    const n = filtered.length;
    const pct = (x) => (n ? Math.round((100 * x) / n) + "%" : "–");
    const counts = new Map();
    filtered.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const t = [
      [n.toLocaleString(), "offenses"],
      [CRIME.incidents(filtered).toLocaleString(), "incidents (one can include several offenses)"],
      [pct(filtered.filter((a) => a.type === "Person").length), "crimes against persons"],
      [pct(filtered.filter((a) => a.firearm).length), "involved a firearm"],
      [top ? top[0] : "–", top ? `most common category (${top[1].toLocaleString()})` : "most common category", "sm"],
      changeTile(n),
      rateTile(n),
    ];
    $("tiles").innerHTML = t.filter(Boolean).map(([v, l, c]) => `<div class="tile"><div class="v ${c || ""}">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join("");
  }

  // ------------------------------------------------------------ map
  function initMap() {
    map = L.map("map", { preferCanvas: true, zoomSnap: 0.25 }).fitBounds(CITY_BOUNDS);
    const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light"
              || document.documentElement.dataset.theme === "dark";
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: dark ? "tiles-dark" : "tiles-light",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    // the city limit stays on every view, so the map never looks bare
    if (D.city) L.geoJSON(D.city, { interactive: false, style: { color: css("--outline"), weight: 2.5, opacity: 0.85, fill: false } }).addTo(map);
    pointLayer = L.layerGroup().addTo(map);
    map.on("click", (e) => { if (pinMode) { setPinMode(false); dropPin(e.latlng.lat, e.latlng.lng); } });
    document.querySelectorAll(".seg button[data-layer]").forEach((b) => b.addEventListener("click", () => {
      layerChoice = b.dataset.layer;
      renderMap();
    }));
    legendForDots();
  }

  // ---- details panel: opens when a dot is clicked
  function openPanel(list) {
    list = [...list].sort((a, b) => b.date - a.date);
    const first = list[0];
    const shown = list.slice(0, 100);
    $("pTitle").textContent = first.loc || "Unknown location";
    $("pSub").textContent = `${list.length} offense${list.length > 1 ? "s" : ""} in ${bounds ? monLabel(monKey(bounds.from)) + (monthsIn(bounds.from, bounds.to) > 1 ? " – " + monLabel(monKey(bounds.to)) : "") : "this period"}`;
    $("pBody").innerHTML = shown.map((a) => {
      const n = incCount.get(a.inc) || 1;
      return `<div class="pitem">
        <div class="sev"><i style="background:${typeColor(a.type)}"></i><strong>${esc(a.cat)}</strong>${flags(a)}</div>
        <div>${esc(title(a.off))}</div>
        <div class="muted">${esc(fmtDate(a))}${a.est ? " (exact time not recorded)" : ""} · ${esc(a.nbhd)}${a.ward ? " · Ward " + esc(a.ward) : ""}${a.district && a.district !== "0" ? " · District " + esc(a.district) : ""}</div>
        <div class="muted">Incident #${esc(a.inc)}${n > 1 ? ` · ${n} offenses in this incident (<a href="#" class="inc" data-inc="${esc(a.inc)}" data-month="${esc(a.t.slice(0, 7))}">show all</a>)` : ""}</div>
      </div>`;
    }).join("") + (list.length > shown.length ? `<p class="muted">Showing the newest ${shown.length} of ${list.length}. Use the list or download for the rest.</p>` : "")
      + (first.addr ? `<p><a href="#" class="addr" data-addr="${esc(first.addr)}">Show only this address</a></p>` : "")
      + (center ? `<p><a href="#" class="back">← Back to the area report</a></p>` : "");
    $("panel").hidden = false;
    $("panel").scrollTop = 0;
    map.invalidateSize();
    if (first.lat != null) map.panTo([first.lat, first.lon]);
  }

  // ---- the address report: a summary of the circle around a searched address
  const periodText = () => (monthsIn(bounds.from, bounds.to) === 1 ? monLabel(monKey(bounds.from)) : `${monLabel(monKey(bounds.from))} – ${monLabel(monKey(bounds.to))}`);

  function trendSvg(monthly) {
    const keys = [...monthly.keys()].slice(-TREND_MONTHS), vals = keys.map((k) => monthly.get(k));
    const W = 320, H = 96, base = 20, top = 6, bw = W / keys.length, max = Math.max(1, ...vals);
    const lo = monKey(bounds.from), hi = monKey(bounds.to);
    const bars = keys.map((k, i) => {
      const h = Math.max(vals[i] ? 1.5 : 0, (vals[i] / max) * (H - base - top));
      return `<rect class="bar${k >= lo && k <= hi ? " on" : ""}" x="${(i * bw + 0.5).toFixed(1)}" y="${(H - base - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}"><title>${monLabel(k)}: ${vals[i].toLocaleString()} offenses</title></rect>`;
    }).join("");
    // a year label under each January, so the bars can be read against the calendar
    const ticks = keys.map((k, i) => (k.endsWith("-01")
      ? `<line x1="${(i * bw).toFixed(1)}" x2="${(i * bw).toFixed(1)}" y1="${H - base}" y2="${H - base + 4}" class="tick"/><text x="${(i * bw + 2).toFixed(1)}" y="${H - 4}" class="ax">${k.slice(0, 4)}</text>` : "")).join("");
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Offenses per month near this address, latest ${keys.length} months">${bars}${ticks}
      <text x="${W}" y="${H - 4}" text-anchor="end" class="ax">${monLabel(keys.at(-1))}</text></svg>`;
  }

  function openReport() {
    if (!center) return;
    const miles = Number(readFilters().radius), n = filtered.length, within = RADIUS_LABEL[miles] || miles + " mile";
    const maxType = Math.max(1, ...TYPES.map((t) => filtered.filter((a) => a.type === t).length));
    const typeRows = TYPES.map((t) => {
      const c = filtered.filter((a) => a.type === t).length;
      return `<div class="rep-row"><span class="rep-name"><i style="background:${typeColor(t)}"></i>${esc(t)}</span><span class="rep-bar"><b style="width:${(100 * c / maxType).toFixed(1)}%;background:${typeColor(t)}"></b></span><span class="rep-n">${c.toLocaleString()}</span></div>`;
    }).join("");
    const cats = new Map();
    filtered.forEach((a) => cats.set(a.cat, (cats.get(a.cat) || 0) + 1));
    const top = [...cats].sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([c, k]) => `<li>${esc(c)} <span class="muted">${k.toLocaleString()}</span></li>`).join("");

    const monthly = new Map(D.months.map((x) => [x.m, 0]));       // every month, whatever period is chosen
    for (const a of D.records) if (curMatches(a)) { const m = a.t.slice(0, 7); monthly.set(m, (monthly.get(m) || 0) + 1); }
    const peak = [...monthly].slice(-TREND_MONTHS).sort((x, y) => y[1] - x[1])[0];

    const cityCount = D.records.filter((a) => a.date >= bounds.from && a.date <= bounds.to && curMatches(a, true, false)).length;
    const here = n / (Math.PI * miles * miles), cityDensity = cityCount / CITY_SQ_MILES;
    const fmt = (x) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString();
    const ch = changeTile(n);

    $("pTitle").textContent = $("lbl").value || "Your address";
    $("pSub").textContent = `Within ${within} · ${periodText()}`;
    $("pBody").innerHTML = `<div class="rep">
      <div class="rep-big">${n.toLocaleString()}</div>
      <div class="muted">reported offenses within ${esc(within)} (${esc(periodText())})</div>
      <p class="rep-change"><strong>${esc(ch[0])}</strong> <span class="muted">${esc(ch[1])}</span></p>
      <h3>By type</h3>${typeRows}
      <h3>Most common</h3><ol class="rep-top">${top || '<li class="muted">None reported</li>'}</ol>
      <h3>Month by month</h3>${trendSvg(monthly)}
      <p class="muted small">Offenses per month within ${esc(within)}, latest ${Math.min(TREND_MONTHS, D.months.length)} months. Darker bars are the period you chose.${peak && peak[1] ? ` Busiest month: ${monLabel(peak[0])} (${peak[1].toLocaleString()}).` : ""}</p>
      <h3>For context</h3>
      <p class="small">About <strong>${fmt(here)}</strong> offenses per square mile here, compared with <strong>${fmt(cityDensity)}</strong> across the whole city in the same period. A circle near the city limit includes land outside the city, which lowers the local figure.</p>
      <p class="muted small">These are reported offenses, not a measure of how safe a place is. Stores, hospitals and other busy places produce many reports. Click a dot on the map for the details.</p>
    </div>`;
    $("panel").hidden = false;
    $("panel").scrollTop = 0;
    map.invalidateSize();
  }

  // ---- address search
  function setAddrMsg(text) { $("addrMsg").textContent = text; }

  function inRing(ring, x, y) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function pointInGeom(g, lat, lon) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    return polys.some((p) => inRing(p[0], lon, lat) && !p.slice(1).some((h) => inRing(h, lon, lat)));
  }

  // true if the point is inside the City of St. Louis (the real outline, not a box)
  function pointInCity(lat, lon) {
    return D.city && D.city.geometry ? pointInGeom(D.city.geometry, lat, lon) : GEO.inCity(lat, lon);
  }

  function neighborhoodAt(lat, lon) {
    for (const ft of nbhdFeatures.values()) if (pointInGeom(ft.geometry, lat, lon)) return ft.properties.name;
    return null;
  }

  function clearAddress() { for (const k of ["pt", "lbl", "address"]) $(k).value = ""; setAddrMsg(""); }

  async function searchAddress(e) {
    e.preventDefault();
    const text = $("address").value.trim();
    if (!text) { setAddrMsg("Type a street address, for example 1200 Market St."); return; }
    setAddrMsg("Looking up that address…");
    try {
      await showAddressResult(await GEO.find(text, { contains: pointInCity }));
    } catch (err) {                                   // never fail silently
      console.error(err);
      setAddrMsg("Something went wrong while showing that address. Please try again.");
    }
  }

  const radiusText = () => RADIUS_LABEL[Number($("radius").value)] || $("radius").value + " mile";

  // Make a point (a found address, a dropped pin, or the device's location) the area to report on.
  function placePoint(lat, lon, label, { text = "", zoom = true, msg = "" } = {}) {
    $("pt").value = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    $("lbl").value = label;
    $("address").value = text;
    $("ward").value = ""; $("nbhd").value = "";
    layerChoice = "auto";
    apply();
    if (zoom) zoomToScope();
    setAddrMsg(msg);
  }

  // A pin placed on the map or dragged to a new spot.
  function dropPin(lat, lon, { zoom = true } = {}) {
    if (!pointInCity(lat, lon)) {
      setAddrMsg("That spot is outside the City of St. Louis. This map only has reports from the city police department.");
      renderAddress();                                           // put a dragged pin back where it was
      return;
    }
    const nb = neighborhoodAt(lat, lon);
    placePoint(lat, lon, nb ? `Pin in ${nb}` : "Pin on the map", { zoom, msg: `Showing reports within ${radiusText()} of the pin. Drag the pin to move it.` });
  }

  function setPinMode(on) {
    pinMode = on;
    $("pinBtn").setAttribute("aria-pressed", String(on));
    $("pinBtn").textContent = on ? "Cancel pin" : "Drop a pin";
    $("map").classList.toggle("pinning", on);
    if (on) setAddrMsg("Click the map where you want the center. Press Esc to cancel.");
    else if (/Click the map/.test($("addrMsg").textContent)) setAddrMsg("");
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setAddrMsg("This browser cannot share your location. Type an address or drop a pin instead."); return; }
    setAddrMsg("Finding your location… your browser may ask for permission.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      if (!pointInCity(lat, lon)) { setAddrMsg("Your location is outside the City of St. Louis. This map only has reports from the city police department."); return; }
      const nb = neighborhoodAt(lat, lon);
      placePoint(lat, lon, nb ? `Your location, in ${nb}` : "Your location", {
        msg: `Showing reports within ${radiusText()} of your location.${accuracy > 300 ? ` Your device reported about ${Math.round(accuracy)} meters of accuracy, so drag the pin if it is off.` : " Drag the pin to move it."}`,
      });
    }, (err) => {
      setAddrMsg(err && err.code === 1
        ? "Location sharing was blocked. You can allow it in your browser's site settings, or type an address or drop a pin instead."
        : "We could not get your location. Type an address or drop a pin instead.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  async function showAddressResult(r) {
    if (r.status === "ok") {
      placePoint(r.lat, r.lon, r.label, { text: r.label, msg: `Showing reports within ${radiusText()} of ${r.label}. Address found by ${r.source}. Drag the pin to adjust.` });
    } else if (r.status === "outside") {
      setAddrMsg("That address is outside the City of St. Louis. This map only has reports from the city police department.");
    } else if (r.status === "error") {
      setAddrMsg("The address lookup services did not respond. Check your connection and try again in a moment.");
    } else {
      setAddrMsg("We could not find that address. Try the street number and street name, like 1200 Market St.");
    }
  }

  function closePanel() {
    if (!$("panel") || $("panel").hidden) return;
    $("panel").hidden = true;
    map && map.invalidateSize();
  }

  // ---- ward map: each ward shaded by offenses per 1,000 residents, in five equal-sized groups of wards
  const WARD_COLORS = ["#fff1d6", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"];
  const NO_RATE_COLOR = "#b9b7b0";

  const MIN_RATE_POP = 500;      // neighborhoods with fewer residents get a count but no rate (parks, industrial areas)

  // Shade each ward or neighborhood by offenses per 1,000 residents, in five equal-sized groups of areas.
  function renderAreas(kind) {
    const isW = kind === "wards";
    const feats = isW ? wardFeatures : nbhdFeatures, counts = isW ? wardCounts : nbhdCounts;
    const key = (ft) => (isW ? String(ft.properties.ward) : ft.properties.name);
    const label = (k) => (isW ? `Ward ${k}` : k);
    const rated = (ft) => ft.properties.pop >= (isW ? 1 : MIN_RATE_POP);
    const rate = (ft) => ((counts.get(key(ft)) || 0) / ft.properties.pop) * 1000;
    const rates = [...feats.values()].filter(rated).map(rate).sort((x, y) => x - y);
    const brk = [1, 2, 3, 4].map((i) => rates[Math.floor((i * rates.length) / 5)]);        // quintile cut points
    const cls = (r) => brk.filter((b) => r >= b).length;
    const sel = isW ? $("ward").value : $("nbhd").value;
    // with a ward chosen, the neighborhoods that lie in it stay bright and the rest fade (and the reverse is not needed)
    const inWard = !isW && $("ward").value ? wardNbhds.get($("ward").value) : null;
    const dim = (k) => (sel ? sel !== k : inWard ? !inWard.has(k) : false);
    const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString();
    wardLayer = L.geoJSON({ type: "FeatureCollection", features: [...feats.values()] }, {
      style: (ft) => {
        const k = key(ft), d = dim(k);
        return { fillColor: rated(ft) ? WARD_COLORS[cls(rate(ft))] : NO_RATE_COLOR, fillOpacity: d ? 0.25 : 0.7,
                 color: css("--ink"), weight: sel === k ? 3 : 1, opacity: d ? 0.4 : 0.8 };
      },
      onEachFeature: (ft, layer) => {
        const k = key(ft), n = counts.get(k) || 0, pop = ft.properties.pop;
        layer.bindTooltip(`<strong>${esc(label(k))}</strong><br>` + (rated(ft)
          ? `${fmt(rate(ft))} offenses per 1,000 residents<br>${n.toLocaleString()} offenses · population ${pop.toLocaleString()}`
          : `${n.toLocaleString()} offenses<br>Too few residents (${pop.toLocaleString()}) for a rate`), { sticky: true });
        layer.on("click", () => (isW ? selectWard(k) : selectNbhd(k)));
      },
    }).addTo(map);
    const edges = [rates[0], ...brk, rates.at(-1)];
    $("legend").innerHTML = `<div style="margin-bottom:4px"><strong>Offenses per 1,000 residents</strong></div>` + WARD_COLORS.map((c, i) =>
      `<div><i style="background:${c};width:14px;height:14px;border-radius:3px"></i>${fmt(edges[i])} – ${fmt(edges[i + 1])}</div>`).join("")
      + (isW ? "" : `<div><i style="background:${NO_RATE_COLOR};width:14px;height:14px;border-radius:3px"></i>Fewer than ${MIN_RATE_POP} residents</div>`)
      + `<div class="muted" style="margin-top:4px">Darkest = highest fifth of ${isW ? "wards" : "neighborhoods"}</div>`;
  }

  // Subtle blue outlines that follow the area: wards for the whole city, neighborhoods inside a chosen ward,
  // and the chosen neighborhood on its own. They never take clicks, so the dots stay clickable.
  function renderOutlines() {
    if (outlineLayer) { map.removeLayer(outlineLayer); outlineLayer = null; }
    const ward = $("ward").value, nb = $("nbhd").value;
    let thin = [], thick = [];
    if (nb) thick = [nbhdFeatures.get(nb)];
    else if (ward) { thick = [wardFeatures.get(ward)]; thin = [...(wardNbhds.get(ward) || [])].map((n) => nbhdFeatures.get(n)); }
    else thin = [...wardFeatures.values()];
    const feats = [...thin, ...thick].filter(Boolean);
    if (!feats.length) return;
    const heavy = new Set(thick.filter(Boolean));
    outlineLayer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      interactive: false,
      style: (ft) => (heavy.has(ft) ? { color: css("--outline"), weight: 2.5, opacity: 0.9, fill: false } : { color: css("--outline"), weight: 1, opacity: 0.55, fill: false }),
    }).addTo(map);
  }

  // Zoom to the chosen neighborhood or ward, or back out to the whole city.
  function zoomToScope() {
    if (center) {
      const r = Math.sqrt(center.m2), dy = r / 110540, dx = r / center.kx;      // radius in degrees of latitude / longitude
      map.fitBounds([[center.lat - dy, center.lon - dx], [center.lat + dy, center.lon + dx]], { padding: [20, 20] });
      return;
    }
    const ft = nbhdFeatures.get($("nbhd").value) || wardFeatures.get($("ward").value);
    map.fitBounds(ft ? L.geoJSON(ft).getBounds() : CITY_BOUNDS, { padding: [20, 20] });
  }

  function selectWard(w) {
    $("ward").value = w;
    $("nbhd").value = "";
    layerChoice = "points";
    apply();
    zoomToScope();
  }

  function legendForDots() {
    $("legend").innerHTML = TYPES.map((t) => `<div><i style="background:${typeColor(t)};width:12px;height:12px"></i>${esc(t)}</div>`).join("")
      + `<div class="muted" style="margin-top:4px">Larger ring = more offenses at that spot</div>`;
  }

  // the searched address: a ring showing the radius, and a dot on the address itself
  function renderAddress() {
    if (addrLayer) { map.removeLayer(addrLayer); addrLayer = null; }
    if (!center) return;
    addrLayer = L.layerGroup([
      L.circle([center.lat, center.lon], { radius: Math.sqrt(center.m2), color: css("--outline"), weight: 2.5, fillColor: css("--outline"), fillOpacity: 0.06, interactive: false }),
      L.marker([center.lat, center.lon], {
        draggable: true, keyboard: false, title: "Drag to move the location",
        icon: L.divIcon({ className: "pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).on("dragend", (e) => { const p = e.target.getLatLng(); dropPin(p.lat, p.lng, { zoom: false }); }),
    ]).addTo(map);
  }

  function selectNbhd(n) {
    $("nbhd").value = n;
    $("ward").value = "";
    layerChoice = "points";
    apply();
    zoomToScope();
  }
  function renderMap() { renderLayers(); renderAddress(); }

  function renderLayers() {
    pointLayer.clearLayers();
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
    const pts = filtered.filter((a) => a.lat != null && !a.masked);   // masked offenses count everywhere but are never drawn
    const auto = layerChoice === "auto";
    let mode = auto ? "points" : layerChoice;
    if ((mode === "wards" && !D.wards) || (mode === "nbhds" && !D.nbhdShapes) || (center && (mode === "wards" || mode === "nbhds"))) mode = "points";   // area shading means nothing around one spot
    document.querySelectorAll(".seg button[data-layer='wards'], .seg button[data-layer='nbhds']").forEach((b) => { b.hidden = !!center || (b.dataset.layer === "wards" ? !D.wards : !D.nbhdShapes); });
    const heat = mode === "heat";
    document.querySelectorAll(".seg button[data-layer]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.layer === mode));
    const unmapped = filtered.length - pts.length;
    $("legnote").textContent = $("rangeNote").textContent = `${fmtDay(bounds.from)} – ${fmtDay(bounds.to)} · ${filtered.length.toLocaleString()} offenses${unmapped ? ` (${unmapped} not shown on the map)` : ""}`;
    $("mapnote").textContent = mode === "wards" || mode === "nbhds" ? `${mode === "wards" ? "Wards are" : "Neighborhoods are"} shaded by offenses per 1,000 residents. Busy shopping and work areas can look high because few people live there. Click ${mode === "wards" ? "a ward" : "a neighborhood"} to zoom in.`
      : cityLimited ? "Showing the last 6 months. Longer periods are available when you choose a ward or a neighborhood." : "";
    $("mapnote").hidden = !$("mapnote").textContent;
    if (mode === "wards" || mode === "nbhds") { renderAreas(mode); return; }
    renderOutlines();
    legendForDots();
    if (heat) {
      heatLayer = L.heatLayer(pts.map((a) => [a.lat, a.lon]), { radius: 14, blur: 18, maxZoom: 15, gradient: HEAT }).addTo(map);
      return;
    }
    const groups = new Map();
    for (const a of pts) {
      const k = a.lat.toFixed(4) + "," + a.lon.toFixed(4);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }
    const ordered = [...groups.values()].map((list) => ({
      list, worst: list.reduce((w, a) => (TYPES.indexOf(a.type) < TYPES.indexOf(w) ? a.type : w), "Other"),
    })).sort((a, b) => TYPES.indexOf(b.worst) - TYPES.indexOf(a.worst));   // worst drawn last, on top
    const surface = css("--surface");
    for (const g of ordered) {
      const a = g.list[0];
      L.circleMarker([a.lat, a.lon], {
        radius: 5 + Math.min(10, 2.2 * Math.sqrt(g.list.length - 1)), color: surface, weight: 2,
        fillColor: typeColor(g.worst), fillOpacity: 0.9,
      }).on("click", () => { if (!pinMode) openPanel(g.list); }).addTo(pointLayer);
    }
  }

  function focusRecord(id) {
    const a = D.byId.get(id);
    if (!a || a.lat == null || a.masked) return;
    const key = a.lat.toFixed(4) + "," + a.lon.toFixed(4);
    map.setView([a.lat, a.lon], 17);
    $("map").scrollIntoView({ behavior: "smooth", block: "center" });
    openPanel(filtered.filter((x) => x.lat != null && !x.masked && x.lat.toFixed(4) + "," + x.lon.toFixed(4) === key));
  }

  // Show every offense of one incident, in the month it happened.
  function showIncident(inc, month) {
    resetControls();
    $("q").value = inc;
    $("month").value = D.months.some((x) => x.m === month) ? month : "";
    $("range").value = $("month").value ? "month" : defaultRange;
    apply();
  }

  function downloadCsv() {
    const q = (v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = [...filtered].sort((a, b) => b.date - a.date).map((a) =>
      [a.t.replace("T", " "), a.est ? "yes" : "", a.masked ? "(withheld)" : a.addr, a.nbhd, a.district, a.type, a.cat, a.off, a.firearm ? "yes" : "", a.inc, a.masked ? "" : (a.lat ?? ""), a.masked ? "" : (a.lon ?? "")].map(q).join(","));
    const csv = ["when,time_not_recorded,address,neighborhood,police_district,crime_against,nibrs_category,offense,firearm,incident,lat,lon", ...rows].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `stl-crime-${monKey(bounds.from)}-to-${monKey(bounds.to)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------ table
  function flags(a) {
    const f = [];
    if (a.firearm) f.push("Firearm");
    if (a.masked) f.push("Location withheld");
    else if (a.lat == null) f.push("Not mapped");
    return f.map((x) => `<span class="flag">${esc(x)}</span>`).join("");
  }

  function detail(a) {
    const n = incCount.get(a.inc) || 1;
    return `<div class="det"><div><h3>${esc(title(a.off))}</h3><ul>
        <li>Category: ${esc(a.cat)} (${esc(a.type)})</li><li>Neighborhood: ${esc(a.nbhd)}</li>
        <li>Police district: ${esc(a.district || "unknown")}</li></ul></div></div>
      <p class="muted" style="margin:8px 0 0">Incident #${esc(a.inc)} · ${n} offense${n > 1 ? "s" : ""} in this incident${
        n > 1 ? ` (<a href="#" class="inc" data-inc="${esc(a.inc)}" data-month="${esc(a.t.slice(0, 7))}">show all</a>)` : ""}${
        a.est ? " · exact time not recorded" : ""}${
        a.masked ? " · location withheld for privacy" : a.lat != null ? ` · <a href="#" class="zoom" data-id="${esc(a.id)}">Show on map</a>` : " · location could not be mapped"}</p>`;
  }

  function sortVal(a, k) {
    return k === "t" ? a.date.getTime() : k === "loc" ? a.loc : k === "nbhd" ? a.nbhd : a.cat;
  }

  function renderTable() {
    const rows = [...filtered].sort((a, b) => {
      const x = sortVal(a, sortKey), y = sortVal(b, sortKey);
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir || b.date - a.date;
    });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    page = Math.min(page, pages - 1);
    $("count").textContent = `${filtered.length.toLocaleString()} offenses`;
    $("page").textContent = `Page ${page + 1} of ${pages}`;
    $("prev").disabled = page === 0;
    $("next").disabled = page >= pages - 1;
    $("tbl").querySelector("tbody").innerHTML = rows.slice(page * PAGE, page * PAGE + PAGE).map((a) => {
      const row = `<tr class="row" data-id="${esc(a.id)}">
        <td>${esc(fmtDate(a))}${a.est ? ' <span class="muted" title="Exact time not recorded">*</span>' : ""}</td>
        <td>${esc(a.loc) || '<span class="muted">Unknown</span>'}</td>
        <td>${esc(a.nbhd)}</td>
        <td><span class="sev"><i style="background:${typeColor(a.type)}"></i>${esc(a.cat)}</span></td>
        <td>${flags(a)}</td></tr>`;
      return open.has(a.id) ? row + `<tr class="detail"><td colspan="5">${detail(a)}</td></tr>` : row;
    }).join("");
    document.querySelectorAll("th[data-sort]").forEach((th) =>
      th.setAttribute("aria-sort", th.dataset.sort === sortKey ? (sortDir > 0 ? "ascending" : "descending") : "none"));
  }

  function renderAll() { renderTiles(); renderMap(); renderTable(); }

  // ------------------------------------------------------------ wiring
  function wire() {
    let t;
    $("q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 200); });
    // the preset menu and the month picker steer the same setting; registered before apply so they run first
    $("range").addEventListener("change", () => { $("month").value = ""; layerChoice = "auto"; });
    $("month").addEventListener("change", () => { $("range").value = $("month").value ? "month" : defaultRange; layerChoice = "auto"; });
    // the ward and neighborhood menus choose one area: picking one clears the other, then zoom to it.
    // These must be registered BEFORE the apply listeners below so the filter sees only one area.
    $("ward").addEventListener("change", () => { if ($("ward").value) { $("nbhd").value = ""; clearAddress(); } zoomToScope(); });
    $("nbhd").addEventListener("change", () => { if ($("nbhd").value) { $("ward").value = ""; clearAddress(); } zoomToScope(); });
    for (const id of ["range", "month", "ward", "cat", "nbhd", "radius", "fa", ...TYPES.map((x) => "t-" + x)]) $(id).addEventListener("change", apply);
    $("reset").addEventListener("click", () => { resetControls(); apply(); zoomToScope(); });
    $("prev").addEventListener("click", () => { page--; renderTable(); });
    $("next").addEventListener("click", () => { page++; renderTable(); });
    document.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.sort;
      sortDir = k === sortKey ? -sortDir : (k === "t" ? -1 : 1);
      sortKey = k;
      renderTable();
    }));
    $("tbl").addEventListener("click", (e) => {
      const z = e.target.closest("a.zoom");
      if (z) { e.preventDefault(); focusRecord(z.dataset.id); return; }
      const inc = e.target.closest("a.inc");
      if (inc) { e.preventDefault(); showIncident(inc.dataset.inc, inc.dataset.month); return; }
      const tr = e.target.closest("tr.row");
      if (!tr) return;
      open.has(tr.dataset.id) ? open.delete(tr.dataset.id) : open.add(tr.dataset.id);
      renderTable();
    });
    $("radius").addEventListener("change", () => { if (center) zoomToScope(); });   // runs after apply, so the new radius is in use
    $("addrForm").addEventListener("submit", searchAddress);
    $("addrClear").addEventListener("click", () => { clearAddress(); apply(); zoomToScope(); });
    $("reportBtn").addEventListener("click", openReport);
    $("pinBtn").addEventListener("click", () => setPinMode(!pinMode));
    $("locBtn").addEventListener("click", useMyLocation);
    if (!navigator.geolocation) $("locBtn").hidden = true;
    $("pClose").addEventListener("click", closePanel);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (pinMode) setPinMode(false); closePanel(); } });
    $("panel").addEventListener("click", (e) => {
      const inc = e.target.closest("a.inc");
      if (inc) { e.preventDefault(); showIncident(inc.dataset.inc, inc.dataset.month); return; }
      if (e.target.closest("a.back")) { e.preventDefault(); openReport(); return; }
      const ad = e.target.closest("a.addr");
      if (ad) { e.preventDefault(); $("q").value = ad.dataset.addr; apply(); }
    });
    $("listBtn").addEventListener("click", () => {
      const sec = $("listwrap"), show = sec.hidden;
      sec.hidden = !show;
      $("listBtn").setAttribute("aria-expanded", String(show));
      $("listBtn").textContent = show ? "Hide list" : "List";
      if (show) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("csvBtn").addEventListener("click", downloadCsv);
  }

  async function main() {
    D = await CRIME.load();
    D.records.forEach((a) => incCount.set(a.inc, (incCount.get(a.inc) || 0) + 1));

    const counts = new Map();
    D.records.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    $("cat").innerHTML = '<option value="">Any category</option>' + D.types.map((t) =>
      `<optgroup label="${esc(t)}">${D.cats[t].map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</optgroup>`).join("");
    $("nbhd").innerHTML = '<option value="">Any neighborhood</option>' + D.nbhds.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");

    const day = (s) => new Date(s + "T12:00").toLocaleDateString("en-US", DATE);
    const mon = (m) => new Date(m + "-15T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("sub").textContent = `${D.records.length.toLocaleString()} reported offenses in the City of St. Louis, ${mon(D.months[0].m)} – ${mon(D.months.at(-1).m)}. Data through ${day(D.through)}; the City adds each month around the 5th of the next.`;

    if (D.wards) {
      D.wards.features.forEach((ft) => wardFeatures.set(String(ft.properties.ward), ft));
      const nums = [...wardFeatures.keys()].sort((x, y) => x - y);
      $("ward").innerHTML = '<option value="">Any ward</option>' + nums.map((w) => `<option value="${w}">Ward ${w}</option>`).join("");
    } else {
      $("ward").hidden = true;
      document.querySelector('.seg button[data-layer="wards"]').hidden = true;
    }
    if (D.nbhdShapes) D.nbhdShapes.features.forEach((ft) => nbhdFeatures.set(ft.properties.name, ft));
    // which neighborhoods lie (mostly) in each ward, from where their offenses were reported
    const wn = new Map(), total = new Map();
    for (const a of D.records) if (a.ward && a.nbhd) {
      const m = wn.get(a.ward) || new Map(); m.set(a.nbhd, (m.get(a.nbhd) || 0) + 1); wn.set(a.ward, m);
      total.set(a.nbhd, (total.get(a.nbhd) || 0) + 1);
    }
    // a neighborhood belongs to a ward if at least 10% of its offenses fall there (ignores stray geocoding)
    wn.forEach((m, w) => wardNbhds.set(w, new Set([...m].filter(([n, c]) => c >= 5 && c / total.get(n) >= 0.1).map(([n]) => n))));

    buildRangeOptions();
    readHash();
    initMap();
    wire();
    apply();
    zoomToScope();
  }

  main().catch((e) => { $("sub").textContent = "Could not load data: " + e.message + " (open the page through a local web server, not by double-clicking the file)."; });
})();
