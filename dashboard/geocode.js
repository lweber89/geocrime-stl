/* geocode.js: turn a typed street address into a point, from a static page with no server and no API key.
 *
 *   const r = await GEO.find("1200 Market St");
 *   r = { status: "ok", lat, lon, label, source }
 *     | { status: "outside", label }     found, but not inside the City of St. Louis
 *     | { status: "notfound" }           no match
 *     | { status: "error" }              every service failed to answer
 *
 * Three free services are tried in order, and the first answer that lands inside the City wins:
 *   1. The City of St. Louis composite geocoder (ArcGIS REST). Best for city addresses. Called with fetch(),
 *      so it only works if the City's server allows browser (CORS) requests; if not, we fall through.
 *   2. OpenStreetMap's Nominatim. Allows browser requests. Its usage policy allows light use (about one
 *      request per second, no search-as-you-type), which fits a search that runs when the button is pressed.
 *   3. The U.S. Census Bureau geocoder. It does not allow CORS, so it is called with JSONP (a script tag).
 *
 * "Inside the City" is checked with the real city outline when the page supplies one (impl.contains),
 * otherwise with a bounding box. The address is sent only to those services. Nothing is stored by this site.
 */
(() => {
  "use strict";

  const CITY_URL = "https://maps6.stlouis-mo.gov/arcgis/rest/services/GEOCODERS/COMPOSITE_GEOCODE/GeocodeServer/findAddressCandidates";
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
  const BOX = [38.51, -90.34, 38.79, -90.14];            // [minLat, minLon, maxLat, maxLon]: the city plus a small margin
  const MIN_SCORE = 80;                                    // ignore weak City matches (0-100)

  const inCity = (lat, lon) => lat >= BOX[0] && lat <= BOX[2] && lon >= BOX[1] && lon <= BOX[3];
  const withCity = (q) => (/\b(mo|missouri|st\.?\s*louis|saint\s+louis)\b/i.test(q) ? q : `${q}, St. Louis, MO`);

  // ---- reading each service's answer (kept separate so they can be tested without a network)
  function parseCity(json) {
    const wkid = json && json.spatialReference && json.spatialReference.wkid;
    if (wkid && wkid !== 4326 && wkid !== 4269) return null;           // we asked for latitude/longitude
    const best = ((json && json.candidates) || [])
      .filter((c) => c.location && c.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)[0];
    return best ? { lat: best.location.y, lon: best.location.x, label: best.address, source: "City of St. Louis" } : null;
  }

  function parseNominatim(json) {
    const m = Array.isArray(json) && json[0];
    return m ? { lat: Number(m.lat), lon: Number(m.lon), label: m.display_name, source: "OpenStreetMap" } : null;
  }

  function parseCensus(json) {
    const m = json && json.result && json.result.addressMatches && json.result.addressMatches[0];
    return m ? { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress, source: "U.S. Census Bureau" } : null;
  }

  // ---- talking to each service
  async function cityLookup(q) {
    const params = new URLSearchParams({ SingleLine: q, outSR: "4326", maxLocations: "3", outFields: "*", f: "json" });
    const res = await fetch(`${CITY_URL}?${params}`);
    if (!res.ok) throw new Error("City geocoder: HTTP " + res.status);
    const json = await res.json();
    if (json.error) throw new Error("City geocoder: " + (json.error.message || "error"));
    return parseCity(json);
  }

  async function nominatimLookup(q) {
    const params = new URLSearchParams({
      q, format: "jsonv2", limit: "1", countrycodes: "us", addressdetails: "0",
      viewbox: `${BOX[1]},${BOX[2]},${BOX[3]},${BOX[0]}`,        // prefer results in and around the city (not a hard limit)
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`);
    if (!res.ok) throw new Error("Nominatim: HTTP " + res.status);
    return parseNominatim(await res.json());
  }

  function jsonp(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const name = "geo_cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const done = () => { clearTimeout(timer); delete window[name]; script.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error("timeout")); }, timeoutMs);
      window[name] = (data) => { done(); resolve(data); };
      script.onerror = () => { done(); reject(new Error("script error")); };
      script.src = `${url}&callback=${name}`;
      document.head.appendChild(script);
    });
  }

  async function censusLookup(q) {
    const params = new URLSearchParams({ address: q, benchmark: "Public_AR_Current", format: "jsonp" });
    return parseCensus(await jsonp(`${CENSUS_URL}?${params}`));
  }

  // ---- the public call. `impl` lets tests replace the two lookups.
  async function find(query, impl = {}) {
    const q = String(query || "").trim();
    if (!q) return { status: "notfound" };
    const contains = impl.contains || inCity;
    const steps = [[impl.city || cityLookup, q], [impl.osm || nominatimLookup, withCity(q)], [impl.census || censusLookup, withCity(q)]];
    let failures = 0, outside = null;
    for (const [lookup, text] of steps) {
      try {
        const r = await lookup(text);
        if (!r) continue;
        if (contains(r.lat, r.lon)) return { status: "ok", ...r };
        outside = outside || r;
      } catch (e) {
        failures++;
      }
    }
    if (outside) return { status: "outside", label: outside.label };
    return { status: failures === steps.length ? "error" : "notfound" };
  }

  window.GEO = { find, parseCity, parseNominatim, parseCensus, inCity, withCity };
})();
