const test = require("node:test");
const assert = require("node:assert/strict");
const WHERE = require("../../dashboard/where.js");

test("label names the chosen area in the same words on every page", () => {
  assert.equal(WHERE.label({}), "Whole city");
  assert.equal(WHERE.label(null), "Whole city");
  assert.equal(WHERE.label({ ward: "5" }), "Ward 5");
  assert.equal(WHERE.label({ nbhd: "Dutchtown" }), "Dutchtown");
  assert.equal(WHERE.label({ pt: "38.6,-90.2", lbl: "1 Main St" }, "½ mile"), "1 Main St · ½ mile");
  assert.equal(WHERE.label({ pt: "38.6,-90.2" }, "1 mile"), "Chosen spot · 1 mile");
  assert.equal(WHERE.label({ pt: "38.6,-90.2", lbl: "Pin" }), "Pin");
});

test("an address or pin wins the label over a ward left in an old link", () => {
  assert.equal(WHERE.label({ ward: "5", pt: "1,2", lbl: "X" }, "¼ mile"), "X · ¼ mile");
});

test("choosing a ward clears the neighborhood, and the other way round", () => {
  assert.deepEqual(WHERE.choose({ ward: "", nbhd: "Dutchtown" }, "ward", "5"), { ward: "5", nbhd: "" });
  assert.deepEqual(WHERE.choose({ ward: "5", nbhd: "" }, "nbhd", "Soulard"), { ward: "", nbhd: "Soulard" });
});

test("choosing the area that is already chosen clears it", () => {
  assert.deepEqual(WHERE.choose({ ward: "5", nbhd: "" }, "ward", "5"), { ward: "", nbhd: "" });
  assert.deepEqual(WHERE.choose({ ward: "", nbhd: "Soulard" }, "nbhd", "Soulard"), { ward: "", nbhd: "" });
});

test("while an address or pin is chosen, ward and neighborhood cannot be changed", () => {
  const a = { ward: "", nbhd: "", pt: "38.6,-90.2", lbl: "X" };
  assert.equal(WHERE.locked(a), true);
  assert.equal(WHERE.locked({ ward: "5" }), false);
  assert.deepEqual(WHERE.choose(a, "ward", "5"), { ward: "", nbhd: "" });
});

test("matches checks the ward and the neighborhood, and everything matches with no area", () => {
  const r = { ward: "5", nbhd: "Soulard" };
  assert.equal(WHERE.matches(r, {}), true);
  assert.equal(WHERE.matches(r, { ward: "5" }), true);
  assert.equal(WHERE.matches(r, { ward: "6" }), false);
  assert.equal(WHERE.matches(r, { nbhd: "Soulard" }), true);
  assert.equal(WHERE.matches(r, { nbhd: "Dutchtown" }), false);
});

test("filterNames finds neighborhoods by what is typed, ignoring case and the missing apostrophes", () => {
  const names = ["Dutchtown", "OFallon", "Soulard", "Downtown", "Downtown West"];
  assert.deepEqual(WHERE.filterNames(names, "town"), ["Dutchtown", "Downtown", "Downtown West"]);
  assert.deepEqual(WHERE.filterNames(names, "O'Fallon"), ["OFallon"]);
  assert.deepEqual(WHERE.filterNames(names, "  SOUL "), ["Soulard"]);
  assert.deepEqual(WHERE.filterNames(names, ""), names);
  assert.deepEqual(WHERE.filterNames(names, "zzz"), []);
});
