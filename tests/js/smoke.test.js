// Smoke test for the map page: runs the REAL dashboard scripts (radius.js, geocode.js, data.js, app.js) against stand-ins
// for the page and for Leaflet, with a tiny fake data feed, and walks through the main things a person does: load the
// page, search an address, move the distance slider, drag the pin, drop a pin, clear.
//
//   node --test tests/js/smoke.test.js
//
// It is NOT a real browser, so it cannot catch layout or look problems, or real Leaflet behavior. What it does catch is a
// script that throws or stops doing its job (for example after a variable is renamed or removed), which a syntax check
// (`node --check`) cannot. When the page's element ids or the way app.js builds the map change, update the stand-ins here.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");

const DIR = path.join(__dirname, "..", "..", "dashboard");

// ---------- stand-in page ----------
const els = {};
function makeEl(id) {
  const h = {};
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, checked: false, title: "", href: "", className: "",
    scrollTop: 0, options: [], children: [], dataset: {}, style: {}, _h: h,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this["attr_" + k] = v; }, getAttribute(k) { return this["attr_" + k]; },
    addEventListener(t, fn) { (h[t] = h[t] || []).push(fn); },
    dispatchEvent(ev) { (h[ev.type] || []).forEach((fn) => fn(ev)); return true; },
    appendChild() {}, scrollIntoView() {}, focus() {},
    click() { (h.click || []).forEach((fn) => fn({ preventDefault() {}, target: { closest: () => null } })); },
    closest: () => null, querySelector: () => makeEl(id + "-child"), querySelectorAll: () => [],
  };
}
const getEl = (id) => els[id] || (els[id] = makeEl(id));
const document = {
  getElementById: getEl, querySelector: () => makeEl("q"), querySelectorAll: () => [],
  addEventListener() {}, documentElement: { dataset: {} }, createElement: () => makeEl("new"), body: makeEl("body"),
};

// ---------- stand-in Leaflet: every call returns a chainable object; we record the few calls we care about ----------
const fitCalls = []; let mapClick = null, dragEnd = null, ring = null;
const chain = (kind, args) => {
  const o = { kind, args, _on: {} };
  const proxy = new Proxy(o, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "on") return (evt, fn) => { t._on[evt] = fn; if (kind === "map" && evt === "click") mapClick = fn; if (kind === "marker" && evt === "dragend") dragEnd = fn; return proxy; };
      if (p === "fitBounds") return (b) => { fitCalls.push(b); return proxy; };
      if (p === "setRadius") return (r) => { t.radius = r; return proxy; };
      if (p === "getBounds") return () => ({});
      if (p === "getLatLng") return () => ({ lat: 0, lng: 0 });
      if (p === "getZoom") return () => 12;
      if (p === "getSize") return () => ({ x: 800, y: 600 });
      if (p === "getCenter") return () => ({ lat: 38.63, lng: -90.2 });
      if (p === "then" || typeof p === "symbol") return undefined;
      return () => proxy;
    },
  });
  return proxy;
};
const L = new Proxy({}, { get: (_, kind) => (...args) => { const p = chain(kind, args); if (kind === "circle") ring = p; return p; } });

// ---------- stand-in data feed: a few dozen offenses downtown ----------
const rows = [];
for (let i = 0; i < 40; i++) rows.push([`26-${1000 + i}`, `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T${String(8 + (i % 12)).padStart(2, "0")}:00`,
  38.625 + (i % 8) * 0.002, -90.195 + (i % 5) * 0.002, `${100 + i} MARKET ST`, i % 3, i % 3, i % 3, i % 2, 1, i % 2, 0, i % 2 ? 6 : 5, 0]);
const dict = { type: ["Person", "Property", "Society"], cat: ["Aggravated Assault", "Larceny", "Weapons Law Violations"], off: ["A", "B", "C"], nbhd: ["Downtown", "Soulard"], ward: ["5", "6"] };
const feed = {
  "data/manifest.json": { built: "t", through: "2026-09-30", completeThrough: "2026-09-30", months: [{ m: "2026-08" }, { m: "2026-09" }] },
  "data/2026-08.json": { m: "2026-08", d: dict, r: rows.slice(0, 20) },
  "data/2026-09.json": { m: "2026-09", d: dict, r: rows.slice(20) },
};
const fetchStub = async (url) => {
  const key = String(url).split("?")[0];
  return feed[key] ? { ok: true, status: 200, json: async () => feed[key] } : { ok: false, status: 404, json: async () => null };
};

