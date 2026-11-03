/* data.js: loads the monthly files and exposes one clean CRIME object to every page.
 *
 *   const D = await CRIME.load();                  // everything
 *   const D = await CRIME.load({ months: 2 });     // newest 2 months only (fast first paint)
 *
 * D = { records, byId, maxDate, through, completeThrough, months, types, cats, nbhds, districts }
 *
 * Each record (one row = one OFFENSE; an incident can have several offenses):
 *   id        unique row id, e.g. "2026-09-117"
 *   inc       City incident number (repeats across offenses)
 *   t, date   ISO local time string and Date
 *   lat, lon  numbers, or null when unmapped
 *   addr, loc raw address and a Title Case label
 *   type      "Person" | "Property" | "Society" | "Other"
 *   cat       NIBRS category (53 values)
 *   off       specific offense text
 *   nbhd, district
 *   ward      "1"-"14" (City wards, 2023 boundaries) or null
 *   firearm   boolean
 *   text      uppercase search blob
 */
(() => {
  "use strict";

  const title = (s) => (s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  const TYPE_ORDER = ["Person", "Property", "Society", "Other"];

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  function normalize(file) {
    const { m, d, r } = file;
    return r.map((row, i) => {
      const [inc, t, lat, lon, addr, ty, ca, of, nb, district, fa, est, wd, mk] = row;
      const a = {
        id: `${m}-${i}`, inc, t, lat, lon, addr,
        type: d.type[ty], cat: d.cat[ca], off: d.off[of], nbhd: d.nbhd[nb],
        district, firearm: fa === 1,
        ward: wd >= 0 ? d.ward[wd] : null,        // "1"-"14", or null when the point has no ward
        masked: mk === 1,                     // sensitive offense: no address, coarse location, never drawn as a dot
        est: est === 1,                      // time probably a placeholder (00:00 / 12:00)
      };
      a.date = new Date(t);                 // "YYYY-MM-DDTHH:MM" parses as local time
      a.loc = title(addr);
      a.text = [inc, addr, a.nbhd, a.cat, a.off].join(" ").toUpperCase();
      return a;
    });
  }

  async function load(opts = {}) {
    const manifest = await getJSON("data/manifest.json?v=" + Date.now());
    let list = manifest.months.map((x) => x.m);
    if (opts.months && opts.months !== "all") list = list.slice(-opts.months);

    const files = await Promise.all(list.map((m) => getJSON(`data/${m}.json?v=${manifest.built}`)));
    const records = files.flatMap(normalize);

    let wards = null;                                    // ward outlines + population (absent in older feeds)
    try { wards = await getJSON("data/wards.geojson?v=" + manifest.built); } catch (e) { /* optional */ }

    let city = null;                                     // city limit outline (optional)
    try { city = await getJSON("data/city.geojson?v=" + manifest.built); } catch (e) { /* optional */ }
    let nbhdShapes = null;                               // neighborhood outlines + population (optional)
    try { nbhdShapes = await getJSON("data/neighborhoods.geojson?v=" + manifest.built); } catch (e) { /* optional */ }

    const byId = new Map(records.map((a) => [a.id, a]));
    const maxDate = records.reduce((m, a) => (a.date > m ? a.date : m), new Date(0));

    const uniq = (f) => [...new Set(records.map(f))].filter(Boolean);
    const cats = {};                         // type -> categories sorted by count
    const counts = new Map();
    records.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    records.forEach((a) => { (cats[a.type] = cats[a.type] || new Set()).add(a.cat); });
    for (const t of Object.keys(cats)) cats[t] = [...cats[t]].sort((x, y) => counts.get(y) - counts.get(x));

    return {
      records, byId, maxDate, wards, nbhdShapes, city,
      through: manifest.through,
      completeThrough: manifest.completeThrough,
      months: manifest.months,
      partial: opts.months && opts.months !== "all",   // true if only some months were loaded
      types: TYPE_ORDER.filter((t) => cats[t]),
      cats,                                            // { Person: [...], Property: [...], ... }
      nbhds: uniq((a) => a.nbhd).sort(),
      districts: uniq((a) => a.district).sort(),
    };
  }

  // Distinct incidents in a list of offense rows (for tiles: "offenses" vs "incidents").
  const incidents = (list) => new Set(list.map((a) => a.inc)).size;

  // The months the data covers, for the line under each page title: "Jan 2024 – Sep 2026".
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const span = (months) => {
    const name = (m) => `${SHORT_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
    return `${name(months[0].m)} – ${name(months[months.length - 1].m)}`;
  };

  // Keep a Leaflet map on the city. The person can zoom in anywhere but cannot zoom out past the whole-city view, and if
  // any move (a drag, the keyboard, a flick) ends with the middle of the map off the city, the map glides back to the
  // whole-city view, the same view the Reset button gives. `bounds` is [[south, west], [north, east]]. There is no hard
  // pan limit: one made a ward on the edge of the city impossible to center, because its view reaches past the limit.
  // The whole-city zoom depends on the size of the map box, so it is worked out again whenever the box changes size.
  function lockExtent(map, bounds) {
    const fit = () => {
      const size = map.getSize();
      if (!size.x || !size.y) return;                       // box not laid out yet (hidden or zero height); try again on resize
      map.setMinZoom(map.getBoundsZoom(bounds));
    };
    fit();
    map.on("resize", fit);
    let snapping = false;
    map.on("moveend", () => {
      if (snapping) return;
      const c = map.getCenter();
      if (c.lat >= bounds[0][0] && c.lat <= bounds[1][0] && c.lng >= bounds[0][1] && c.lng <= bounds[1][1]) return;
      snapping = true;
      map.once("moveend", () => { snapping = false; });
      map.fitBounds(bounds, { padding: [20, 20] });
    });
  }

  // How a change against an earlier period reads everywhere on the site: an arrow and a sign in plain text, so it
  // works without color (and carries no good-or-bad meaning): "▲ +12%", "▼ −8%", "No change". An earlier period with
  // nothing in it gives "new" when something was reported now, and "–" when there is nothing to compare. When the earlier
  // period had fewer than MIN_BASE offenses a percentage swings wildly (3 to 6 is "+100%"), so the change is written as a
  // count instead: "▲ +3 offenses".
  const MIN_BASE = 10;
  function pct(n, prior) {
    if (prior == null) return "–";
    if (!prior) return n ? "new" : "–";
    if (n === prior) return "No change";
    if (prior < MIN_BASE) {
      const d = Math.abs(n - prior), unit = d === 1 ? "offense" : "offenses";
      return n > prior ? `▲ +${d} ${unit}` : `▼ −${d} ${unit}`;
    }
    const p = Math.round((100 * (n - prior)) / prior);
    return p > 0 ? `▲ +${p}%` : p < 0 ? `▼ −${-p}%` : "No change";
  }

  // The line under each page title (the "These are reported offenses..." sentence follows it in the page itself). It says
  // what data exists, so it is not mistaken for the period the person has chosen.
  const dataNote = (months) => `Data available: ${span(months)} · Updated monthly.`;

  const api = { load, incidents, title, span, dataNote, lockExtent, pct, MIN_BASE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.CRIME = api;
})();
