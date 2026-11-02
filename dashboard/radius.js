/* radius.js: the choices for the distance around an address or pin, shared by the map and the Charts page, with no page
 * code so it can be tested on its own (node --test tests/js/radius.test.js).
 *
 * The distance moves in steps of a quarter mile, from 1/4 to 1 mile. Steps keep shared links tidy and the labels
 * readable ("3/4 mile"); a smooth slider would imply more precision than block-level addresses have. Finer steps also
 * let a person find a masked (sensitive) offense by watching the "not mapped" count change, so 1/4 mile is the floor.
 *
 *   RADIUS.snap("0.3")   -> 0.25     nearest allowed distance; empty or junk text gives the default (0.5)
 *   RADIUS.label(0.75)   -> "¾ mile"
 */
(() => {
  "use strict";
  const MIN = 0.25, MAX = 1, STEP = 0.25, DEFAULT = 0.5;
  const QUARTERS = ["", "¼", "½", "¾"];                          // index = number of quarters of a mile

  function snap(value) {
    if (value == null || String(value).trim() === "") return DEFAULT;
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT;
    return Math.round(Math.min(MAX, Math.max(MIN, n)) / STEP) * STEP;      // multiples of 1/4 are exact in binary, so no rounding drift
  }

  function label(value) {
    const quarters = Math.round(snap(value) / STEP);
    return quarters >= 4 ? "1 mile" : QUARTERS[quarters] + " mile";
  }

  const api = { MIN, MAX, STEP, DEFAULT, snap, label };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RADIUS = api;
})();
