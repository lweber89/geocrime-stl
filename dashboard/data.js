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
      const [inc, t, lat, lon, addr, ty, ca, of, nb, district, fa, est, wd] = row;
      const a = {
        id: `${m}-${i}`, inc, t, lat, lon, addr,
        type: d.type[ty], cat: d.cat[ca], off: d.off[of], nbhd: d.nbhd[nb],
        district, firearm: fa === 1,
        ward: wd >= 0 ? d.ward[wd] : null,        // "1"-"14", or null when the point has no ward
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

    const byId = new Map(records.map((a) => [a.id, a]));
    const maxDate = records.reduce((m, a) => (a.date > m ? a.date : m), new Date(0));

    const uniq = (f) => [...new Set(records.map(f))].filter(Boolean);
    const cats = {};                         // type -> categories sorted by count
    const counts = new Map();
    records.forEach((a) => counts.set(a.cat, (counts.get(a.cat) || 0) + 1));
    records.forEach((a) => { (cats[a.type] = cats[a.type] || new Set()).add(a.cat); });
    for (const t of Object.keys(cats)) cats[t] = [...cats[t]].sort((x, y) => counts.get(y) - counts.get(x));

    return {
      records, byId, maxDate,
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

  window.CRIME = { load, incidents, title };
})();
