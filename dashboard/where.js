/* where.js: the rules for the "Where" filter, with no page code, so every page follows the same ones.
 *
 * An area is { ward, nbhd, pt, lbl }: a ward number ("5"), a neighborhood name, or a searched address or dropped pin
 * (pt = "lat,lon", lbl = what to call it). The rules:
 *   - one area at a time: choosing a ward clears the neighborhood and the other way round;
 *   - an address or pin locks the ward and neighborhood choices until it is cleared;
 *   - clicking the area that is already chosen clears it.
 *
 *   WHERE.label({ ward: "5" })                    -> "Ward 5"
 *   WHERE.label({ pt: "38.6,-90.2", lbl: "1 Main St" }, "½ mile") -> "1 Main St · ½ mile"
 *   WHERE.choose(area, "ward", "5")               -> { ward: "5", nbhd: "" }   (the new ward and neighborhood)
 *   WHERE.locked(area)                            -> true while an address or pin is chosen
 *   WHERE.matches(record, area)                   -> does an offense fall in the chosen ward or neighborhood?
 *   WHERE.filterNames(names, text)                -> the neighborhoods that match what was typed
 */
(() => {
  "use strict";

  const locked = (a) => !!(a && a.pt);

  function label(a, radiusLabel) {
    if (!a) return "Whole city";
    if (a.pt) return (a.lbl || "Chosen spot") + (radiusLabel ? " · " + radiusLabel : "");
    if (a.nbhd) return a.nbhd;
    if (a.ward) return "Ward " + a.ward;
    return "Whole city";
  }

  function choose(a, kind, value) {
    if (locked(a)) return { ward: a.ward || "", nbhd: a.nbhd || "" };
    const cur = kind === "ward" ? a.ward : a.nbhd;
    const next = cur === value ? "" : value;                                  // the same one again clears it
    return kind === "ward" ? { ward: next, nbhd: "" } : { ward: "", nbhd: next };
  }

  const matches = (r, a) => (!a.ward || r.ward === a.ward) && (!a.nbhd || r.nbhd === a.nbhd);

  // Names that contain the typed text (ignoring case and the apostrophes and punctuation the City leaves out).
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  function filterNames(names, text) {
    const t = norm(text);
    return t ? names.filter((n) => norm(n).includes(t)) : names.slice();
  }

  const api = { label, choose, locked, matches, filterNames };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.WHERE = api;
})();
