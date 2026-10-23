(() => {
  "use strict";

  const TYPES = ["Person", "Property", "Society", "Other"];   // worst first: drives colour priority on the map
  const PAGE = 100;
  const HEAT_AFTER_DAYS = 183;                                // date spans longer than ~6 months open as a heat map
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
  let defaultRange = "all", longSpan = false;
  const incCount = new Map();

  // ------------------------------------------------------------ filters
  const FIELDS = ["q", "range", "from", "to", "cat", "nbhd"];

  // ---- date ranges: calendar months, because the City publishes whole months (no "last 7 days")
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monLabel = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const monStart = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  const monEnd = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0, 23, 59, 59);
  const fmtDay = (d) => d.toLocaleDateString("en-US", DATE);

  // Returns { from, to } as Dates (always real dates: "all" uses the first and last month in the data).
  function rangeBounds(f) {
    const keys = D.months.map((x) => x.m), last = keys.at(-1), first = keys[0];
    const back = (n) => keys[Math.max(0, keys.length - n)];
    const v = f.range;
    if (v === "custom") {
      return { from: f.from ? new Date(f.from + "T00:00") : monStart(first), to: f.to ? new Date(f.to + "T23:59:59") : monEnd(last) };
    }
    if (v.startsWith("m:")) return { from: monStart(v.slice(2)), to: monEnd(v.slice(2)) };
    if (v === "last3") return { from: monStart(back(3)), to: monEnd(last) };
    if (v === "last12") return { from: monStart(back(12)), to: monEnd(last) };
    if (v === "ytd") { const jan = last.slice(0, 4) + "-01"; return { from: monStart(jan < first ? first : jan), to: monEnd(last) }; }
    return { from: monStart(first), to: monEnd(last) };                       // "all"
  }

  function buildRangeOptions() {
    const keys = D.months.map((x) => x.m), last = keys.at(-1), first = keys[0];
    const back = (n) => keys[Math.max(0, keys.length - n)];
    const span = (a, b) => (a === b ? monLabel(a) : `${monLabel(a)} – ${monLabel(b)}`);
    const jan = last.slice(0, 4) + "-01";
    const opt = (v, t) => `<option value="${v}">${esc(t)}</option>`;
    defaultRange = "m:" + last;
    $("range").innerHTML =
      opt("m:" + last, `${monLabel(last)} (latest month)`)
      + opt("last3", `Last 3 months (${span(back(3), last)})`)
      + opt("last12", `Last 12 months (${span(back(12), last)})`)
      + opt("ytd", `Year to date (${span(jan < first ? first : jan, last)})`)
      + opt("all", `All dates (${span(first, last)})`)
      + `<optgroup label="A single month">${[...keys].reverse().map((k) => opt("m:" + k, monLabel(k))).join("")}</optgroup>`
      + opt("custom", "Custom dates…");
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
    for (const k of FIELDS) if (f[k] && !(k === "range" && f[k] === defaultRange)) p.set(k, f[k]);
    if (f.fa) p.set("fa", "1");
    if (f.hide.length) p.set("hide", f.hide.join(","));
    history.replaceState(null, "", p.toString() ? "#" + p : location.pathname);
  }

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of FIELDS) if (p.has(k)) $(k).value = p.get(k);
    if (!$("range").value) $("range").value = defaultRange;      // an old or unknown range in the link
    $("fa").checked = p.get("fa") === "1";
    const hide = (p.get("hide") || "").split(",");
    TYPES.forEach((t) => ($("t-" + t).checked = !hide.includes(t)));
    $("customRange").hidden = $("range").value !== "custom";
  }

  function resetControls() {
    for (const k of ["q", "from", "to", "cat", "nbhd"]) $(k).value = "";
    $("fa").checked = false;
    TYPES.forEach((t) => ($("t-" + t).checked = true));
    $("range").value = defaultRange;
    layerChoice = "auto";
  }

  function apply() {
    const f = readFilters();
    writeHash(f);
    $("customRange").hidden = f.range !== "custom";
    const { from, to } = rangeBounds(f);
    longSpan = (to - from) / 86400000 > HEAT_AFTER_DAYS;
    $("rangeNote").textContent = `${fmtDay(from)} – ${fmtDay(to)}`;
    const terms = f.q.trim().toUpperCase().split(/\s+/).filter(Boolean);
    filtered = D.records.filter((a) => {
      if (a.date < from || a.date > to) return false;
      if (f.hide.includes(a.type)) return false;
      if (f.cat && a.cat !== f.cat) return false;
      if (f.nbhd && a.nbhd !== f.nbhd) return false;
      if (f.fa && !a.firearm) return false;
      if (terms.length && !terms.every((t) => a.text.includes(t))) return false;
      return true;
    });
    page = 0;
    renderAll();
  }

  // ------------------------------------------------------------ tiles
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
      [pct(filtered.filter((a) => a.lat != null).length), "shown on map"],
    ];
    $("tiles").innerHTML = t.map(([v, l, c]) => `<div class="tile"><div class="v ${c || ""}">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join("");
  }

  // ------------------------------------------------------------ map
  function initMap() {
    map = L.map("map", { preferCanvas: true, zoomSnap: 0.25 }).fitBounds([[38.532, -90.32], [38.774, -90.166]]);
    const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light"
              || document.documentElement.dataset.theme === "dark";
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: dark ? "tiles-dark" : "tiles-light",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    pointLayer = L.layerGroup().addTo(map);
    document.querySelectorAll(".seg button[data-layer]").forEach((b) => b.addEventListener("click", () => {
      layerChoice = b.dataset.layer;
      renderMap();
    }));
    $("legend").innerHTML = TYPES.map((t) => `<div><i style="background:${typeColor(t)};width:12px;height:12px"></i>${esc(t)}</div>`).join("")
      + `<div class="muted" style="margin-top:4px">Larger ring = more offenses at that spot</div>`;
  }

  function popupHtml(list) {
    list = [...list].sort((a, b) => b.date - a.date);
    const head = `<strong>${esc(list[0].loc)}</strong><div class="muted">${list.length} offense${list.length > 1 ? "s" : ""}</div>`;
    const items = list.slice(0, 25).map((a) => `<div class="pop-item">
      <span class="sev"><i style="background:${typeColor(a.type)}"></i>${esc(a.cat)}</span> · ${esc(fmtDate(a))}<br>
      <span class="muted">${esc(title(a.off))}</span><br><a href="#" data-id="${esc(a.id)}" class="poplink">Details</a></div>`).join("");
    return head + items + (list.length > 25 ? `<div class="muted">+${list.length - 25} more, see table</div>` : "");
  }

  function renderMap() {
    pointLayer.clearLayers();
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    const pts = filtered.filter((a) => a.lat != null);
    const auto = layerChoice === "auto";
    const heat = layerChoice === "heat" || (auto && longSpan);
    document.querySelectorAll(".seg button[data-layer]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.layer === (heat ? "heat" : "points")));
    $("mapnote").textContent = auto && longSpan
      ? `Showing a heat map because the dates cover more than 6 months (${pts.length.toLocaleString()} offenses). Choose "Locations" to see individual spots, or pick a shorter period.`
      : !heat && longSpan ? `Showing individual locations for ${pts.length.toLocaleString()} offenses. This long a period can be slow to draw.` : "";
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
      }).bindPopup(() => popupHtml(g.list), { maxWidth: 320 }).addTo(pointLayer);
    }
  }

  function focusRecord(id) {
    const a = D.byId.get(id);
    if (!a || a.lat == null) return;
    map.setView([a.lat, a.lon], 17);
    $("map").scrollIntoView({ behavior: "smooth", block: "center" });
    L.popup({ maxWidth: 320 }).setLatLng([a.lat, a.lon]).setContent(popupHtml([a])).openOn(map);
  }

  // ------------------------------------------------------------ table
  function flags(a) {
    const f = [];
    if (a.firearm) f.push("Firearm");
    if (a.lat == null) f.push("Not mapped");
    return f.map((x) => `<span class="flag">${esc(x)}</span>`).join("");
  }

  function detail(a) {
    const n = incCount.get(a.inc) || 1;
    return `<div class="det"><div><h3>${esc(title(a.off))}</h3><ul>
        <li>Category: ${esc(a.cat)} (${esc(a.type)})</li><li>Neighborhood: ${esc(a.nbhd)}</li>
        <li>Police district: ${esc(a.district || "unknown")}</li></ul></div></div>
      <p class="muted" style="margin:8px 0 0">Incident #${esc(a.inc)} · ${n} offense${n > 1 ? "s" : ""} in this incident${
        n > 1 ? ` (<a href="#" class="inc" data-inc="${esc(a.inc)}">show all</a>)` : ""}${
        a.est ? " · exact time not recorded" : ""}${
        a.lat != null ? ` · <a href="#" class="zoom" data-id="${esc(a.id)}">Show on map</a>` : " · location could not be mapped"}</p>`;
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
    $("range").addEventListener("change", () => { layerChoice = "auto"; });   // a new period gets the default layer again
    for (const id of ["range", "from", "to", "cat", "nbhd", "fa", ...TYPES.map((x) => "t-" + x)]) $(id).addEventListener("change", apply);
    $("reset").addEventListener("click", () => { resetControls(); apply(); });
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
      if (inc) { e.preventDefault(); resetControls(); $("q").value = inc.dataset.inc; $("range").value = "all"; apply(); return; }
      const tr = e.target.closest("tr.row");
      if (!tr) return;
      open.has(tr.dataset.id) ? open.delete(tr.dataset.id) : open.add(tr.dataset.id);
      renderTable();
    });
    $("map").addEventListener("click", (e) => {
      const l = e.target.closest("a.poplink");
      if (!l) return;
      e.preventDefault();
      const id = l.dataset.id;
      open.add(id);
      sortKey = "t"; sortDir = -1;
      const idx = [...filtered].sort((a, b) => b.date - a.date).findIndex((a) => a.id === id);
      page = Math.max(0, Math.floor(idx / PAGE));
      renderTable();
      document.querySelector(`tr.row[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function main() {
    D = await CRIME.load();
    D.records.forEach((a) => incCount.set(a.inc, (incCount.get(a.inc) || 0) + 1));

    const counts = new Map();
    D.records.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    $("cat").innerHTML = '<option value="">Any category</option>' + D.types.map((t) =>
      `<optgroup label="${esc(t)}">${D.cats[t].map((c) => `<option value="${esc(c)}">${esc(c)} (${counts.get(c).toLocaleString()})</option>`).join("")}</optgroup>`).join("");
    $("nbhd").innerHTML = '<option value="">Any neighborhood</option>' + D.nbhds.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");

    const day = (s) => new Date(s + "T12:00").toLocaleDateString("en-US", DATE);
    const mon = (m) => new Date(m + "-15T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("sub").textContent = `${D.records.length.toLocaleString()} reported offenses in the City of St. Louis, ${mon(D.months[0].m)} – ${mon(D.months.at(-1).m)}. Data through ${day(D.through)}; the City adds each month around the 5th of the next.`;

    buildRangeOptions();
    readHash();
    initMap();
    wire();
    apply();
  }

  main().catch((e) => { $("sub").textContent = "Could not load data: " + e.message + " (open the page through a local web server, not by double-clicking the file)."; });
})();
