/* what.js: the rules for the "What" filter, with no page code, so every page and the tests share them.
 *
 * A What choice is { cat, vc, hide, fa }:
 *   cat   one offense category ("Robbery"), or "" for all
 *   vc    true = the FBI's violent crime definition (murder, rape, robbery, aggravated assault; see the Methodology page)
 *   hide  offense types switched off: "Person", "Property", "Society", "Other"
 *   fa    only offenses involving a firearm
 * Violent crime, one category and a list of switched-off types are three ways to say "which offenses", so choosing one
 * clears the others that would contradict it. Firearm is separate and combines with any of them.
 *
 *   WHAT.matches(record, s)    does this offense pass?
 *   WHAT.label(s, types)       "All offenses", "Violent crime · Firearm", "Robbery", "Person + Property"
 */
(() => {
  "use strict";

  const matches = (a, s) =>
    (!s.vc || a.violent) && !(s.hide || []).includes(a.type) && (!s.cat || a.cat === s.cat) && (!s.fa || a.firearm);

  function label(s, types = []) {
    const hide = s.hide || [], shown = types.filter((t) => !hide.includes(t));
    let base = "All offenses";
    if (s.vc) base = "Violent crime";
    else if (s.cat) base = s.cat;
    else if (hide.length && shown.length) base = shown.join(" + ");
    else if (hide.length) base = "Nothing selected";
    return s.fa ? `${base} · Firearm` : base;
  }

  // The violent crime shortcut replaces the category and brings every type back.
  const setViolent = (s, on) => (on ? { ...s, vc: true, cat: "", hide: [] } : { ...s, vc: false });

  // Choose one category (or, choosing it again, go back to all). Its type is switched on if it was off.
  function setCat(s, cat, typeOfCat) {
    const next = s.cat === cat ? "" : cat, type = next ? typeOfCat(next) : null;
    return { ...s, vc: false, cat: next, hide: (s.hide || []).filter((t) => t !== type) };
  }

  // Switch one offense type on or off. Switching off the type of the chosen category drops the category.
  // The last type that is on cannot be switched off (the result would always be empty).
  function toggleType(s, type, allTypes, typeOfCat) {
    const hide = s.hide || [], off = hide.includes(type);
    if (!off && allTypes.filter((t) => !hide.includes(t)).length <= 1) return s;
    const next = off ? hide.filter((t) => t !== type) : [...hide, type];
    const dropCat = !off && s.cat && typeOfCat(s.cat) === type;
    return { ...s, vc: false, hide: next, cat: dropCat ? "" : s.cat };
  }

  const clear = (s) => ({ ...s, cat: "", vc: false, hide: [], fa: false });

  const api = { matches, label, setViolent, setCat, toggleType, clear };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.WHAT = api;
})();
