/* what-panel.js: the "What" button and its panel, the same on every page. Needs what.js.
 *
 *   const panel = WHATPANEL.mount(hostElement, {
 *     types: ["Person", "Property", "Society"],        // D.types
 *     groupBCats: ["Trespass", ...],                  // D.groupBCats: the arrest-only categories, which get their own tab
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
    const id = "what" + ++uid, cats = opts.cats || {}, gbSet = new Set(opts.groupBCats || []), GB = "Arrest-only";
    const aCats = (t) => (cats[t] || []).filter((c) => !gbSet.has(c));             // Group A categories of a type; arrest-only ones have their own tab
    const types = opts.types.filter((t) => aCats(t).length), hasB = opts.groupB != null, tabTypes = hasB ? [...types, GB] : types;
    let value = { cat: "", vc: false, hide: [], fa: false, ...opts.value };
    const typeOfCat = (c) => (gbSet.has(c) ? GB : types.find((t) => aCats(t).includes(c)));
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
    const tabs = h("div", { class: "whentabs", role: "tablist", "aria-label": "Offense types" });
    let active = null, lastVc = false;
    const note = h("p", { class: "whenhint muted small", hidden: "" }, "Violent crime covers the tinted categories. Click one to narrow to it, or untick a type to leave it out. * means only some offenses in that category count (see Methodology).");
    const fa = h("input", { type: "checkbox", id: id + "-fa" });
    const faRow = h("label", { class: "whatcheck", for: id + "-fa" });
    faRow.append(fa, document.createTextNode(" Firearm only (narrows the choice below)"));
    panel.append(top, faRow);                                   // Firearm first: it is easy to miss further down

    let groupBInput = null, groupBRow = null, groupBText = null;
    if (opts.groupB != null) {
      groupBInput = h("input", { type: "checkbox", id: id + "-gb" });
      const row = h("label", { class: "whatcheck", for: id + "-gb", title: "Group B offenses are arrest-only: trespass, disorderly conduct, drunk driving, curfew and liquor violations, and the catch-all 'all other offenses'. They are off by default and left out of every number." });
      groupBText = document.createTextNode(""); groupBRow = row;
      row.append(groupBInput, groupBText);
    }
    panel.append(h("p", { class: "whenhead" }, "Quick choices"), quick, note, tabs, body);
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
      const listOf = (t) => (t === GB ? (opts.groupB ? [...gbSet] : []) : aCats(t));      // arrest-only categories can be chosen once they are loaded
      const cover = (t) => (value.vc && opts.violent ? (t === GB ? 0 : listOf(t).filter((c) => opts.violent.has(c)).length) : null);
      const isOn = (t) => (t === GB ? !!opts.groupB && !value.vc : !(value.hide || []).includes(t) && (cover(t) == null || cover(t) > 0));
      if (value.vc && !lastVc) active = types.find((t) => cover(t) > 0) || active;      // turning Violent crime on: open the first tab it covers
      lastVc = value.vc;
      if (!tabTypes.includes(active)) active = (value.cat && typeOfCat(value.cat)) || types.find(isOn) || tabTypes[0];
      tabs.replaceChildren(...tabTypes.map((t) => {
        const tb = h("button", { type: "button", role: "tab", class: "whentab" + (isOn(t) ? "" : " off") + (t !== GB && (value.hide || []).includes(t) ? " struck" : ""), "aria-selected": String(t === active), id: id + "-tab-" + t });
        tb.append(h("i", { class: "dot", style: `background:var(--type-${t === GB ? "other" : t.toLowerCase()})` }), document.createTextNode(" " + t));
        tb.addEventListener("click", () => { active = t; render(); });
        return tb;
      }));
      const t = active, list0 = listOf(t), vcN = cover(t);
      const sec = h("div", { class: "whattype", role: "tabpanel", "aria-labelledby": id + "-tab-" + t });
      let lab;
      if (t === GB) lab = groupBRow;                         // the arrest-only switch lives in its own tab (turning it on reloads the page)
      else {
        lab = h("label", { class: "whatcheck whattypehead" });
        const cb = h("input", { type: "checkbox" }); cb.checked = isOn(t); cb.indeterminate = vcN != null && vcN > 0 && vcN < list0.length;
        cb.disabled = vcN === 0;
        cb.addEventListener("change", () => emit(WHAT.toggleType(value, t, value.vc && opts.violent ? types.filter((x) => cover(x) > 0) : types, typeOfCat)));
        lab.append(cb, document.createTextNode(` Include ${t} offenses`));
      }
      const list = h("div", { class: "nbhdlist" });
      for (const c of list0) {
        const n = counts ? ` (${(counts.get(c) || 0).toLocaleString()})` : "";
        const cov = value.vc && opts.violent ? opts.violent.get(c) : null;       // while Violent crime is on, mark what it covers
        const live = !value.vc || !opts.violent || (cov && isOn(t));              // a category outside the violent set, or of a type left out, cannot be chosen
        const b = q(c + n + (cov === "part" ? " *" : ""), value.cat === c, cov === "part" ? "Only some offenses in this category count as violent crime (for example rape, but not fondling)." : "", () => emit(WHAT.setCat(value, c, typeOfCat, opts.violent)));
        if (value.vc && opts.violent) { if (live) b.classList.add("covered"); else { b.classList.add("dim"); b.disabled = true; } }
        list.append(b);
      }
      sec.append(lab);
      if (t === GB && !opts.groupB) sec.append(h("p", { class: "muted small" }, `Arrest-only offenses (${[...gbSet].slice(0, 3).join(", ")} and more) are recorded when someone is arrested, so they say more about enforcement than about how much crime happens. They are left out of every number unless you include them; turning them on reloads the page.`));
      else if (t === GB && value.vc) sec.append(h("p", { class: "muted small" }, "None of these are part of violent crime."));
      else sec.append(list);
      body.replaceChildren(sec);
      fa.checked = !!value.fa;
      if (groupBInput) {                                       // no arrest-only offense is violent crime, so the switch would do nothing
        groupBInput.disabled = !!value.vc;
        groupBRow.classList.toggle("dim", !!value.vc);
        groupBText.nodeValue = " Include arrest-only offenses (Group B)" + (value.vc ? ": not part of violent crime" : "");
      }
    }

    function openPanel() {
      active = null; panel.hidden = false; btn.setAttribute("aria-expanded", "true"); render();
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
