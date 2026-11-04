/* filters.js: the one list of filter names, and the one way to read and write them in the page link.
 *
 * The Explorer has three kinds of filter, and every page link carries them the same way:
 *   Where   ward, nbhd, pt ("lat,lon" of an address or pin), lbl (its label), radius
 *   When    one shared period, written `when` here (see below)
 *   What    cat (offense category), fa (firearm), hide (offense types switched off), gb (Group B on), q (search text)
 * Anything else in a link (tab, mode, sort ...) belongs to one page and is passed through untouched as `other`.
 *
 * `when` values (the same words on every page):
 *   l3, l6, l12, l24   the latest 3, 6, 12 or 24 months      ytd   this year so far      all   every month we have
 *   latest             the latest month                       2026-09   one month        2026-03..2026-09   a span of months
 * Each page still writes its own older names for the period (the map: range and month; Hotspots and Charts: per),
 * and this file converts both ways, so every older link keeps working.
 *
 *   const s = FILTERS.parse(location.hash);          // { ward, nbhd, pt, lbl, radius, cat, q, fa, hide, gb, when, other }
 *   FILTERS.hash("charts", s)                        // the link fragment the Charts page understands, e.g. "ward=5&cat=Robbery&per=p6"
 *   FILTERS.page("charts")                           // "charts.html"
 */
(() => {
  "use strict";

  const WHERE = ["ward", "nbhd", "pt", "lbl", "radius"];
  // What each page understands. Hotspots has no place filters yet; the map and Charts understand them all.
  const PAGE = {
    map: { file: "./", keys: [...WHERE, "q", "cat", "fa", "hide", "gb"], period: "range" },
    charts: { file: "charts.html", keys: [...WHERE, "cat", "fa", "gb"], period: "per" },
    hotspots: { file: "hotspots.html", keys: ["cat", "fa", "gb"], period: "per" },
  };

  const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  const RANGE_OF_WHEN = { l3: "last3", l6: "last6", l12: "last12", l24: "all", ytd: "ytd", all: "all" };  // the map has no 24-month preset
  const WHEN_OF_RANGE = { last3: "l3", last6: "l6", last12: "l12", ytd: "ytd", all: "all" };
  const PER_OF_WHEN = { l3: "p3", l6: "p6", l12: "p12", l24: "p24", all: "all" };
  const WHEN_OF_PER = { p3: "l3", p6: "l6", p12: "l12", p24: "l24", all: "all" };

  // Is this a `when` value we understand? Returns it, or "" for anything unknown or hand-edited.
  function cleanWhen(v) {
    v = String(v || "");
    if (["latest", "l3", "l6", "l12", "l24", "ytd", "all"].includes(v) || MONTH.test(v)) return v;
    const span = v.split("..");
    if (span.length === 2 && MONTH.test(span[0]) && MONTH.test(span[1]) && span[0] <= span[1]) return v;
    return "";
  }

  // The period of a link, whichever names it uses. An explicit `when` wins over the older names.
  function whenOf(p) {
    const w = cleanWhen(p.get("when"));
    if (w) return w;
    const month = p.get("month") || "", range = p.get("range") || "", per = p.get("per") || "";
    if (MONTH.test(month)) return month;
    if (range.startsWith("m:") && MONTH.test(range.slice(2))) return range.slice(2);
    return WHEN_OF_RANGE[range] || WHEN_OF_PER[per] || "";
  }

  function parse(hash) {
    const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    const known = new Set([...PAGE.map.keys, "when", "range", "month", "per"]);
    const other = new URLSearchParams();
    p.forEach((v, k) => { if (!known.has(k)) other.set(k, v); });
    const s = { when: whenOf(p), other, fa: p.get("fa") === "1", gb: p.get("gb") === "1",
                hide: (p.get("hide") || "").split(",").filter(Boolean) };
    for (const k of [...WHERE, "q", "cat"]) s[k] = p.get(k) || "";
    return s;
  }

  // The link fragment (no leading #) that `page` understands for the filters in `s`. Pass `when` only when the period
  // should travel with the link. `extra` adds page-specific values; empty ones are left out.
  function hash(page, s, extra = {}) {
    const def = PAGE[page], p = new URLSearchParams();
    for (const k of def.keys) {
      const v = s[k];
      if (k === "fa" || k === "gb") { if (v) p.set(k, "1"); }
      else if (k === "hide") { if (v && v.length) p.set(k, v.join(",")); }
      else if (v) p.set(k, v);
    }
    if (s.when) {
      if (def.period === "range") {
        if (MONTH.test(s.when)) p.set("month", s.when);
        else if (RANGE_OF_WHEN[s.when]) p.set("range", RANGE_OF_WHEN[s.when]);
      } else if (PER_OF_WHEN[s.when]) p.set("per", PER_OF_WHEN[s.when]);
    }
    for (const [k, v] of Object.entries(extra)) if (v !== "" && v != null) p.set(k, v);
    return p.toString();
  }

  const page = (name) => PAGE[name].file;
  const link = (name, s, extra) => { const h = hash(name, s, extra); return PAGE[name].file + (h ? "#" + h : ""); };

  const api = { parse, hash, link, page, cleanWhen, WHERE, WHEN_OF_PER, PER_OF_WHEN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.FILTERS = api;
})();
