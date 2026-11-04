const test = require("node:test");
const assert = require("node:assert/strict");
const FILTERS = require("../../dashboard/filters.js");

const none = { cat: "", fa: false, gb: false };

test("parse reads where, what and the older period names from a map link", () => {
  const s = FILTERS.parse("#range=last6&ward=5&nbhd=Dutchtown&cat=Robbery&fa=1&hide=Society,Other&gb=1&q=main+st&pt=38.6,-90.2&lbl=1+Main&radius=0.75");
  assert.equal(s.ward, "5"); assert.equal(s.nbhd, "Dutchtown"); assert.equal(s.cat, "Robbery"); assert.equal(s.q, "main st");
  assert.equal(s.pt, "38.6,-90.2"); assert.equal(s.lbl, "1 Main"); assert.equal(s.radius, "0.75");
  assert.equal(s.fa, true); assert.equal(s.gb, true); assert.deepEqual(s.hide, ["Society", "Other"]);
  assert.equal(s.when, "l6");
});

test("parse understands every older way of writing the period, and the new one", () => {
  const w = (h) => FILTERS.parse(h).when;
  assert.equal(w("#range=last3"), "l3");
  assert.equal(w("#range=last12"), "l12");
  assert.equal(w("#range=ytd"), "ytd");
  assert.equal(w("#range=all"), "all");
  assert.equal(w("#range=m:2026-09"), "2026-09");
  assert.equal(w("#month=2026-03"), "2026-03");
  assert.equal(w("#range=last6&month=2026-03"), "2026-03", "a picked month wins over the preset");
  assert.equal(w("#per=p3"), "l3");
  assert.equal(w("#per=p24"), "l24");
  assert.equal(w("#per=all"), "all");
  assert.equal(w("#when=l3"), "l3");
  assert.equal(w("#when=2026-03..2026-09"), "2026-03..2026-09");
  assert.equal(w("#when=latest&per=p3"), "latest", "an explicit when wins over the older names");
  assert.equal(w(""), "");
});

test("parse drops junk periods instead of passing them on", () => {
  for (const h of ["#when=banana", "#when=2026-13", "#when=2026-09..2026-03", "#range=last99", "#month=2026-1", "#per=p5"]) {
    assert.equal(FILTERS.parse(h).when, "", h);
  }
});

test("parse keeps what a page owns (tab, mode, sort) apart from the shared filters", () => {
  const s = FILTERS.parse("#cat=Arson&tab=ward&mode=change&sort=rate");
  assert.equal(s.other.get("tab"), "ward"); assert.equal(s.other.get("mode"), "change"); assert.equal(s.other.get("sort"), "rate");
  assert.equal(s.other.has("cat"), false);
});

test("hash writes only what the page understands, and nothing empty", () => {
  const s = FILTERS.parse("#ward=5&cat=Robbery&fa=1&gb=1&q=main&hide=Other");
  assert.equal(FILTERS.hash("hotspots", s), "ward=5&cat=Robbery&fa=1&hide=Other&gb=1");
  assert.equal(FILTERS.hash("charts", s), "ward=5&cat=Robbery&fa=1&hide=Other&gb=1");
  assert.equal(FILTERS.hash("map", s), "ward=5&q=main&cat=Robbery&fa=1&hide=Other&gb=1");
  assert.equal(FILTERS.hash("map", { ...none }), "");
});

test("every page writes the period as `when`, and leaves out one it does not understand", () => {
  for (const page of ["map", "charts", "hotspots"]) {
    assert.equal(FILTERS.hash(page, { ...none, when: "l6" }), "when=l6", page);
    assert.equal(FILTERS.hash(page, { ...none, when: "2026-03..2026-09" }), "when=2026-03..2026-09", page);
    assert.equal(FILTERS.hash(page, { ...none, when: "banana" }), "", page);
  }
});

test("link joins the page file and the fragment, with no # when there is nothing to carry", () => {
  assert.equal(FILTERS.link("map", none), "./");
  assert.equal(FILTERS.link("map", { ...none, cat: "Robbery", fa: true }), "./#cat=Robbery&fa=1");
  assert.equal(FILTERS.link("charts", none), "charts.html");
  assert.equal(FILTERS.link("charts", { ...none, cat: "Robbery", when: "l3" }), "charts.html#cat=Robbery&when=l3");
  assert.equal(FILTERS.link("hotspots", { ...none, gb: true }), "hotspots.html#gb=1");
});

test("extra values are added to a link and empty ones are skipped (the Hotspots 'See on the map' links)", () => {
  const h = FILTERS.hash("map", { ...none, cat: "Arson" }, { pt: "38.6,-90.2", lbl: "Hex 4", radius: "0.25", q: "", ward: null });
  assert.equal(h, "cat=Arson&pt=38.6%2C-90.2&lbl=Hex+4&radius=0.25");
  assert.deepEqual([...new URLSearchParams(h)].map(([k]) => k), ["cat", "pt", "lbl", "radius"]);
});

test("a link read and written again keeps its filters, and moves the period to `when`", () => {
  const s = FILTERS.parse("ward=5&q=main&cat=Robbery&fa=1&hide=Other&gb=1&range=last6");
  const out = [...new URLSearchParams(FILTERS.hash("map", s))].map(([k, v]) => k + "=" + v).sort();
  assert.deepEqual(out, ["cat=Robbery", "fa=1", "gb=1", "hide=Other", "q=main", "ward=5", "when=l6"]);
});

test("the map's and Charts' links to Hotspots carry the place, category, firearm, Group B and the period", () => {
  const fromMap = (h) => FILTERS.link("hotspots", FILTERS.parse(h));
  assert.equal(fromMap("cat=Robbery&fa=1&ward=5&hide=Other&range=last6"), "hotspots.html#ward=5&cat=Robbery&fa=1&hide=Other&when=l6");
  assert.equal(fromMap("cat=Arson&gb=1"), "hotspots.html#cat=Arson&gb=1", "no period in the link, no period written");
  assert.equal(fromMap("ward=5&range=ytd"), "hotspots.html#ward=5&when=ytd");
  assert.equal(fromMap("range=all"), "hotspots.html#when=all");
  assert.equal(FILTERS.link("hotspots", { cat: "Robbery", fa: true, gb: false, when: "l3" }), "hotspots.html#cat=Robbery&fa=1&when=l3");
});

test("the violent crime shortcut (vc) is read and written like the other switches, on every page", () => {
  const s = FILTERS.parse("#vc=1&ward=5&hide=Society");
  assert.equal(s.vc, true);
  for (const page of ["map", "charts", "hotspots"]) assert.match(FILTERS.hash(page, s), /(^|&)vc=1(&|$)/);
  assert.equal(FILTERS.parse("#cat=Robbery").vc, false);
  assert.doesNotMatch(FILTERS.hash("map", FILTERS.parse("#cat=Robbery")), /vc=/);
  assert.equal(FILTERS.parse("#vc=1&tab=ward").other.has("vc"), false);
});