// ---------- run the real scripts ----------
const sandbox = {
  document, L, fetch: fetchStub, console, setTimeout, clearTimeout, URLSearchParams, Event, Date, Math, JSON,
  history: { replaceState() {} }, location: { hash: "", pathname: "/dashboard/" }, navigator: {}, matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ getPropertyValue: () => "#123456" }), URL, Blob, requestAnimationFrame: (f) => f(),
};
getEl("radius").value = "0.5";                                   // the HTML default
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["radius.js", "geocode.js", "data.js", "filters.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), sandbox, { filename: f });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastFit = () => fitCalls[fitCalls.length - 1];
const centerOf = (b) => ({ lat: (b[0][0] + b[1][0]) / 2, lon: (b[0][1] + b[1][1]) / 2 });
const spanLat = (b) => Math.abs(b[1][0] - b[0][0]);
let span05;                                                       // map span at the default distance, used by the slider test

// The tests below run in order and share the page's state, like a person using it.

test("the page loads with the short data note and no point chosen", async () => {
  await sleep(100);
  assert.equal(getEl("sub").textContent, "Data available: Aug 2026 – Sep 2026 · Updated monthly.");
  assert.equal(getEl("radiusBox").hidden, true, "distance control starts hidden");
  assert.equal(getEl("addrMsg").textContent, "", "status line starts empty");
});

test("searching an address drops a pin, re-fits the map, opens the report and shows the distance control", async () => {
  sandbox.GEO.find = async () => ({ status: "ok", lat: 38.631, lon: -90.19, label: "123 TEST ST", source: "OpenStreetMap" });
  getEl("address").value = "123 Test St";
  const before = fitCalls.length;
  await getEl("addrForm")._h.submit[0]({ preventDefault() {} });   // a throw here fails the test
  await sleep(20);
  assert.equal(getEl("addrMsg").textContent, "", "no error text under the search box");
  assert.ok(fitCalls.length > before, "map was re-fit to the ring");
  const c = centerOf(lastFit());
  assert.ok(Math.abs(c.lat - 38.631) < 1e-4 && Math.abs(c.lon + 90.19) < 1e-3, "centered on the address: " + JSON.stringify(c));
  assert.equal(getEl("panel").hidden, false);
  assert.match(getEl("pBody").innerHTML, /Address found by OpenStreetMap\./);
  assert.match(getEl("pBody").innerHTML, /Drag the pin/);
  assert.match(getEl("pBody").innerHTML, /½ mile/, "half mile is the default distance");
  assert.equal(getEl("radiusBox").hidden, false);
  assert.ok(ring && typeof dragEnd === "function", "a ring and a draggable pin were created");
  span05 = spanLat(lastFit());
});

test("the distance slider resizes the ring while dragging and re-fits the map on release", async () => {
  getEl("radius").value = "0.25";
  (getEl("radius")._h.input || []).forEach((fn) => fn({ type: "input" }));
  assert.ok(Math.abs(ring.radius - 0.25 * 1609.344) < 1e-6, "ring radius " + ring.radius);
  assert.equal(getEl("radiusOut").textContent, "¼ mile");
  const nb = fitCalls.length;
  getEl("radius").dispatchEvent({ type: "change" });
  await sleep(10);
  assert.ok(fitCalls.length > nb && spanLat(lastFit()) < span05, "re-fit to a smaller ring");
  assert.match(getEl("pBody").innerHTML, /¼ mile/, "the report follows");
  getEl("radius").value = "0.75"; getEl("radius").dispatchEvent({ type: "change" });
  assert.match(getEl("pBody").innerHTML, /¾ mile/);
  assert.equal(getEl("radiusOut").textContent, "¾ mile");
});

test("dragging the pin re-centers the map and turns the address into a plain pin", async () => {
  const nd = fitCalls.length;
  dragEnd({ target: { getLatLng: () => ({ lat: 38.64, lng: -90.21 }) } });
  await sleep(10);
  assert.ok(fitCalls.length > nd, "map was re-fit");
  const c = centerOf(lastFit());
  assert.ok(Math.abs(c.lat - 38.64) < 1e-3 && Math.abs(c.lon + 90.21) < 1e-3, "centered on the new spot: " + JSON.stringify(c));
  assert.doesNotMatch(getEl("pBody").innerHTML, /Address found by/);
  assert.match(getEl("pBody").innerHTML, /Drag the pin/);
  assert.equal(getEl("addrMsg").textContent, "");
});

test("dragging the pin outside the city shows the message and does not throw", () => {
  dragEnd({ target: { getLatLng: () => ({ lat: 39.5, lng: -89.0 }) } });
  assert.match(getEl("addrMsg").textContent, /outside the City/);
});

test("Drop a pin asks for a click, then drops the pin there and zooms to it", async () => {
  getEl("pinBtn").click();
  assert.match(getEl("addrMsg").textContent, /Click the map/);
  const np = fitCalls.length;
  mapClick({ latlng: { lat: 38.62, lng: -90.2 } });
  await sleep(10);
  const c = centerOf(lastFit());
  assert.ok(fitCalls.length > np && Math.abs(c.lat - 38.62) < 1e-3, "zoomed to the pin: " + JSON.stringify(c));
  assert.equal(getEl("addrMsg").textContent, "", "the instruction is cleared");
});

test("Clear address hides the distance control again", async () => {
  getEl("addrClear").click();
  await sleep(10);
  assert.equal(getEl("radiusBox").hidden, true);
});
