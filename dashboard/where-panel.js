/* where-panel.js: the "Where" button and its panel, the same on every page. Needs where.js.
 *
 *   const panel = WHEREPANEL.mount(hostElement, {
 *     wards: ["1", ..., "14"],            // empty or missing: the Ward section is left out
 *     nbhds: ["Dutchtown", ...],          // sorted names
 *     value: { ward, nbhd, pt, lbl },     // the current area
 *     radiusLabel: () => "½ mile",        // optional: the distance shown beside an address
 *     addressHint: "…",                   // shown in the Address section when none is chosen
 *     addressLink: { href, text },        // optional link there (pages with no address bar send people to the map)
 *     onChange: ({ ward, nbhd }) => {},   // a ward or neighborhood was chosen, or cleared
 *     onClearAddress: () => {},           // the Clear button beside the address
 *   });
 *   panel.set({ ward, nbhd, pt, lbl });   // when the page changes the area itself
 *
 * Choosing a ward clears the neighborhood and the other way round; an address or pin switches both off until it is
 * cleared (the rules are in where.js). Opens under the button on a wide screen, fills the screen on a phone.
 */
(() => {
  "use strict";

  let uid = 0;

  function mount(host, opts) {
    const id = "where" + ++uid;
    let value = { ward: "", nbhd: "", pt: "", lbl: "", ...(opts.value || {}) };
    let typed = "";
    const wards = opts.wards || [], nbhds = opts.nbhds || [];

    const h = (tag, attrs = {}, text) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      return e;
    };

    const btn = h("button", { type: "button", class: "btn ghost whenbtn", "aria-expanded": "false", "aria-controls": id + "-panel" });
    const vEl = h("span", { class: "whenv" });
    btn.append(h("span", { class: "whenk" }, "Where"), vEl);

    const panel = h("div", { class: "whenpanel wherepanel", id: id + "-panel", role: "group", "aria-label": "Choose the place", hidden: "" });
    const close = h("button", { type: "button", class: "btn ghost whenclose" }, "Close");
    const top = h("div", { class: "whentop" });
    top.append(h("strong", { class: "whentitle" }, "Choose the place"), close);

    const wardHead = h("p", { class: "whenhead" }, "Ward"), wardGrid = h("div", { class: "wardgrid" });
    const nbhdHead = h("p", { class: "whenhead" }, "Neighborhood");
    const search = h("input", { type: "search", class: "nbhdsearch", placeholder: "Type to find a neighborhood", "aria-label": "Find a neighborhood", autocomplete: "off" });
    const list = h("div", { class: "nbhdlist" });
    const addrHead = h("p", { class: "whenhead" }, "Address or pin"), addrRow = h("div", { class: "addrrow" });
    const hint = h("p", { class: "whenhint muted", role: "status", "aria-live": "polite" });
    panel.append(top, wardHead, wardGrid, nbhdHead, search, list, addrHead, addrRow, hint);
    host.append(btn, panel);
    if (!wards.length) { wardHead.hidden = true; wardGrid.hidden = true; }

    const lock = () => WHERE.locked(value);

    function pick(kind, v) {
      const next = WHERE.choose(value, kind, v);
      value = { ...value, ...next };
      closePanel(true); render(); opts.onChange({ ward: value.ward, nbhd: value.nbhd });
    }

    function render() {
      const radius = opts.radiusLabel ? opts.radiusLabel() : "";
      vEl.textContent = WHERE.label(value, radius);
      btn.title = "Place shown: " + vEl.textContent;
      wardGrid.replaceChildren(...wards.map((w) => {
        const b = h("button", { type: "button", class: "btn ghost", "aria-pressed": String(value.ward === w), "aria-label": "Ward " + w }, w);
        b.disabled = lock();
        b.addEventListener("click", () => pick("ward", w));
        return b;
      }));
      const names = WHERE.filterNames(nbhds, typed);
      list.replaceChildren(...(names.length ? names.map((n) => {
        const b = h("button", { type: "button", class: "btn ghost", "aria-pressed": String(value.nbhd === n) }, n);
        b.disabled = lock();
        b.addEventListener("click", () => pick("nbhd", n));
        return b;
      }) : [h("p", { class: "muted small" }, "No neighborhood matches.")]));
      search.disabled = lock();
      addrRow.replaceChildren();
      if (value.pt) {
        addrRow.append(h("span", { class: "addrnow" }, WHERE.label({ pt: value.pt, lbl: value.lbl }, radius)));
        const clear = h("button", { type: "button", class: "btn ghost" }, "Clear");
        clear.addEventListener("click", () => { closePanel(true); opts.onClearAddress && opts.onClearAddress(); });
        addrRow.append(clear);
        hint.textContent = "Ward and neighborhood are off while an address or pin is chosen.";
      } else {
        addrRow.append(h("span", { class: "muted small" }, opts.addressHint || ""));
        if (opts.addressLink) { const l = opts.addressLink, a = h("a", { href: typeof l.href === "function" ? l.href() : l.href }, l.text); addrRow.append(a); }
        hint.textContent = "";
      }
    }

    function openPanel() {
      panel.hidden = false; btn.setAttribute("aria-expanded", "true"); typed = ""; search.value = ""; render();
      panel.classList.remove("whenright");
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) panel.classList.add("whenright");
    }
    function closePanel(focus) { if (panel.hidden) return; panel.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); }

    btn.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel(true)));
    close.addEventListener("click", () => closePanel(true));
    search.addEventListener("input", () => { typed = search.value; render(); });
    host.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); closePanel(true); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.composedPath().includes(host)) closePanel(false); });

    render();
    return {
      set(v) { value = { ward: "", nbhd: "", pt: "", lbl: "", ...v }; render(); },
      close: () => closePanel(false),
    };
  }

  window.WHEREPANEL = { mount };
})();
