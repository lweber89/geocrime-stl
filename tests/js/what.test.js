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
});

test("violent crime replaces the category and brings every type back; turning it off keeps the rest", () => {
  const s = WHAT.setViolent({ ...none, cat: "Larceny", hide: ["Person"], fa: true }, true);
  assert.deepEqual(s, { cat: "", vc: true, hide: [], fa: true });
  assert.equal(WHAT.setViolent(s, false).vc, false);
});

test("choosing a category clears violent crime and switches its type back on; choosing it again clears it", () => {
  const a = WHAT.setCat({ ...none, vc: true, hide: ["Property"] }, "Larceny", typeOf);
  assert.deepEqual(a, { cat: "Larceny", vc: false, hide: [], fa: false });
  assert.equal(WHAT.setCat(a, "Larceny", typeOf).cat, "");
});

test("switching a type off drops a category of that type and violent crime; the last type stays on", () => {
  let s = WHAT.toggleType({ ...none, cat: "Robbery" }, "Person", TYPES, typeOf);
  assert.deepEqual(s, { ...none, hide: ["Person"] });
  s = WHAT.toggleType({ ...none, vc: true }, "Society", TYPES, typeOf);
  assert.deepEqual(s, { ...none, hide: ["Society"] });
  s = WHAT.toggleType({ ...none, cat: "Larceny", hide: ["Person"] }, "Person", TYPES, typeOf);
  assert.deepEqual(s.hide, [], "switching a type back on");
  const two = { ...none, hide: ["Person", "Property"] };
  assert.equal(WHAT.toggleType(two, "Society", TYPES, typeOf), two, "cannot switch off the last one");
});

test("clear resets everything", () => {
  assert.deepEqual(WHAT.clear({ cat: "x", vc: true, hide: ["Person"], fa: true }), none);
});
