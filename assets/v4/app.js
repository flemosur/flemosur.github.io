/* Propuesta 4 · loader, idioma, revelados, deriva de títulos, casos */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  /* ---------- loader: 0 → 42 km ---------- */
  var num = document.getElementById("loadNum"), bar = document.getElementById("loadBar");
  var t0 = performance.now(), dur = reduce ? 0 : 1400;
  function tick(now) {
    var k = dur ? Math.min(1, (now - t0) / dur) : 1;
    var e = 1 - Math.pow(1 - k, 3);
    num.textContent = Math.round(e * 42);
    bar.style.width = (e * 100) + "%";
    if (k < 1) requestAnimationFrame(tick);
    else setTimeout(function () { document.body.classList.remove("is-loading"); }, reduce ? 0 : 250);
  }
  requestAnimationFrame(tick);

  /* ---------- idioma ---------- */
  function setLang(l) {
    document.documentElement.lang = l;
    document.querySelectorAll("[data-en]").forEach(function (n) {
      if (n.dataset.es === undefined) n.dataset.es = n.innerHTML;
      n.innerHTML = l === "en" ? n.dataset.en : n.dataset.es;
    });
    document.querySelectorAll("[data-en-alt]").forEach(function (n) {
      if (n.dataset.esAlt === undefined) n.dataset.esAlt = n.alt;
      n.alt = l === "en" ? n.dataset.enAlt : n.dataset.esAlt;
    });
    document.querySelectorAll("[data-en-aria-label]").forEach(function (n) {
      if (n.dataset.esAriaLabel === undefined) n.dataset.esAriaLabel = n.getAttribute("aria-label");
      n.setAttribute("aria-label", l === "en" ? n.dataset.enAriaLabel : n.dataset.esAriaLabel);
    });
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === l)); });
    store("lang", l);
    drift();
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang); }); });

  /* ---------- revelados ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (r, i) { r.style.transitionDelay = (i % 3) * 60 + "ms"; io.observe(r); });
  } else reveals.forEach(function (r) { r.classList.add("in"); });

  /* ---------- deriva horizontal de los títulos gigantes ---------- */
  var drifters = Array.prototype.slice.call(document.querySelectorAll(".drift"));
  var ticking = false;
  function drift() {
    ticking = false;
    if (reduce) return;
    var vh = window.innerHeight, vw = window.innerWidth;
    drifters.forEach(function (d) {
      var r = d.parentNode.getBoundingClientRect();
      var p = (r.top + r.height / 2 - vh / 2) / vh;          // -1 … 1 alrededor del centro
      p = Math.max(-1.2, Math.min(1.2, p));
      d.style.transform = "translateX(" + (p * parseFloat(d.dataset.drift) * vw * 0.08) + "px)";
    });
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
  window.addEventListener("resize", drift);

  /* ---------- casos: vista previa que sigue al cursor + diálogo ---------- */
  var peek = document.querySelector(".peek"), peekImg = peek.querySelector("img");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var dlg = document.getElementById("caseDlg");
  document.querySelectorAll("[data-case]").forEach(function (btn) {
    if (fine) {
      btn.addEventListener("mouseenter", function () { peekImg.src = btn.dataset.img; peek.classList.add("on"); });
      btn.addEventListener("mouseleave", function () { peek.classList.remove("on"); });
    }
    btn.addEventListener("click", function () {
      peek.classList.remove("on");
      dlg.querySelector(".dlg-body").innerHTML = document.getElementById("case-" + btn.dataset.case).innerHTML;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
  });
  if (fine) window.addEventListener("mousemove", function (e) { peek.style.left = (e.clientX + 150) + "px"; peek.style.top = e.clientY + "px"; }, { passive: true });
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest(".dlg-close")) dlg.close(); });

  /* ---------- arranque ---------- */
  var saved = store("lang");
  setLang(saved || ((navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en"));
})();
