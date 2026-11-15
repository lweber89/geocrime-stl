const test = require("node:test");
const assert = require("node:assert/strict");
const WHAT = require("../../dashboard/what.js");

const none = { cats: [], vc: false, fa: false };
const rec = (o) => ({ type: "Person", cat: "Robbery", violent: true, firearm: false, ...o });
const violent = new Map([["Robbery", "all"], ["Aggravated Assault", "all"], ["Sex Offenses", "part"]]);

test("matches: every part must pass, and an empty choice passes everything", () => {
  assert.ok(WHAT.matches(rec(), none));
  assert.ok(!WHAT.matches(rec({ violent: false }), { ...none, vc: true }));
  assert.ok(WHAT.matches(rec(), { ...none, vc: true }));
  assert.ok(!WHAT.matches(rec(), { ...none, cats: ["Larceny"] }));
  assert.ok(WHAT.matches(rec(), { ...none, cats: ["Larceny", "Robbery"] }), "any ticked category passes");
  assert.ok(!WHAT.matches(rec(), { ...none, fa: true }));
  assert.ok(WHAT.matches(rec({ firearm: true }), { ...none, fa: true, cats: ["Robbery"] }));
  assert.ok(WHAT.matches(rec(), {}), "a choice with no fields at all is everything");
});

test("violent crime stays a check of its own: Sex Offenses ticked under it counts only the violent part", () => {
  const s = { ...none, vc: true, cats: ["Sex Offenses"] };
  assert.ok(WHAT.matches(rec({ cat: "Sex Offenses", violent: true }), s), "rape");
  assert.ok(!WHAT.matches(rec({ cat: "Sex Offenses", violent: false }), s), "fondling");
});

test("label says what is chosen in a few words", () => {
  assert.equal(WHAT.label(none), "All offenses");
  assert.equal(WHAT.label(none, { gb: true }), "All offenses + arrest-only");
  assert.equal(WHAT.label({ ...none, cats: ["Robbery"] }), "Robbery");
  assert.equal(WHAT.label({ ...none, cats: ["Robbery", "Larceny"] }), "2 categories");
  assert.equal(WHAT.label({ ...none, fa: true, cats: ["Robbery"] }), "Robbery · Firearm");
  assert.equal(WHAT.label({ ...none, vc: true, fa: true }), "Violent crime · Firearm");
  const all = { ...none, vc: true, cats: [...violent.keys()] };
  assert.equal(WHAT.label(all, { violent }), "Violent crime", "every category it covers ticked: just violent crime");
  assert.equal(WHAT.label({ ...all, cats: ["Robbery"] }, { violent }), "Violent crime · Robbery");
  assert.equal(WHAT.label({ ...all, cats: ["Robbery", "Sex Offenses"] }, { violent }), "Violent crime · 2 categories");
});

test("violent crime ticks the categories it covers; turning it off keeps them ticked", () => {
  const s = WHAT.setViolent({ cats: ["Larceny"], vc: false, fa: true }, true, violent);
  assert.deepEqual(s, { cats: ["Robbery", "Aggravated Assault", "Sex Offenses"], vc: true, fa: true });
  assert.deepEqual(WHAT.setViolent(s, false, violent), { ...s, vc: false });
});

test("ticking a category, and a whole group, one way and the other", () => {
  let s = WHAT.toggleCat(none, "Robbery");
  assert.deepEqual(s.cats, ["Robbery"]);
  s = WHAT.toggleCat(s, "Larceny");
  assert.deepEqual(s.cats, ["Robbery", "Larceny"], "several at once");
  assert.deepEqual(WHAT.toggleCat(s, "Robbery").cats, ["Larceny"]);
  assert.deepEqual(none.cats, [], "the old choice is never changed");

  const group = ["Larceny", "Arson", "Burglary"];
  s = WHAT.toggleGroup({ ...none, cats: ["Robbery", "Larceny"] }, group, true);
  assert.deepEqual(s.cats.sort(), ["Arson", "Burglary", "Larceny", "Robbery"], "ticks the rest, keeps the other group");
  s = WHAT.toggleGroup(s, group, false);
  assert.deepEqual(s.cats, ["Robbery"]);
});

test("a group reads as none, some or all ticked", () => {
  const g = ["Larceny", "Arson"];
  assert.equal(WHAT.groupState(none, g), "none");
  assert.equal(WHAT.groupState({ ...none, cats: ["Arson"] }, g), "some");
  assert.equal(WHAT.groupState({ ...none, cats: ["Arson", "Larceny", "Robbery"] }, g), "all");
});

