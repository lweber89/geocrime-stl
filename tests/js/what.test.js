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

const ctx = { allA: ["Robbery", "Larceny", "Arson"], allB: ["Trespass", "DUI"], violent: new Map([["Robbery", "all"]]) };

test("expand shows All offenses as every Group A category ticked (and the arrest-only ones when they are on)", () => {
  assert.deepEqual(WHAT.expand(none, ctx), ["Robbery", "Larceny", "Arson"]);
  assert.deepEqual(WHAT.expand({ ...none, gb: true }, ctx), ["Robbery", "Larceny", "Arson", "Trespass", "DUI"]);
  assert.deepEqual(WHAT.expand({ ...none, vc: true }, ctx), ["Robbery"], "violent crime with nothing narrowed: what it covers");
  assert.deepEqual(WHAT.expand({ ...none, cats: ["Arson"] }, ctx), ["Arson"]);
});

test("normalize stores everything ticked as no categories, and anything less as the list", () => {
  assert.deepEqual(WHAT.normalize({ ...none, cats: ["Robbery", "Larceny", "Arson"] }, ctx), { cats: [], vc: false, fa: false, gb: false });
  assert.deepEqual(WHAT.normalize({ ...none, cats: ["Robbery", "Larceny"] }, ctx).cats, ["Robbery", "Larceny"]);
  const withB = WHAT.normalize({ ...none, cats: ["Robbery", "Larceny", "Arson", "Trespass", "DUI"] }, ctx);
  assert.deepEqual(withB, { cats: [], vc: false, fa: false, gb: true }, "everything including arrest-only: no list, arrest-only on");
  const some = WHAT.normalize({ ...none, cats: ["Robbery", "Larceny", "Arson", "Trespass"] }, ctx);
  assert.deepEqual(some.cats, ["Robbery", "Larceny", "Arson", "Trespass"], "only some arrest-only ones: keep the list");
  assert.equal(some.gb, true);
  assert.equal(WHAT.normalize({ ...none, cats: ["Trespass"] }, ctx).gb, true, "a ticked arrest-only category switches them on");
  assert.equal(WHAT.normalize({ ...none, cats: ["Robbery"], fa: true }, ctx).fa, true);
});

test("normalize: every violent category ticked is plain violent crime, with arrest-only off", () => {
  assert.deepEqual(WHAT.normalize({ ...none, vc: true, cats: ["Robbery"] }, ctx), { cats: [], vc: true, fa: false, gb: false });
  const two = { ...ctx, violent: new Map([["Robbery", "all"], ["Arson", "all"]]) };
  assert.deepEqual(WHAT.normalize({ ...none, vc: true, cats: ["Robbery"] }, two).cats, ["Robbery"], "narrowed: keep the list");
});

test("what is stored and shown again gives the same ticks", () => {
  for (const ticks of [["Robbery", "Larceny", "Arson"], ["Larceny"], ["Robbery", "Larceny", "Arson", "Trespass", "DUI"], ["Arson", "DUI"]]) {
    const n = WHAT.normalize({ ...none, cats: ticks }, ctx);
    assert.deepEqual(WHAT.expand({ cats: n.cats, vc: n.vc, fa: n.fa, gb: n.gb }, ctx).sort(), [...ticks].sort(), ticks.join());
  }
});

test("label names whole groups when exactly those are ticked", () => {
  const groups = [{ key: "Persons", name: "Persons", cats: ["Assault", "Rape"] }, { key: "Property", name: "Property", cats: ["Larceny", "Arson"] },
    { key: "Group B", name: "Arrest-only (Group B)", cats: ["Trespass"] }];
  const L = (cats) => WHAT.label({ ...none, cats }, { groups });
  assert.equal(L(["Assault", "Rape"]), "Persons");
  assert.equal(L(["Assault", "Rape", "Larceny", "Arson"]), "Persons + Property");
  assert.equal(L(["Assault", "Rape", "Trespass"]), "Persons + Arrest-only");
  assert.equal(L(["Assault", "Larceny"]), "2 categories", "part of a group: a count");
  assert.equal(L(["Assault", "Rape", "Larceny"]), "3 categories", "a whole group plus a bit of another: a count");
  assert.equal(L(["Assault"]), "Assault");
});
