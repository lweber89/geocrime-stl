const test = require("node:test");
const assert = require("node:assert/strict");
const RADIUS = require("../../dashboard/radius.js");

test("every eighth of a mile from 1/8 to 1 keeps its value and has a label", () => {
  const labels = ["⅛ mile", "¼ mile", "⅜ mile", "½ mile", "⅝ mile", "¾ mile", "⅞ mile", "1 mile"];
  labels.forEach((text, i) => {
    const miles = (i + 1) / 8;
    assert.equal(RADIUS.snap(miles), miles);
    assert.equal(RADIUS.snap(String(miles)), miles);           // the page reads the value as text
    assert.equal(RADIUS.label(miles), text);
  });
});

test("old links with 1/4, 1/2 and 1 mile still mean the same thing", () => {
  assert.equal(RADIUS.snap("0.25"), 0.25);
  assert.equal(RADIUS.snap("0.5"), 0.5);
  assert.equal(RADIUS.snap("1"), 1);
});

test("values between steps go to the nearest step, and out-of-range values are held to 1/8 .. 1", () => {
  assert.equal(RADIUS.snap("0.3"), 0.25);
  assert.equal(RADIUS.snap("0.45"), 0.5);
  assert.equal(RADIUS.snap("0.01"), 0.125);
  assert.equal(RADIUS.snap("0"), 0.125);
  assert.equal(RADIUS.snap("-2"), 0.125);
  assert.equal(RADIUS.snap("5"), 1);
});

test("empty or junk text falls back to the default half mile", () => {
  for (const v of ["", "   ", null, undefined, "abc", "NaN", "Infinity"]) assert.equal(RADIUS.snap(v), 0.5, String(v));
  assert.equal(RADIUS.label("junk"), "½ mile");
});
