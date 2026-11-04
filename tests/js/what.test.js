const test = require("node:test");
const assert = require("node:assert/strict");
const WHAT = require("../../dashboard/what.js");

const typeOf = (c) => ({ Robbery: "Person", Larceny: "Property", "Weapons Law Violations": "Society" }[c]);
const TYPES = ["Person", "Property", "Society"];
const none = { cat: "", vc: false, hide: [], fa: false };
const rec = (o) => ({ type: "Person", cat: "Robbery", violent: true, firearm: false, ...o });

test("matches: every part must pass, and an empty choice passes everything", () => {
  assert.ok(WHAT.matches(rec(), none));
  assert.ok(!WHAT.matches(rec({ violent: false }), { ...none, vc: true }));
  assert.ok(WHAT.matches(rec(), { ...none, vc: true }));
  assert.ok(!WHAT.matches(rec(), { ...none, hide: ["Person"] }));
  assert.ok(!WHAT.matches(rec(), { ...none, cat: "Larceny" }));
  assert.ok(!WHAT.matches(rec(), { ...none, fa: true }));
  assert.ok(WHAT.matches(rec({ firearm: true }), { ...none, fa: true, cat: "Robbery" }));
});

test("label says what is chosen in a few words", () => {
  assert.equal(WHAT.label(none, TYPES), "All offenses");
  assert.equal(WHAT.label({ ...none, vc: true, fa: true }, TYPES), "Violent crime · Firearm");
  assert.equal(WHAT.label({ ...none, cat: "Robbery" }, TYPES), "Robbery");
  assert.equal(WHAT.label({ ...none, hide: ["Society"] }, TYPES), "Person + Property");
  assert.equal(WHAT.label({ ...none, hide: TYPES }, TYPES), "Nothing selected");
  assert.equal(WHAT.label({ ...none, vc: true, cat: "Sex Offenses" }, TYPES), "Violent crime · Sex Offenses");
  assert.equal(WHAT.label({ ...none, vc: true, hide: ["Person"] }, TYPES), "Violent crime · without Person");
});

test("violent crime starts a fresh choice, and turning it off keeps the rest", () => {
  const s = WHAT.setViolent({ ...none, cat: "Larceny", hide: ["Person"], fa: true }, true);
  assert.deepEqual(s, { cat: "", vc: true, hide: [], fa: true });
  assert.equal(WHAT.setViolent({ ...s, cat: "Robbery" }, false).cat, "Robbery");
});

const violent = new Map([["Robbery", "all"], ["Sex Offenses", "part"]]);

test("with violent crime on, a category narrows it; one it does not cover is ignored", () => {
  const on = { ...none, vc: true };
  const a = WHAT.setCat(on, "Sex Offenses", typeOf, violent);
  assert.deepEqual(a, { ...on, cat: "Sex Offenses" });
  assert.equal(WHAT.setCat(a, "Sex Offenses", typeOf, violent).cat, "", "again: back to all of violent crime");
  assert.equal(WHAT.setCat(on, "Larceny", typeOf, violent), on);
});

test("without violent crime, choosing a category and switching types works as before", () => {
  const a = WHAT.setCat({ ...none, hide: ["Property"] }, "Larceny", typeOf);
  assert.deepEqual(a, { cat: "Larceny", vc: false, hide: [], fa: false });
  assert.equal(WHAT.setCat(a, "Larceny", typeOf).cat, "");
});

test("switching a type off drops a category of that type but keeps violent crime on; the last type stays on", () => {
  let s = WHAT.toggleType({ ...none, cat: "Robbery" }, "Person", TYPES, typeOf);
  assert.deepEqual(s, { ...none, hide: ["Person"] });
  s = WHAT.toggleType({ ...none, vc: true, cat: "Robbery" }, "Person", ["Person", "Property"], typeOf);
  assert.deepEqual(s, { ...none, vc: true, hide: ["Person"] });
  s = WHAT.toggleType({ ...none, cat: "Larceny", hide: ["Person"] }, "Person", TYPES, typeOf);
  assert.deepEqual(s.hide, [], "switching a type back on");
  const two = { ...none, hide: ["Person", "Property"] };
  assert.equal(WHAT.toggleType(two, "Society", TYPES, typeOf), two, "cannot switch off the last one");
  const one = { ...none, vc: true };
  assert.equal(WHAT.toggleType(one, "Person", ["Person"], typeOf), one, "nor the last type violent crime covers");
});

test("clear resets everything", () => {
  assert.deepEqual(WHAT.clear({ cat: "x", vc: true, hide: ["Person"], fa: true }), none);
});

test("violentCats says which categories the shortcut covers, and which only in part", () => {
  const r = (cat, violent) => ({ cat, violent });
  const m = WHAT.violentCats([r("Robbery", true), r("Robbery", true), r("Sex Offenses", true), r("Sex Offenses", false), r("Larceny", false)]);
  assert.equal(m.get("Robbery"), "all");
  assert.equal(m.get("Sex Offenses"), "part");
  assert.equal(m.has("Larceny"), false);
});

test("the type tick boxes leave arrest-only (Group B) offenses alone", () => {
  const b = rec({ type: "Society", cat: "Trespass", violent: false, group: "Group B" });
  assert.ok(WHAT.matches(b, { ...none, hide: ["Society"] }), "Group B is not hidden by unticking Society");
  assert.ok(!WHAT.matches(rec({ type: "Society", group: "Group A" }), { ...none, hide: ["Society"] }));
});
