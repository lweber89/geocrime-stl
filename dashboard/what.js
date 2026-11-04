/* what.js: the rules for the "What" filter, with no page code, so every page and the tests share them.
 *
 * A What choice is { cat, vc, hide, fa }:
 *   cat   one offense category ("Robbery"), or "" for all
 *   vc    true = the FBI's violent crime definition (murder, rape, robbery, aggravated assault; see the Methodology page)
 *   hide  offense types switched off: "Person", "Property", "Society", "Other"
 *   fa    only offenses involving a firearm
 * Violent crime is a preset: it starts a fresh choice, then stays on while a category or a type narrows it (Sex Offenses
 * within violent crime leaves out fondling; unticking Person leaves Person out of it). One category and a list of
 * switched-off types otherwise stand alone. Firearm combines with any of them.
 *
 *   WHAT.matches(record, s)    does this offense pass?
 *   WHAT.label(s, types)       "All offenses", "Violent crime · Firearm", "Robbery", "Person + Property"
 */
(() => {
  "use strict";

  // The type tick boxes (hide) are for the Group A types; arrest-only (Group B) offenses have their own tab and switch.
  const matches = (a, s) =>
    (!s.vc || a.violent) && (a.group === "Group B" || !(s.hide || []).includes(a.type)) && (!s.cat || a.cat === s.cat) && (!s.fa || a.firearm);

  function label(s, types = []) {
    const hide = s.hide || [], shown = types.filter((t) => !hide.includes(t));
    let base = "All offenses";
    if (s.vc) base = "Violent crime" + (s.cat ? ` · ${s.cat}` : "") + (hide.length ? ` · without ${hide.join(" + ")}` : "");
    else if (s.cat) base = s.cat;
    else if (hide.length && shown.length) base = shown.join(" + ");
    else if (hide.length) base = "Nothing selected";
    return s.fa ? `${base} · Firearm` : base;
  }

  // The violent crime shortcut starts a fresh choice. After that it stays on: a category or a type then narrows it
  // (see setCat and toggleType) until the person turns it off or chooses All offenses.
  const setViolent = (s, on) => (on ? { ...s, vc: true, cat: "", hide: [] } : { ...s, vc: false });

  // Choose one category (or, choosing it again, go back to all). Its type is switched on if it was off.
  // While violent crime is on, only the categories it covers can be chosen (`violent`, from violentCats); the choice narrows it.
  function setCat(s, cat, typeOfCat, violent) {
    if (s.vc && violent && cat && !violent.has(cat)) return s;
    const next = s.cat === cat ? "" : cat, type = next ? typeOfCat(next) : null;
    return { ...s, cat: next, hide: (s.hide || []).filter((t) => t !== type) };
  }

  // Switch one offense type on or off. Switching off the type of the chosen category drops the category.
  // The last type that is on cannot be switched off (the result would always be empty); pass only the types
  // in play as `allTypes` (while violent crime is on, the types it covers).
  function toggleType(s, type, allTypes, typeOfCat) {
    const hide = s.hide || [], off = hide.includes(type);
    if (!off && allTypes.filter((t) => !hide.includes(t)).length <= 1) return s;
    const next = off ? hide.filter((t) => t !== type) : [...hide, type];
    const dropCat = !off && s.cat && typeOfCat(s.cat) === type;
    return { ...s, hide: next, cat: dropCat ? "" : s.cat };
  }

  // Which categories the violent crime shortcut covers, from the offenses themselves: Map category -> "all" or "part"
  // (a category can hold both: sex offenses include rape, which counts, and fondling, which does not).
  function violentCats(records) {
    const n = new Map();
    for (const a of records) { const c = n.get(a.cat) || { v: 0, all: 0 }; c.all++; if (a.violent) c.v++; n.set(a.cat, c); }
    const out = new Map();
    for (const [cat, c] of n) if (c.v) out.set(cat, c.v === c.all ? "all" : "part");
    return out;
  }

  const clear = (s) => ({ ...s, cat: "", vc: false, hide: [], fa: false });

  const api = { matches, label, setViolent, setCat, toggleType, violentCats, clear };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.WHAT = api;
})();
