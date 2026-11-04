/* what-panel.js: the "What" button and its panel, the same on every page. Needs what.js.
 *
 *   const panel = WHATPANEL.mount(hostElement, {
 *     types: ["Person", "Property", "Society"],        // D.types
 *     cats: { Person: ["Robbery", ...], ... },         // D.cats: categories by type, most common first
 *     value: { cat, vc, hide, fa },                    // the current choice (see what.js)
 *     counts: () => Map | null,                        // optional: offenses per category right now, shown beside each name
 *     groupB: false,                                   // is the arrest-only (Group B) switch on? Omit to leave the switch out
 *     onChange: ({ cat, vc, hide, fa }) => {},
 *   });
 *   panel.set(value);  panel.groupBInput               // the Group B checkbox, for CRIME.bindGroupB (it reloads the page)
 *
 * Quick choices (All offenses, Violent crime), the offense types (tick to show, untick to hide) with their categories
 * underneath (click one to see only that category), then Firearm and the arrest-only switch. Same frame as the When
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
    const fa = h("input", { type: "checkbox", id: id + "-fa" });
    const faRow = h("label", { class: "whatcheck", for: id + "-fa" });
    faRow.append(fa, document.createTextNode(" Firearm only"));
    panel.append(top, h("p", { class: "whenhead" }, "Quick choices"), quick, body, faRow);

    let groupBInput = null;
    if (opts.groupB != null) {
      groupBInput = h("input", { type: "checkbox", id: id + "-gb" });
      const row = h("label", { class: "whatcheck", for: id + "-gb", title: "Group B offenses are arrest-only: trespass, disorderly conduct, drunk driving, curfew and liquor violations, and the catch-all 'all other offenses'. They are off by default and left out of every number." });
      row.append(groupBInput, document.createTextNode(" Include arrest-only offenses (Group B)"));
      panel.append(row);
    }
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
      body.replaceChildren(...types.map((t) => {
        const on = !(value.hide || []).includes(t), sec = h("div", { class: "whattype" });
        const lab = h("label", { class: "whatcheck whattypehead" });
        const cb = h("input", { type: "checkbox" }); cb.checked = on;
        cb.addEventListener("change", () => emit(WHAT.toggleType(value, t, types, typeOfCat)));
        const dot = h("i", { class: "dot", style: `background:var(--type-${t.toLowerCase()})` });
        lab.append(cb, dot, document.createTextNode(" " + t));
        const list = h("div", { class: "nbhdlist" });
        for (const c of cats[t] || []) {
          const n = counts ? ` (${(counts.get(c) || 0).toLocaleString()})` : "";
          list.append(q(c + n, value.cat === c, "", () => emit(WHAT.setCat(value, c, typeOfCat))));
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
