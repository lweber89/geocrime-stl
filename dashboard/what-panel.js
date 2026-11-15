/* what-panel.js: the "What" button and its panel, the same on every page. Needs what.js.
 *
 *   const panel = WHATPANEL.mount(hostElement, {
 *     groups: WHAT.groups(D),                          // [{ key, name, cats }]: Persons, Property, Society, ..., Arrest-only (key "Group B")
 *     value: { cats, vc, fa },                         // the choice now in force (see what.js)
 *     violent: WHAT.violentCats(D.records),            // Map: the categories Violent crime covers ("all" or "part")
 *     counts: () => Map | null,                        // optional: offenses per category right now, shown beside each name
 *     groupB: false,                                   // is the arrest-only (Group B) switch on? Omit to leave arrest-only out
 *     applyLabel: "Show on map",                       // the apply button's words; each page names its own ("Update charts")
 *     onChange: ({ cats, vc, fa }) => {},              // the apply button was pressed: apply this choice
 *     onGroupB: (on) => {},                            // ...and arrest-only was switched (the page reloads to load or drop those rows)
 *   });
 *   panel.set(value);                                  // the choice now in force (also drops an unfinished draft)
 *
 * The panel works on a DRAFT: nothing changes on the page until the apply button (greyed out while nothing is ticked). Cancel,
 * Escape, Close or a click outside throws the draft away; Reset sets the draft back to All offenses (Firearm off, arrest-only
 * off) without applying it. A tree: each group (Persons, Property ...) opens to its categories, with a tick box for each,
 * and one on the group that ticks them all (half-ticked when only some are). All offenses ticks every Persons, Property and
 * Society category (arrest-only stays off); Clear selection unticks the offenses (Firearm stays as it is). Ticking Firearm
 * with nothing ticked ticks All offenses first. It is stored as no categories at all (see
 * WHAT.normalize), so links stay short. Groups that are partly ticked open by themselves, ticked categories first.
 * Violent crime ticks the categories it covers and leaves the others greyed; Arrest-only is greyed under it, too.
 * Ticking an arrest-only category (or its group) includes those offenses: applying then reloads the page.
 * Same frame as the When and Where panels: opens under the button, fills the screen on a phone.
 */