test("while violent crime is on, only the categories it covers can be ticked, and groups tick only those", () => {
  const on = { ...none, vc: true, cats: ["Robbery"] };
  assert.equal(WHAT.toggleCat(on, "Larceny", violent), on, "outside the violent set: nothing happens");
  assert.deepEqual(WHAT.toggleCat(on, "Robbery", violent).cats, [], "a covered one can still be unticked");
  const persons = ["Aggravated Assault", "Simple Assault", "Sex Offenses"];
  assert.deepEqual(WHAT.toggleGroup({ ...on, cats: [] }, persons, true, violent).cats, ["Aggravated Assault", "Sex Offenses"]);
  assert.equal(WHAT.groupState({ ...on, cats: ["Aggravated Assault", "Sex Offenses"] }, persons, violent), "all", "the greyed one does not count against 'all'");
  assert.equal(WHAT.groupState({ ...on, cats: [] }, ["Larceny"], violent), "none");
});

test("clear resets everything", () => {
  assert.deepEqual(WHAT.clear(), none);
});

test("violentCats says which categories the shortcut covers, and which only in part", () => {
  const r = (cat, violent) => ({ cat, violent });
  const m = WHAT.violentCats([r("Robbery", true), r("Robbery", true), r("Sex Offenses", true), r("Sex Offenses", false), r("Larceny", false)]);
  assert.equal(m.get("Robbery"), "all");
  assert.equal(m.get("Sex Offenses"), "part");
  assert.equal(m.has("Larceny"), false);
});

const D = { types: ["Person", "Property", "Society"], includeGroupB: false, groupBCats: ["Trespass"],
  cats: { Person: ["Robbery", "Simple Assault"], Property: ["Larceny"], Society: ["Drug Violations", "Weapons Law Violations"] } };

test("fromLink keeps known categories and the switches, and drops unknown ones", () => {
  assert.deepEqual(WHAT.fromLink({ cats: ["Robbery", "Nonsense"], vc: true, fa: true }, D), { cats: ["Robbery"], vc: true, fa: true });
  assert.deepEqual(WHAT.fromLink({ cats: ["Nonsense"] }, D), none, "all unknown: everything, like an old link to a category that is gone");
  assert.deepEqual(WHAT.fromLink({}, D), none);
});

test("fromLink turns the older switched-off types (hide) into categories", () => {
  assert.deepEqual(WHAT.fromLink({ hide: ["Society"] }, D).cats, ["Robbery", "Simple Assault", "Larceny"]);
  assert.deepEqual(WHAT.fromLink({ hide: ["Person", "Society"] }, D).cats, ["Larceny"]);
  assert.deepEqual(WHAT.fromLink({ hide: ["Banana"] }, D), none, "an unknown type does nothing");
  assert.deepEqual(WHAT.fromLink({ hide: ["Society"], cats: ["Larceny"] }, D).cats, ["Larceny"], "ticked categories win over hide");
});

test("fromLink with arrest-only on: those categories were never hidden by the type boxes", () => {
  const withB = { ...D, includeGroupB: true, cats: { ...D.cats, Society: [...D.cats.Society, "Trespass"] } };
  assert.deepEqual(WHAT.fromLink({ hide: ["Society"] }, withB).cats, ["Robbery", "Simple Assault", "Larceny", "Trespass"]);
  assert.deepEqual(WHAT.fromLink({ hide: ["Society"] }, D).cats, ["Robbery", "Simple Assault", "Larceny"], "off: nothing to add");
});

test("groups lists Persons, Property and Society by size, then the arrest-only categories", () => {
  const r = (cat, group) => ({ cat, group });
  const D2 = { groupBCats: ["Trespass", "DUI"], records: [r("Larceny", "Property"), r("Larceny", "Property"), r("Arson", "Property"), r("Simple Assault", "Persons"),
    r("Drugs", "Society"), r("Mystery", null), r("Trespass", "Group B")] };
  const g = WHAT.groups(D2);
  assert.deepEqual(g.map((x) => x.key), ["Persons", "Property", "Society", "Other", "Group B"]);
  assert.deepEqual(g[1].cats, ["Larceny", "Arson"], "most common first");
  assert.deepEqual(g[3].cats, ["Mystery"], "a category with no group yet is not lost");
  assert.deepEqual(g[4].cats, ["Trespass", "DUI"], "arrest-only: loaded ones first, then the rest by name");
  assert.equal(g[0].cats.includes("Trespass"), false, "an arrest-only category is only in its own group");
  assert.deepEqual(WHAT.groups({ groupBCats: [], records: [] }).map((x) => x.key), ["Group B"]);
});
