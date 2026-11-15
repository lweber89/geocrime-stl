/* what.js: the rules for the "What" filter, with no page code, so every page and the tests share them.
 *
 * A What choice is { cats, vc, fa }:
 *   cats  the offense categories ticked, as a list of names; an empty list means every offense
 *   vc    true = the FBI's violent crime definition (murder, rape, robbery, aggravated assault; see the Methodology page)
 *   fa    only offenses involving a firearm
 * The three narrow together: an offense must be in a ticked category (if any are ticked), be violent crime (if vc is on)
 * and involve a firearm (if fa is on). Violent crime is also a shortcut: it ticks every category it covers, then stays
 * on as a check of its own, so a category it only partly covers (Sex Offenses: rape counts, fondling does not) shows
 * only the violent part. Arrest-only (Group B) offenses are switched on and off separately by CRIME (they load on a
 * page reload); `cats` may name Group B categories once they are loaded.
 *
 * Older links wrote one category (`cat`) and switched-off types (`hide`); fromLink() turns them into `cats`.
 *
 *   WHAT.matches(record, s)        does this offense pass?
 *   WHAT.label(s, opts)            "All offenses", "Violent crime · Firearm", "Robbery", "3 categories"
 *   WHAT.fromLink(parsed, D)       the choice for a page that has loaded its data D, from FILTERS.parse()
 *   WHAT.groups(D)                 the tree: [{ key, name, cats }] for Persons, Property, Society (and Other), then Arrest-only
 *   WHAT.toggleCat / toggleGroup / setViolent / clear / groupState   the panel's rules for a draft choice
 */
(() => {
  "use strict";

  const catsOf = (s) => (s && s.cats) || [];

  const matches = (a, s) => {
    const cats = catsOf(s);
    return (!s.vc || a.violent) && (!cats.length || cats.includes(a.cat)) && (!s.fa || a.firearm);
  };

  // opts.violent: Map of the categories violent crime covers (violentCats), so "Violent crime" with every one of them
  // ticked reads as just "Violent crime". opts.gb: the arrest-only switch is on.
  function label(s, opts = {}) {
    const cats = catsOf(s), v = opts.violent;
    let base;
    if (s.vc) {
      base = "Violent crime";
      const narrowed = cats.length && (!v || cats.length < v.size);
      if (narrowed) base += cats.length === 1 ? ` · ${cats[0]}` : ` · ${cats.length} categories`;
    } else if (!cats.length) base = opts.gb ? "All offenses + arrest-only" : "All offenses";
    else base = cats.length === 1 ? cats[0] : `${cats.length} categories`;
    return s.fa ? `${base} · Firearm` : base;
  }

  // Which categories the violent crime shortcut covers, from the offenses themselves: Map category -> "all" or "part"
  // (a category can hold both: sex offenses include rape, which counts, and fondling, which does not).
  function violentCats(records) {
    const n = new Map();
    for (const a of records) { const c = n.get(a.cat) || { v: 0, all: 0 }; c.all++; if (a.violent) c.v++; n.set(a.cat, c); }
    const out = new Map();
    for (const [cat, c] of n) if (c.v) out.set(cat, c.v === c.all ? "all" : "part");
    return out;
  }

  // The choice for a page that has loaded its data (D from CRIME.load), from a parsed link (FILTERS.parse). Categories the
  // data does not have are dropped (a hand-edited link, or an arrest-only category while those are left out). The older
  // `hide` (offense types switched off) becomes the list of categories of the types left on.
  function fromLink(s, D) {
    const known = new Set(Object.values(D.cats).flat());
    let cats = catsOf(s).filter((c) => known.has(c));
    const hide = (s.hide || []).filter((t) => D.types.includes(t));
    if (!cats.length && hide.length) {
      const gb = new Set(D.groupBCats || []);                                    // arrest-only categories were never affected by the type boxes
      const kept = D.types.filter((t) => !hide.includes(t)).flatMap((t) => D.cats[t]).filter((c) => !gb.has(c));
      cats = [...kept, ...(D.includeGroupB ? [...gb].filter((c) => known.has(c)) : [])];
    }
    return { cats: [...new Set(cats)], vc: !!s.vc, fa: !!s.fa };
  }

  // The groups the What panel shows, from the data (D from CRIME.load): the NIBRS groups Persons, Property and Society (most
  // common category first), "Other" for any category with no group yet, and last the arrest-only (Group B) categories, which
  // are known from the manifest even while those offenses are left out of the data.
  function groups(D) {
    const n = new Map(), groupOf = new Map(), gb = new Set(D.groupBCats || []);
    for (const a of D.records) { n.set(a.cat, (n.get(a.cat) || 0) + 1); if (!groupOf.has(a.cat)) groupOf.set(a.cat, a.group); }
    const inA = (pred) => [...groupOf].filter(([c, g]) => !gb.has(c) && pred(g)).map(([c]) => c).sort((x, y) => n.get(y) - n.get(x) || x.localeCompare(y));
    const KNOWN = ["Persons", "Property", "Society"];
    const out = KNOWN.map((g) => ({ key: g, name: g, cats: inA((x) => x === g) }));
    out.push({ key: "Other", name: "Other", cats: inA((x) => !KNOWN.includes(x)) });
    const arrest = [...gb].sort((x, y) => (n.get(y) || 0) - (n.get(x) || 0) || x.localeCompare(y));
    return [...out.filter((g) => g.cats.length), { key: "Group B", name: "Arrest-only (Group B)", cats: arrest }];
  }

  // ---- the panel's draft choice. Each returns a new choice and leaves the old one alone.
  // `violent` is the Map from violentCats while Violent crime is on (null otherwise): then only categories it covers can be ticked.
  const allowed = (s, cat, violent) => !(s.vc && violent) || violent.has(cat);

  function toggleCat(s, cat, violent) {
    if (!allowed(s, cat, violent)) return s;
    const cats = catsOf(s);
    return { ...s, cats: cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat] };
  }

  // Tick or untick every category of a group at once (only the ones violent crime covers, while it is on).
  function toggleGroup(s, groupCats, on, violent) {
    const list = groupCats.filter((c) => allowed(s, c, violent));
    const rest = catsOf(s).filter((c) => !list.includes(c));
    return { ...s, cats: on ? [...rest, ...list] : rest };
  }

  // "none", "some" or "all" of a group's categories ticked (counting only the ones that can be ticked).
  function groupState(s, groupCats, violent) {
    const list = groupCats.filter((c) => allowed(s, c, violent)), cats = catsOf(s);
    const n = list.filter((c) => cats.includes(c)).length;
    return !n ? "none" : n === list.length ? "all" : "some";
  }

  // Violent crime on ticks every category it covers (a fresh choice of categories); off leaves the ticks as they are.
  const setViolent = (s, on, violent) => (on ? { ...s, vc: true, cats: violent ? [...violent.keys()] : [] } : { ...s, vc: false });

  const clear = () => ({ cats: [], vc: false, fa: false });

  const api = { matches, label, violentCats, fromLink, groups, toggleCat, toggleGroup, groupState, setViolent, clear };
  if (typeof module !== "undefined" && module.exports) module.exports = api;      // so tests can load this file in Node
  else window.WHAT = api;
})();
