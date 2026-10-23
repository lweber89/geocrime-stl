// Tests for dashboard/geocode.js. Run with:  node --test tests/js/geocode.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ctx = { window: {}, URLSearchParams, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../../dashboard/geocode.js"), "utf8"), ctx);
const { GEO } = ctx;

const downtown = { lat: 38.6296, lon: -90.1938, label: "1200 MARKET ST", source: "x" };
const clayton = { lat: 38.5926, lon: -90.3574, label: "WEBSTER GROVES", source: "x" };   // clearly outside the city (the page itself uses the exact outline)
const boom = async () => { throw new Error("down"); };

test("reads the City geocoder's answer, best score first, and ignores weak matches", () => {
  const r = GEO.parseCity({ spatialReference: { wkid: 4326 }, candidates: [
    { address: "WEAK", score: 60, location: { x: -90.2, y: 38.6 } },
    { address: "1200 MARKET ST", score: 98, location: { x: -90.1938, y: 38.6296 } }] });
  assert.deepStrictEqual([r.lat, r.lon, r.label], [38.6296, -90.1938, "1200 MARKET ST"]);
  assert.strictEqual(GEO.parseCity({ candidates: [{ address: "W", score: 50, location: { x: 1, y: 2 } }] }), null);
  assert.strictEqual(GEO.parseCity({ spatialReference: { wkid: 102696 }, candidates: [{ address: "A", score: 99, location: { x: 1e6, y: 1e6 } }] }), null,
    "refuses a state-plane answer rather than treating it as lat/lon");
});

test("reads OpenStreetMap and Census answers", () => {
  assert.deepStrictEqual(GEO.parseNominatim([{ lat: "38.6296", lon: "-90.1938", display_name: "A" }]).lat, 38.6296);
  assert.strictEqual(GEO.parseNominatim([]), null);
  const c = GEO.parseCensus({ result: { addressMatches: [{ matchedAddress: "B", coordinates: { x: -90.19, y: 38.63 } }] } });
  assert.deepStrictEqual([c.lat, c.lon], [38.63, -90.19]);
  assert.strictEqual(GEO.parseCensus({ result: { addressMatches: [] } }), null);
});

test("first service that answers inside the city wins", async () => {
  const r = await GEO.find("1200 market", { city: async () => downtown, osm: boom, census: boom });
  assert.strictEqual(r.status, "ok");
});

test("falls through when a service is down or has no match", async () => {
  assert.strictEqual((await GEO.find("x", { city: boom, osm: async () => null, census: async () => downtown })).status, "ok");
  assert.strictEqual((await GEO.find("x", { city: boom, osm: boom, census: async () => downtown })).status, "ok");
});

test("an address outside the city is reported as outside, but a later in-city answer still wins", async () => {
  assert.strictEqual((await GEO.find("x", { city: async () => clayton, osm: async () => null, census: async () => null })).status, "outside");
  assert.strictEqual((await GEO.find("x", { city: async () => clayton, osm: async () => downtown, census: boom })).status, "ok");
});

test("uses the page's exact city test when given", async () => {
  const r = await GEO.find("x", { city: async () => downtown, osm: boom, census: boom, contains: () => false });
  assert.strictEqual(r.status, "outside");
});

test("no match vs. every service failing", async () => {
  assert.strictEqual((await GEO.find("zzz", { city: async () => null, osm: async () => null, census: async () => null })).status, "notfound");
  assert.strictEqual((await GEO.find("zzz", { city: boom, osm: boom, census: boom })).status, "error");
  assert.strictEqual((await GEO.find("   ")).status, "notfound");
});

test("adds the city and state to the text sent to the national services only when missing", () => {
  assert.strictEqual(GEO.withCity("1200 Market St"), "1200 Market St, St. Louis, MO");
  assert.strictEqual(GEO.withCity("1200 Market St, St. Louis, MO 63103"), "1200 Market St, St. Louis, MO 63103");
});
