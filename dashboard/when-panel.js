/* when-panel.js: the "When" button and its panel, the same on every page.
 *
 *   const panel = WHENPANEL.mount(hostElement, {
 *     keys,                       // the month keys the data has, e.g. ["2024-01", ..., "2026-09"]
 *     value: "l12",               // the current `when` (see filters.js and when.js)
 *     maxMonths: 6,               // optional: periods longer than this are switched off (the map's whole-city limit)
 *     limitNote: "…",             // optional: why, shown on the switched-off choices
 *     onChange: (when) => {},     // called with the new `when` when the person chooses
 *   });
 *   panel.set("l3");  panel.setLimit(null);
 *
 * The panel holds quick choices (Latest month, Last 3, 6, 12 months, Year to date, All data) and a month grid: click a
 * start month, then an end month (the same month twice is one month). Months the data does not have are switched off.
 * It opens under the button on a wide screen and fills the screen on a phone. Escape or a click outside closes it.
 * Needs when.js loaded first.
 */
(() => {
  "use strict";

  let uid = 0;

  function mount(host, opts) {
    const id = "when" + ++uid;
    const keys = opts.keys;
    let value = opts.value, maxMonths = opts.maxMonths || null, pick = null, year = null;
    const limitNote = opts.limitNote || "";

    const h = (tag, attrs = {}, text) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      return e;
    };

    const btn = h("button", { type: "button", class: "btn ghost whenbtn", "aria-expanded": "false", "aria-controls": id + "-panel" });
    const kEl = h("span", { class: "whenk" }, "When"), vEl = h("span", { class: "whenv" });
    btn.append(kEl, vEl);

    const panel = h("div", { class: "whenpanel", id: id + "-panel", role: "group", "aria-label": "Choose the period", hidden: "" });
    const close = h("button", { type: "button", class: "btn ghost whenclose" }, "Close");
    const presetsEl = h("div", { class: "whenpresets" });
    const hint = h("p", { class: "whenhint muted", role: "status", "aria-live": "polite" });
    const yearRow = h("div", { class: "whenyear" });
    const prev = h("button", { type: "button", class: "btn ghost", "aria-label": "Previous year" }, "‹");
    const next = h("button", { type: "button", class: "btn ghost", "aria-label": "Next year" }, "›");
    const yEl = h("strong", { "aria-live": "polite" });
    yearRow.append(prev, yEl, next);
    const grid = h("div", { class: "whengrid" });
    const top = h("div", { class: "whentop" }, null);
    top.append(h("strong", { class: "whentitle" }, "Choose the period"), close);
    panel.append(top, h("p", { class: "whenhead" }, "Quick choices"), presetsEl, h("p", { class: "whenhead" }, "Or pick months"), yearRow, grid, hint);
    host.append(btn, panel);

    const years = () => keys.length ? [Number(keys[0].slice(0, 4)), Number(keys[keys.length - 1].slice(0, 4))] : [0, 0];
    const tooLong = (when) => { const r = WHEN.resolve(when, keys); return !!(maxMonths && r && r.n > maxMonths); };

    function choose(when) {
      if (tooLong(when)) { hint.textContent = limitNote || `Periods longer than ${maxMonths} months are not available here.`; return; }
      value = when; pick = null; closePanel(true); render(); opts.onChange(when);
    }

    function render() {
      const cur = WHEN.resolve(value, keys);
      vEl.textContent = WHEN.label(value, keys) || "Choose";
      btn.title = cur ? "Period shown: " + WHEN.dates(value, keys) : "Choose the period";
      presetsEl.replaceChildren(...WHEN.presets(keys).map((p) => {
        const b = h("button", { type: "button", class: "btn ghost", "aria-pressed": String(p.when === value) }, p.label);
        if (tooLong(p.when)) { b.disabled = true; b.title = limitNote; }
        b.addEventListener("click", () => choose(p.when));
        return b;
      }));
      const [y0, y1] = years();
      if (year == null) year = cur ? Number(cur.to.slice(0, 4)) : y1;
      year = Math.min(Math.max(year, y0), y1);
      yEl.textContent = String(year);
      prev.disabled = year <= y0; next.disabled = year >= y1;
      const inRange = new Set(cur ? cur.months : []);
      const ends = new Set(pick ? [pick] : cur ? [cur.from, cur.to] : []);      // the first and last month get a check mark and a solid fill
      const row = WHEN.grid(keys).find((g) => g.year === year);
      grid.replaceChildren(...(row ? row.months : []).map((m) => {
        const b = h("button", { type: "button", class: "btn ghost" + (ends.has(m.key) ? " end" : ""), "aria-pressed": String(pick ? m.key === pick : inRange.has(m.key)) }, m.name);
        b.setAttribute("aria-label", WHEN.monLabel(m.key));
        if (!m.has) { b.disabled = true; b.title = "No data for this month"; }
        b.addEventListener("click", () => {
          if (!pick) { pick = m.key; hint.textContent = `Start: ${WHEN.monLabel(m.key)}. Now pick the last month, or the same month again for just that one.`; render(); return; }
          const a = pick <= m.key ? pick : m.key, z = pick <= m.key ? m.key : pick;
          choose(a === z ? a : `${a}..${z}`);
        });
        return b;
      }));
    }

    function openPanel() {
      panel.hidden = false; btn.setAttribute("aria-expanded", "true"); year = null; pick = null; hint.textContent = ""; render();
      panel.classList.remove("whenright");                                   // open to the right of the button; flip if that runs off the screen
      if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) panel.classList.add("whenright");
    }
    function closePanel(focus) { if (panel.hidden) return; panel.hidden = true; btn.setAttribute("aria-expanded", "false"); pick = null; if (focus) btn.focus(); }

    btn.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel(true)));
    close.addEventListener("click", () => closePanel(true));
    prev.addEventListener("click", () => { year -= 1; render(); });
    next.addEventListener("click", () => { year += 1; render(); });
    host.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); closePanel(true); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.composedPath().includes(host)) closePanel(false); });   // composedPath: the clicked button may already have been redrawn away

    render();
    return {
      set(v) { value = v; year = null; render(); },
      setLimit(m) { maxMonths = m || null; render(); },
      close: () => closePanel(false),
    };
  }

  window.WHENPANEL = { mount };
})();
