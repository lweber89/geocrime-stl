/* what-panel.js: the "What" button and its panel, the same on every page. Needs what.js.
 *
 *   const panel = WHATPANEL.mount(hostElement, {
 *     types: ["Person", "Property", "Society"],        // D.types
 *     cats: { Person: ["Robbery", ...], ... },         // D.cats: categories by type, most common first
 *     value: { cat, vc, hide, fa },                    // the current choice (see what.js)
 *     violent: Map | null,                             // WHAT.violentCats(records): shown on the menu while Violent crime is chosen
 *     counts: () => Map | null,                        // optional: offenses per category right now, shown beside each name
 *     groupB: false,                                   // is the arrest-only (Group B) switch on? Omit to leave the switch out
 *     onChange: ({ cat, vc, hide, fa }) => {},
 *   });
 *   panel.set(value);  panel.groupBInput               // the Group B checkbox, for CRIME.bindGroupB (it reloads the page)
 *
 * The two switches first (Firearm only; the arrest-only Group B switch), then quick choices (All offenses, Violent crime)
 * and the offense types (tick to show, untick to hide) with their categories underneath (click one to see only that one). Same frame as the When
 * and Where panels: opens under the button, fills the screen on a phone, Escape or a click outside closes it.
 */
(() => {
  "use strict";

  let uid = 0;
  const VIOLENT_NOTE = "Murder, rape, robbery and aggravated assault (the FBI's definition; see Methodology).";

  function mount(host, opts) {
    const id = "what" + ++uid, types = opts.types, cats = opts.cats || {};
    let value = { cat: "", vc: false, hide: [], fa: false, ...opts.value };
    const typeOfCat = (c) => types.find((t) => (cats[t] || []).includes(c));
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
    const quick = h("div", { class: "whenpresets" }), body = h("div", { class: "whatbody" });
    const note = h("p", { class: "whenhint muted small", hidden: "" }, "Violent crime covers the highlighted categories. * means only some offenses in that category count (see Methodology). Click a category or type to change the choice.");
    const fa = h("input", { type: "checkbox", id: id + "-fa" });
    const faRow = h("label", { class: "whatcheck", for: id + "-fa" });
    faRow.append(fa, document.createTextNode(" Firearm only (narrows the choice below)"));
    panel.append(top, faRow);                                   // the two switches go first: they are easy to miss further down

    let groupBInput = null;
    if (opts.groupB != null) {
      groupBInput = h("input", { type: "checkbox", id: id + "-gb" });
      const row = h("label", { class: "whatcheck", for: id + "-gb", title: "Group B offenses are arrest-only: trespass, disorderly conduct, drunk driving, curfew and liquor violations, and the catch-all 'all other offenses'. They are off by default and left out of every number." });
      row.append(groupBInput, document.createTextNode(" Include arrest-only offenses (Group B; adds to the choice below)"));
      panel.append(row);
    }
    panel.append(h("p", { class: "whenhead" }, "Quick choices"), quick, note, body);
    host.append(btn, panel);

    const emit = (next) => { value = { ...value, ...next }; render(); opts.onChange({ ...value }); };

    function render() {
      vEl.textContent = WHAT.label(value, types);
      btn.title = "Offenses shown: " + vEl.textContent;
      const q = (text, pressed, title, fn) => {
        const b = h("button", { type: "button", class: "btn ghost", "aria-pressed": String(pressed) }, text);
        if (title) b.title = title;
        b.addEventListener("click", fn);
        return b;
      };
      const all = !value.vc && !value.cat && !(value.hide || []).length;
      quick.replaceChildren(
        q("All offenses", all, "", () => emit({ ...WHAT.clear(value), fa: value.fa })),
        q("Violent crime (FBI definition)", value.vc, VIOLENT_NOTE, () => emit(WHAT.setViolent(value, !value.vc))));
      const counts = opts.counts ? opts.counts() : null;
      note.hidden = !value.vc;
      body.replaceChildren(...types.map((t) => {
        const list0 = cats[t] || [], vcN = value.vc && opts.violent ? list0.filter((c) => opts.violent.has(c)).length : null;
        const on = vcN == null ? !(value.hide || []).includes(t) : vcN > 0, sec = h("div", { class: "whattype" + (vcN === 0 ? " dim" : "") });
        const lab = h("label", { class: "whatcheck whattypehead" });
        const cb = h("input", { type: "checkbox" }); cb.checked = on; cb.indeterminate = vcN != null && vcN > 0 && vcN < list0.length;
        cb.addEventListener("change", () => emit(WHAT.toggleType(value, t, types, typeOfCat)));
        const dot = h("i", { class: "dot", style: `background:var(--type-${t.toLowerCase()})` });
        lab.append(cb, dot, document.createTextNode(" " + t));
        const list = h("div", { class: "nbhdlist" });
        for (const c of cats[t] || []) {
          const n = counts ? ` (${(counts.get(c) || 0).toLocaleString()})` : "";
          const cov = value.vc && opts.violent ? opts.violent.get(c) : null;       // while Violent crime is on, mark what it covers
          const b = q(c + n + (cov === "part" ? " *" : ""), value.vc ? !!cov : value.cat === c, cov === "part" ? "Only some offenses in this category count as violent crime (for example rape, but not fondling)." : "", () => emit(WHAT.setCat(value, c, typeOfCat)));
          if (value.vc && !cov) b.classList.add("dim");
          list.append(b);
        }
        sec.append(lab, list);
        return sec;
      }));
      fa.checked = !!value.fa;
    }

    function openPanel() {
      panel.hidden = false; btn.setAttribute("aria-expanded", "true"); render();
      panel.classList.remove("whenright");
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) panel.classList.add("whenright");
    }
    function closePanel(focus) { if (panel.hidden) return; panel.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); }

    btn.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel(true)));
    close.addEventListener("click", () => closePanel(true));
    fa.addEventListener("change", () => emit({ fa: fa.checked }));
    host.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); closePanel(true); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.composedPath().includes(host)) closePanel(false); });

    render();
    return {
      set(v) { value = { cat: "", vc: false, hide: [], fa: false, ...v }; render(); },
      close: () => closePanel(false),
      groupBInput,
    };
  }

  window.WHATPANEL = { mount };
})();
