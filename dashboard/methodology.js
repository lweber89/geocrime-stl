/* methodology.js: fills in the few numbers on the methodology page (data-through date, size, masked list)
   from the same manifest the dashboard reads, so the page can never disagree with the data. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const num = (n) => Number(n).toLocaleString("en-US");
  const day = (s) => new Date(s + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const mon = (m) => new Date(m + "-15T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  fetch("data/manifest.json?v=" + Date.now()).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((m) => {
    $("through").textContent = day(m.through);
    $("size").textContent = `${num(m.rows)} offenses in ${num(m.incidents)} incidents, ${mon(m.months[0].m)} to ${mon(m.months.at(-1).m)}`;
    $("unmapped").textContent = num(m.unmapped);
    $("maskedN").textContent = num(m.masked || 0);
    const list = $("masked");
    list.replaceChildren(...(m.maskedCategories || []).map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  }).catch(() => {
    for (const id of ["through", "size", "unmapped", "maskedN"]) $(id).textContent = "(not available)";
    $("masked").textContent = "Rape, Sodomy, Criminal Sexual Contact, Fondling, Statutory Rape, Incest, Human Trafficking, Family Offenses (Nonviolent), and Kidnapping/Abduction.";
  });
})();
