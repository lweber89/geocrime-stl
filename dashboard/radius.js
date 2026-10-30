/* radius.js: the choices for the distance around an address or pin, shared by the map and the Charts page, with no page
 * code so it can be tested on its own (node --test tests/js/radius.test.js).
 *
 * The distance moves in steps of an eighth of a mile, from 1/8 to 1 mile. Steps keep shared links tidy and the labels
 * readable ("3/8 mile"); a smooth slider would imply more precision than block-level addresses have.
 *
 *   RADIUS.snap("0.3")   -> 0.25     nearest allowed distance; empty or junk text gives the default (0.5)
 *   RADIUS.label(0.375)  -> "⅜ mile"
 */
(() => {
  "use strict";
  const MIN = 0.125, MAX = 1, STEP = 0.125, DEFAULT = 0.5;
  const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];       // index = number of eighths of a mile

  function snap(value) {
    if (value == null || String(value).trim() === "") return DEFAULT;
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT;
    return Math.round(Math.min(MAX, Math.max(MIN, n)) / STEP) * STEP;      // multiples of 1/8 are exact in binary, so no rounding drift
  }

  function label(value) {
    const eighths = Math.round(snap(value) / STEP);
    return eighths >= 8 ? "1 mile" : EIGHTHS[eighths] + " mile";
  }

  const api = { MIN, MAX, STEP, DEFAULT, snap, label };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RADIUS = api;
})();
