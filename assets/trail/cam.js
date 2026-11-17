/* flemos — trail edition v3: illustrated scenes + a camera driven by scroll.
   far shot -> zoom on the runner -> side tracking one way -> the other way ->
   he comes toward us -> finish line. */
(function () {
  "use strict";
  var TOTAL = 42.195;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lang = "es";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function interp(arr, x) {
    if (x <= arr[0][0]) return arr[0][1];
    for (var i = 1; i < arr.length; i++) if (x <= arr[i][0]) {
      var a = arr[i - 1], b = arr[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return arr[arr.length - 1][1];
  }

  /* ---------- scenes: [p, ux, uy, zoom] keyframes (ux/uy = image fractions at screen centre) ---------- */
  var SCENES = [
    { id: "sc-far", from: 0, to: 0.215, fade: 0.03, keys: [[0, .5, .5, 1], [0.06, .5, .5, 1], [0.215, .63, .6, 3.4]] },
    { id: "sc-a", from: 0.195, to: 0.5, fade: 0.03, bob: true, keys: [[0.195, .48, .42, 2.0], [0.24, .45, .5, 1.35], [0.5, .56, .5, 1.25]] },
    { id: "sc-b", from: 0.49, to: 0.82, fade: 0.03, bob: true, mirror: true, keys: [[0.49, .46, .5, 1.25], [0.82, .58, .5, 1.4]] },
    { id: "sc-run", from: 0.8, to: 0.905, fade: 0.03, fit: "contain", bob: true, keys: [[0.8, .5, .55, 0.82], [0.905, .5, .42, 1.25]] },
    { id: "sc-meta", from: 0.885, to: 1, fade: 0.03, keys: [[0.885, .42, .3, 2.4], [0.97, .5, .5, 1], [1, .5, .5, 1]] }
  ];
  var KM_ANCHORS = [[0, 0], [0.27, 3], [0.36, 14], [0.445, 21], [0.585, 28], [0.675, 33], [0.76, 38], [0.85, 41], [1, TOTAL]];

  var stage = document.querySelector(".stage");
  SCENES.forEach(function (s) {
    s.el = document.getElementById(s.id);
    s.img = s.el.querySelector("img");
  });

  function keyAt(keys, p) {
    if (p <= keys[0][0]) return keys[0];
    for (var i = 1; i < keys.length; i++) if (p <= keys[i][0]) {
      var a = keys[i - 1], b = keys[i], k = ease((p - a[0]) / (b[0] - a[0]));
      return [p, lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
    return keys[keys.length - 1];
  }

  function placeScene(s, p, W, H) {
    var iw = s.img.naturalWidth, ih = s.img.naturalHeight;
    if (!iw) return;
    var s0 = s.fit === "contain" ? H / ih : Math.max(W / iw, H / ih);
    var k = keyAt(s.keys, p), z = k[3], uy = k[2];
    if (H > W) { z = Math.max(1, z * 0.8); uy -= 0.12; }   // portrait: wider shot, runner below the cards
    var w = iw * s0 * z, h = ih * s0 * z;
    var tx = W / 2 - k[1] * w, ty = H / 2 - uy * h;
    if (s.fit !== "contain") {
      tx = clamp(tx, W - w, 0); ty = clamp(ty, H - h, 0);
    } else if (w < W) { tx = (W - w) / 2; }
    if (s.bob && !reduce) ty += Math.sin(window.scrollY * 0.035) * 3;
    s.img.style.width = (iw * s0) + "px";
    s.img.style.height = (ih * s0) + "px";
    s.img.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + z.toFixed(4) + ")";
  }

  /* ---------- beats ---------- */
  var beats = [].slice.call(document.querySelectorAll(".beat"));
  function beatAlpha(el, p) {
    var a = parseFloat(el.dataset.from), b = parseFloat(el.dataset.to), f = 0.02;
    if (p < a - f || p > b + f) return 0;
    if (p < a) return (p - (a - f)) / f;
    if (p > b) return b >= 0.999 ? 1 : 1 - (p - b) / f;
    return 1;
  }

  /* ---------- elevation profile ---------- */
  var NS = "http://www.w3.org/2000/svg";
  var ELEV = [[0, .15], [3, .32], [7, .55], [10, .4], [14, .18], [17, .5], [21, .92], [25, .6], [28, .72], [31, .45], [33, .4], [36, .62], [38, .8], [40, .45], [42.195, .2]];
  var CHECKPOINTS = [
    { km: 0, p: 0, es: "LARGADA", en: "START" }, { km: 3, p: 0.27, es: "Hexacta", en: "Hexacta" }, { km: 14, p: 0.36, es: "GlobalLogic", en: "GlobalLogic" },
    { km: 21, p: 0.445, es: "Hitachi", en: "Hitachi" }, { km: 28, p: 0.585, es: "Palemosoft", en: "Palemosoft" }, { km: 33, p: 0.675, es: "Casos", en: "Cases" },
    { km: 38, p: 0.76, es: "Mochila", en: "Pack" }, { km: TOTAL, p: 1, es: "META", en: "FINISH" }
  ];
  var prof = document.getElementById("profile"), P = { w: 0, h: 0, pad: 18 }, meDot, doneClip, cps = [];
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function kx(km) { return P.pad + (km / TOTAL) * (P.w - P.pad * 2); }
  function ey(e) { return P.h - 8 - e * (P.h - 26); }
  function buildProfile() {
    P.w = prof.clientWidth; P.h = prof.clientHeight;
    prof.setAttribute("viewBox", "0 0 " + P.w + " " + P.h);
    prof.innerHTML = "";
    var pts = [];
    for (var km = 0; km <= TOTAL + 0.001; km += TOTAL / 120) pts.push(kx(km).toFixed(1) + " " + ey(interp(ELEV, Math.min(km, TOTAL))).toFixed(1));
    var ridge = "M" + pts.join(" L");
    el("path", { class: "ground", d: ridge + " L" + kx(TOTAL) + " " + P.h + " L" + kx(0) + " " + P.h + " Z" }, prof);
    el("path", { class: "ridge", d: ridge }, prof);
    var cp = el("clipPath", { id: "doneclip" }, el("defs", {}, prof));
    doneClip = el("rect", { x: 0, y: 0, width: 0, height: P.h }, cp);
    el("path", { class: "done", d: ridge, "clip-path": "url(#doneclip)" }, prof);
    cps = CHECKPOINTS.map(function (c) {
      var x = kx(c.km), y = ey(interp(ELEV, c.km)), gg = el("g", { class: "cp" }, prof);
      el("line", { x1: x, x2: x, y1: y, y2: P.h }, gg);
      el("circle", { cx: x, cy: y, r: 4.5 }, gg);
      var tx = el("text", { x: x, y: Math.max(12, y - 9), "text-anchor": c.km === 0 ? "start" : c.km >= TOTAL ? "end" : "middle" }, gg);
      tx.textContent = c[lang];
      gg.addEventListener("click", function () { scrollToP(c.p); });
      return { g: gg, km: c.km };
    });
    meDot = el("circle", { r: 7, class: "me" }, prof);
  }

  /* ---------- scroll ---------- */
  var race = document.getElementById("race");
  function progress() { var total = race.offsetHeight - innerHeight; return clamp(-race.getBoundingClientRect().top / total, 0, 1); }
  function scrollToP(p) { window.scrollTo({ top: race.offsetTop + p * (race.offsetHeight - innerHeight), behavior: reduce ? "auto" : "smooth" }); }
  var kmEl = document.getElementById("km");
  var turn = document.getElementById("switchback");

  function render() {
    var p = progress(), W = stage.clientWidth, H = stage.clientHeight;
    SCENES.forEach(function (s) {
      var a = 1;
      if (p < s.from) a = s.from === 0 ? 1 : clamp((p - (s.from - s.fade)) / s.fade, 0, 1);
      if (p > s.to) a = s.to >= 1 ? 1 : clamp(1 - (p - s.to) / s.fade, 0, 1);
      if (p < s.from - s.fade || (p > s.to + s.fade && s.to < 1)) a = 0;
      s.el.style.opacity = a;
      s.el.style.visibility = a > 0 ? "visible" : "hidden";
      if (a > 0) placeScene(s, clamp(p, s.from, s.to), W, H);
    });
    turn.style.opacity = clamp(1 - Math.abs(p - 0.495) / 0.02, 0, 1);
    beats.forEach(function (b) {
      var al = beatAlpha(b, p);
      b.style.opacity = al;
      b.style.transform = "translateY(" + ((1 - al) * 18).toFixed(1) + "px)";
      b.style.visibility = al > 0.01 ? "visible" : "hidden";
      b.classList.toggle("live", al > 0.5);
    });
    var km = clamp(interp(KM_ANCHORS, p), 0, TOTAL);
    kmEl.textContent = "KM " + (km >= TOTAL - 0.01 ? "42.2" : km.toFixed(1));
    if (meDot) {
      var x = kx(km);
      meDot.setAttribute("cx", x); meDot.setAttribute("cy", ey(interp(ELEV, km)));
      doneClip.setAttribute("width", x);
      cps.forEach(function (c) { c.g.classList.toggle("passed", km >= c.km - 0.05); });
    }
  }
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; render(); }); } }

  /* ---------- language ---------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function setLang(l) {
    lang = l;
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
    buildProfile(); render();
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang); }); });

  /* ---------- cases dialog ---------- */
  var dlg = document.getElementById("caseDlg");
  document.querySelectorAll("[data-case]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      dlg.querySelector(".dlg-body").innerHTML = document.getElementById("case-" + btn.dataset.case).innerHTML;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest(".dlg-close")) dlg.close(); });
  document.querySelectorAll("[data-go]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); scrollToP(parseFloat(a.dataset.go)); }); });

  /* ---------- boot ---------- */
  SCENES.forEach(function (s) { if (!s.img.complete) s.img.addEventListener("load", render); });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { buildProfile(); render(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildProfile);
  var saved = store("lang");
  setLang(saved || ((navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en"));
})();
