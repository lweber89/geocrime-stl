/* when.js: the one place that turns a `when` value (see filters.js) into months, labels and a comparison period.
 * Pure functions over the list of month keys the data has (["2024-01", ..., "2026-09"]); no page or DOM code.
 *
 *   WHEN.resolve("l6", keys)   -> { when, kind, from, to, months, n }   (null if the value is unknown or outside the data)
 *   WHEN.prior("ytd", keys)    -> { months, n, label }                  (null when the data does not go back far enough)
 *   WHEN.label("l6", keys)     -> "Last 6 months"
 *   WHEN.dates("l6", keys)     -> "Apr – Sep 2026"                      (the months it covers, for a second line of text)
 *   WHEN.presets(keys)         -> [{ when: "latest", label: "Latest month (Sep 2026)" }, { when: "l3", ... }, ...]
 *
 * `when` values: latest, l3, l6, l12, l24, ytd, all, "2026-09" (one month), "2026-03..2026-09" (a span).
 *
 * The comparison period (the "change" figures on every page):
 *   - Year to date is compared with the same months of the previous year (Jan-Sep 2026 against Jan-Sep 2025).
 *   - Anything else is compared with the same number of months immediately before it.
 *   - If the data does not reach back that far there is no comparison (null), never a partial one.
 */
(() => {
  "use strict";

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  const monLabel = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const addMonths = (key, n) => {                       // "2026-01" + -1 -> "2025-12"
    const i = Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1 + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  };
  const between = (keys, from, to) => keys.filter((k) => k >= from && k <= to);

  const PRESET_N = { l3: 3, l6: 6, l12: 12, l24: 24 };
  const PRESET_LABEL = { l3: "Last 3 months", l6: "Last 6 months", l12: "Last 12 months", l24: "Last 24 months", ytd: "Year to date", all: "All data" };

  function resolve(when, keys) {
    if (!keys || !keys.length) return null;
    const first = keys[0], last = keys[keys.length - 1];
    const make = (kind, from, to) => {
      const months = between(keys, from, to);
      return months.length ? { when, kind, from: months[0], to: months[months.length - 1], months, n: months.length } : null;
    };
    if (when === "latest") return make("latest", last, last);
    if (PRESET_N[when]) return make("preset", keys[Math.max(0, keys.length - PRESET_N[when])], last);
    if (when === "all") return make("all", first, last);
    if (when === "ytd") { const jan = last.slice(0, 4) + "-01"; return make("ytd", jan < first ? first : jan, last); }
    if (MONTH.test(when)) return keys.includes(when) ? make("month", when, when) : null;
    const span = String(when).split("..");
    if (span.length === 2 && MONTH.test(span[0]) && MONTH.test(span[1]) && span[0] <= span[1]) return make("span", span[0], span[1]);
    return null;
  }

  function prior(when, keys) {
    const r = resolve(when, keys);
    if (!r) return null;
    const have = new Set(keys);
    if (r.kind === "ytd") {                             // the same months of the previous year, all of them must be in the data
      const months = r.months.map((k) => addMonths(k, -12));
      if (r.months[0].slice(5) !== "01" || !months.every((k) => have.has(k))) return null;
      return { months, n: months.length, label: `the same months of ${months[0].slice(0, 4)}` };
    }
    const months = Array.from({ length: r.n }, (_, i) => addMonths(r.from, i - r.n));
    if (!months.every((k) => have.has(k))) return null;
    return { months, n: r.n, label: r.n === 1 ? monLabel(months[0]) : `the previous ${r.n} months` };
  }

  // The months a period covers: "Sep 2026", "Apr – Sep 2026" (same year) or "Nov 2025 – Sep 2026".
  function dates(when, keys) {
    const r = resolve(when, keys);
    if (!r) return "";
    if (r.from === r.to) return monLabel(r.from);
    return r.from.slice(0, 4) === r.to.slice(0, 4) ? `${MON[Number(r.from.slice(5, 7)) - 1]} – ${monLabel(r.to)}` : `${monLabel(r.from)} – ${monLabel(r.to)}`;
  }

  function label(when, keys) {
    if (when === "latest") return keys && keys.length ? `Latest month (${monLabel(keys[keys.length - 1])})` : "Latest month";
    if (PRESET_LABEL[when]) return PRESET_LABEL[when];
    const r = resolve(when, keys);
    return r ? dates(when, keys) : "";
  }

  const presets = (keys) => ["latest", "l3", "l6", "l12", "ytd", "all"].map((w) => ({ when: w, label: label(w, keys) }));

  // The month picker's grid: one entry per year, each with its twelve months and whether the data has them.
  function grid(keys) {
    if (!keys || !keys.length) return [];
    const have = new Set(keys), out = [];
    for (let y = Number(keys[0].slice(0, 4)); y <= Number(keys[keys.length - 1].slice(0, 4)); y++) {
      out.push({ year: y, months: MON.map((name, i) => { const key = `${y}-${String(i + 1).padStart(2, "0")}`; return { key, name, has: have.has(key) }; }) });
    }
    return out;
  }

  const api = { resolve, prior, dates, label, presets, grid, monLabel, addMonths, PRESET_LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.WHEN = api;
})();