(() => {
  "use strict";

  let uid = 0;
  const VIOLENT_NOTE = "Murder, rape, robbery and aggravated assault (the FBI's definition; see Methodology).";
  const DOT = { Persons: "person", Property: "property", Society: "society" };       // the type colors; everything else is the gray ring color
  const num = (n) => n.toLocaleString("en-US");

  function mount(host, opts) {
    const applyLabel = opts.applyLabel || "Show on map";
    const id = "what" + ++uid, GB = "Group B", hasB = opts.groupB != null, violent = opts.violent || new Map();
    const groups = (opts.groups || []).filter((g) => g.key !== GB || hasB);
    const allA = groups.filter((g) => g.key !== GB).flatMap((g) => g.cats), allB = (groups.find((g) => g.key === GB) || { cats: [] }).cats;
    const ctx = { allA, allB, violent };
    let applied = { cats: [], vc: false, fa: false, ...opts.value }, appliedB = !!opts.groupB;
    const drafted = () => ({ cats: WHAT.expand({ ...applied, gb: appliedB }, ctx), vc: applied.vc, fa: applied.fa });      // the ticks for what is in force
    let draft = drafted();
    const open = new Set();                                                  // the groups showing their categories
    const rows = new Map(), heads = new Map();                              // category -> row parts; group key -> header parts
    const h = (tag, attrs = {}, text) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      return e;
    };

    const btn = h("button", { type: "button", class: "btn ghost whenbtn", "aria-expanded": "false", "aria-controls": id + "-panel" });
    const vEl = h("span", { class: "whenv" });
    btn.append(h("span", { class: "whenk" }, "What"), vEl);
    const panel = h("div", { class: "whenpanel whatpanel", id: id + "-panel", role: "group", "aria-label": "Choose the offenses", hidden: "" });
    const close = h("button", { type: "button", class: "btn ghost whenclose" }, "Close");
    const top = h("div", { class: "whentop" });
    top.append(h("strong", { class: "whentitle" }, "Choose the offenses"), close);

    const fa = h("input", { type: "checkbox", id: id + "-fa" });
    const faRow = h("label", { class: "whatcheck", for: id + "-fa" });
    faRow.append(fa, document.createTextNode(" Firearm only (narrows the choice below)"));
    const quick = h("div", { class: "whenpresets" });
    const hasPart = [...violent.values()].includes("part");                       // is any category only partly violent? only then is a * ever shown
    const note = h("p", { class: "whenhint muted small", hidden: "" }, "Violent crime ticks the categories below that it covers. Untick one to leave it out." + (hasPart ? " * means only some offenses in that category count (see Methodology)." : ""));
    const tree = h("div", { class: "whattree" });

    // ---- the tree, built once; refresh() only updates ticks, greying and counts, so keyboard focus stays where it is
    for (const g of groups) {
      const isB = g.key === GB, dot = `var(--type-${DOT[g.key] || "other"})`;
      const sec = h("div", { class: "whatgroup" }), head = h("div", { class: "whatghead" });
      const cb = h("input", { type: "checkbox", id: `${id}-g-${g.key}`, "aria-label": `Include all ${g.name} offenses` });
      const toggle = h("button", { type: "button", class: "whatexpand", "aria-expanded": "false", "aria-controls": `${id}-l-${g.key}` });
      const arrow = h("span", { class: "whatarrow", "aria-hidden": "true" }, "▸");
      toggle.append(arrow, h("i", { class: "dot", style: `background:${dot}` }), h("span", { class: "whatgname" }, g.name));
      const sum = h("span", { class: "whatgsum muted" });
      head.append(cb, toggle, sum);
      const list = h("div", { class: "whatlist", id: `${id}-l-${g.key}`, hidden: "" });
      if (isB) list.append(h("p", { class: "muted small whatbnote" }, "Recorded when someone is arrested, so they say more about enforcement than about how much crime happens. Left out of every number unless you include them; " + applyLabel + " reloads the page to load them."));
      for (const c of g.cats) {
        const lab = h("label", { class: "whatcheck whatcat" }), ccb = h("input", { type: "checkbox" });
        const name = h("span", { class: "whatcname" }, c), n = h("span", { class: "whatn muted" });
        lab.append(ccb, name, n);
        list.append(lab);
        rows.set(c, { lab, cb: ccb, name, n, group: g, isB });
        ccb.addEventListener("change", () => {
          draft = WHAT.toggleCat(draft, c, draft.vc ? violent : null);
          refresh();
        });
      }
      sec.append(head, list);
      tree.append(sec);
      heads.set(g.key, { cb, toggle, arrow, sum, list, group: g, isB, sec });
      toggle.addEventListener("click", () => { open.has(g.key) ? open.delete(g.key) : open.add(g.key); refresh(); });
      cb.addEventListener("change", () => {
        draft = WHAT.toggleGroup(draft, g.cats, cb.checked, draft.vc ? violent : null);
        refresh();
      });
    }

    const reset = h("button", { type: "button", class: "btn ghost" }, "Reset");
    const cancel = h("button", { type: "button", class: "btn ghost" }, "Cancel");
    const show = h("button", { type: "button", class: "btn whenapply" }, applyLabel);
    const empty = h("p", { class: "whenhint muted small whatempty", hidden: "" }, "Tick at least one offense to show.");
    const foot = h("div", { class: "whatfoot" });
    const spacer = h("span", { class: "whatspacer" });
    foot.append(reset, spacer, cancel, show);
    panel.append(top, faRow, h("p", { class: "whenhead" }, "Quick choices"), quick, note, tree, empty, foot);
    host.append(btn, panel);

    const q = (text, pressed, title, fn) => {
      const b = h("button", { type: "button", class: "btn ghost", "aria-pressed": String(pressed) }, text);
      if (title) b.title = title;
      b.addEventListener("click", fn);
      return b;
    };

    function refresh() {
      const counts = opts.counts ? opts.counts() : null, vc = draft.vc;
      vEl.textContent = WHAT.label(applied, { violent, gb: appliedB, groups });
      btn.title = "Offenses shown: " + vEl.textContent;
      fa.checked = !!draft.fa;
      const all = !vc && allA.length > 0 && allA.every((c) => draft.cats.includes(c)), none = !draft.cats.length;
      quick.replaceChildren(
        q("All offenses", all, "Every Persons, Property and Society category (arrest-only offenses stay off).", () => { draft = { cats: [...allA], vc: false, fa: draft.fa }; refresh(); }),
        q("Violent crime (FBI definition)", vc, VIOLENT_NOTE, () => { draft = vc ? { ...draft, vc: false } : WHAT.setViolent(draft, true, violent); refresh(); }),
        q("Clear selection", none && !vc, "Untick every offense, then tick what you want. Firearm only stays as it is.", () => { draft = { cats: [], vc: false, fa: draft.fa }; refresh(); }));
      show.disabled = none; empty.hidden = !none;
      note.hidden = !vc;
      for (const [c, r] of rows) {
        const cov = violent.get(c), ok = !vc || (!r.isB && !!cov);
        r.cb.checked = draft.cats.includes(c);
        r.cb.disabled = !ok;
        r.lab.classList.toggle("dim", !ok);
        r.lab.classList.toggle("covered", vc && ok);
        r.name.textContent = c + (vc && cov === "part" ? " *" : "");
        r.lab.title = vc && cov === "part" ? "Only some offenses in this category count as violent crime (for example rape, but not fondling)." : "";
        const n = counts ? counts.get(c) : undefined;
        r.n.textContent = n == null ? "" : num(n);
      }
      for (const [key, g] of heads) {
        const cats = g.group.cats;
        const able = !vc || (!g.isB && cats.some((c) => violent.has(c))), st = WHAT.groupState(draft, cats, vc ? violent : null);
        g.cb.checked = st === "all"; g.cb.indeterminate = st === "some"; g.cb.disabled = !able;
        const ticked = cats.filter((c) => draft.cats.includes(c)).length;
        const total = counts ? cats.reduce((s, c) => s + (counts.get(c) || 0), 0) : null;
        g.sum.textContent = g.isB && vc ? "none is violent crime" : g.isB && !ticked ? "off"
          : [st === "some" ? `${ticked} of ${cats.length}` : "", total != null && !(g.isB && !ticked) ? num(total) : ""].filter(Boolean).join(" · ");
        g.sec.classList.toggle("dim", !able);
        const on = open.has(key);
        g.list.hidden = !on;
        g.toggle.setAttribute("aria-expanded", String(on));
        g.arrow.textContent = on ? "▾" : "▸";
      }
    }

    // Opening: the draft starts as what is in force, groups with ticked categories open, and ticked categories come first
    // (worked out now, not while ticking, so rows do not jump under the pointer).
    function openPanel() {
      draft = drafted();
      open.clear();
      for (const [key, g] of heads) {
        const cats = g.group.cats, ticked = cats.filter((c) => draft.cats.includes(c));
        if (WHAT.groupState(draft, cats, draft.vc ? violent : null) === "some") open.add(key);          // a partly ticked group opens by itself
        const sorted = [...ticked, ...cats.filter((c) => !ticked.includes(c))];
        for (const c of sorted) g.list.append(rows.get(c).lab);                  // appending moves the row into place
      }
      panel.hidden = false; btn.setAttribute("aria-expanded", "true"); refresh();
      panel.classList.remove("whenright");
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) panel.classList.add("whenright");
    }
    function closePanel(focus) {
      if (panel.hidden) return;
      panel.hidden = true; btn.setAttribute("aria-expanded", "false");
      draft = drafted();                                                          // anything not shown on the map is dropped
      if (focus) btn.focus();
    }
    function apply() {
      if (!draft.cats.length) return;
      const n = WHAT.normalize(draft, ctx), next = { cats: n.cats, vc: n.vc, fa: n.fa }, gb = hasB && n.gb;
      applied = next; closePanel(true);
      opts.onChange({ ...next, cats: [...next.cats] });
      if (hasB && gb !== appliedB && opts.onGroupB) opts.onGroupB(gb);            // loads or drops the arrest-only rows (reloads the page)
      refresh();
    }

    btn.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel(true)));
    close.addEventListener("click", () => closePanel(true));
    cancel.addEventListener("click", () => closePanel(true));
    show.addEventListener("click", apply);
    reset.addEventListener("click", () => { draft = { cats: [...allA], vc: false, fa: false }; refresh(); });
    fa.addEventListener("change", () => {
      draft = { ...draft, fa: fa.checked };
      if (fa.checked && !draft.cats.length && !draft.vc) draft.cats = [...allA];              // Firearm only narrows something: with nothing ticked, that is all offenses
      refresh();
    });
    host.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); closePanel(true); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.composedPath().includes(host)) closePanel(false); });

    refresh();
    return {
      set(v) { applied = { cats: [], vc: false, fa: false, ...v }; draft = drafted(); refresh(); },
      close: () => closePanel(false),
    };
  }

  window.WHATPANEL = { mount };
})();
