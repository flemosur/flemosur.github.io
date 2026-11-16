/* flemos — trail edition: scroll = run */
(function () {
  "use strict";
  var TOTAL = 42.195;
  var SVGNS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stages = [].slice.call(document.querySelectorAll(".stage[data-km]"));
  var lang = "es";

  /* ---------------- language ---------------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll("[data-en]").forEach(function (el) {
      if (el.dataset.es === undefined) el.dataset.es = el.innerHTML;
      el.innerHTML = l === "en" ? el.dataset.en : el.dataset.es;
    });
    document.querySelectorAll("[data-en-alt]").forEach(function (el) {
      if (el.dataset.esAlt === undefined) el.dataset.esAlt = el.alt;
      el.alt = l === "en" ? el.dataset.enAlt : el.dataset.esAlt;
    });
    document.querySelectorAll("[data-en-aria-label]").forEach(function (el) {
      if (el.dataset.esAriaLabel === undefined) el.dataset.esAriaLabel = el.getAttribute("aria-label");
      el.setAttribute("aria-label", l === "en" ? el.dataset.enAriaLabel : el.dataset.esAriaLabel);
    });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === l));
    });
    store("lang", l);
    layout();
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); });
  });

  /* ---------------- draw-on line art + reveals ---------------- */
  document.querySelectorAll(".draw .ln").forEach(function (p) {
    try { p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1); } catch (e) {}
  });
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll(".draw, .reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".draw, .reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- trail path behind the page ---------------- */
  var main = document.getElementById("main");
  var trail = main.querySelector(".trail-svg");
  var todo = trail.querySelector(".todo");
  var run = trail.querySelector(".run");
  var trailLen = 0, samples = [];

  function buildTrail() {
    var w = main.clientWidth, h = main.scrollHeight;
    trail.setAttribute("width", w);
    trail.setAttribute("height", h);
    trail.setAttribute("viewBox", "0 0 " + w + " " + h);
    var narrow = w < 820;
    var left = narrow ? 14 : Math.max(16, (w - 1080) / 4);
    var right = narrow ? 22 : w - left;
    var d = "", px = 0, pb = 0;
    stages.forEach(function (s, i) {
      var x = i % 2 ? right : left;
      var top = s.offsetTop, bottom = top + s.offsetHeight;
      var inset = narrow ? 40 : 60;
      if (i === 0) d = "M" + x + " " + (top + inset);
      else d += " C" + px + " " + (pb + 30) + " " + x + " " + (top - 30) + " " + x + " " + (top + inset);
      d += " L" + x + " " + (bottom - inset);
      px = x; pb = bottom - inset;
    });
    todo.setAttribute("d", d);
    run.setAttribute("d", d);
    trailLen = run.getTotalLength();
    run.style.strokeDasharray = trailLen + " " + trailLen;
    samples = [];
    var N = 300;
    for (var i = 0; i <= N; i++) {
      var l = (trailLen * i) / N;
      samples.push([run.getPointAtLength(l).y, l]);
    }
  }

  function lenAtY(y) {
    for (var i = 1; i < samples.length; i++) {
      if (samples[i][0] >= y) {
        var a = samples[i - 1], b = samples[i];
        var t = b[0] === a[0] ? 0 : (y - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return trailLen;
  }

  /* ---------------- elevation profile ---------------- */
  var ELEV = [[0, .15], [3, .32], [7, .55], [10, .4], [14, .18], [17, .5], [21, .92], [25, .6], [28, .72], [31, .45], [33, .4], [36, .62], [38, .8], [40, .45], [42.195, .2]];
  var prof = document.getElementById("profile");
  var P = { w: 0, h: 0, pad: 18 };
  var meDot, doneClip, cps = [];

  function elevAt(km) {
    for (var i = 1; i < ELEV.length; i++) {
      if (ELEV[i][0] >= km) {
        var a = ELEV[i - 1], b = ELEV[i], t = (km - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return ELEV[ELEV.length - 1][1];
  }
  function kx(km) { return P.pad + (km / TOTAL) * (P.w - P.pad * 2); }
  function ey(e) { return P.h - 8 - e * (P.h - 26); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function buildProfile() {
    P.w = prof.clientWidth; P.h = prof.clientHeight;
    prof.setAttribute("viewBox", "0 0 " + P.w + " " + P.h);
    prof.innerHTML = "";
    var pts = [];
    for (var km = 0; km <= TOTAL + 0.001; km += TOTAL / 120) pts.push(kx(km).toFixed(1) + " " + ey(elevAt(Math.min(km, TOTAL))).toFixed(1));
    var ridge = "M" + pts.join(" L");
    el("path", { class: "ground", d: ridge + " L" + kx(TOTAL) + " " + P.h + " L" + kx(0) + " " + P.h + " Z" }, prof);
    el("path", { class: "ridge", d: ridge }, prof);
    var defs = el("defs", {}, prof);
    var cp = el("clipPath", { id: "doneclip" }, defs);
    doneClip = el("rect", { x: 0, y: 0, width: 0, height: P.h }, cp);
    el("path", { class: "done", d: ridge, "clip-path": "url(#doneclip)" }, prof);
    cps = stages.map(function (s) {
      var km = parseFloat(s.dataset.km), x = kx(km), y = ey(elevAt(km));
      var g = el("g", { class: "cp" }, prof);
      el("line", { x1: x, x2: x, y1: y, y2: P.h }, g);
      el("circle", { cx: x, cy: y, r: 4.5 }, g);
      var label = lang === "en" && s.dataset.labelEn ? s.dataset.labelEn : s.dataset.label;
      var t = el("text", { x: x, y: Math.max(12, y - 9), "text-anchor": km === 0 ? "start" : km >= TOTAL ? "end" : "middle" }, g);
      t.textContent = label;
      g.style.cursor = "pointer";
      g.addEventListener("click", function () { s.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      return { g: g, km: km };
    });
    var me = el("g", { class: "me" }, prof);
    meDot = el("circle", { r: 7 }, me);
  }

  /* ---------------- scroll -> km ---------------- */
  var kmEl = document.getElementById("km");
  var anchors = [];

  function buildAnchors() {
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    anchors = stages.map(function (s, i) {
      var y = i === 0 ? 0 : i === stages.length - 1 ? maxScroll : Math.min(maxScroll, s.offsetTop);
      return [y, parseFloat(s.dataset.km)];
    });
  }

  function kmAtScroll(y) {
    if (y <= anchors[0][0]) return 0;
    for (var i = 1; i < anchors.length; i++) {
      if (y <= anchors[i][0]) {
        var a = anchors[i - 1], b = anchors[i];
        var t = b[0] === a[0] ? 1 : (y - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return TOTAL;
  }

  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY;
    var km = Math.max(0, Math.min(TOTAL, kmAtScroll(y)));
    kmEl.textContent = "KM " + (km >= TOTAL ? "42.2" : km.toFixed(1));
    var x = kx(km);
    meDot.setAttribute("cx", x);
    meDot.setAttribute("cy", ey(elevAt(km)));
    doneClip.setAttribute("width", x);
    cps.forEach(function (c) { c.g.classList.toggle("passed", km >= c.km - 0.05); });
    if (trailLen) {
      var reveal = y + innerHeight * 0.62 - main.offsetTop;
      run.style.strokeDashoffset = Math.max(0, trailLen - lenAtY(reveal));
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  function layout() {
    buildTrail();
    buildProfile();
    buildAnchors();
    update();
  }

  /* ---------------- lightbox ---------------- */
  var lb = document.getElementById("lightbox"), lbImg = lb.querySelector("img");
  document.querySelectorAll(".thumbs a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      lbImg.src = a.href; lbImg.alt = a.querySelector("img").alt;
      lb.classList.add("open");
    });
  });
  lb.addEventListener("click", function () { lb.classList.remove("open"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.classList.remove("open"); });

  /* ---------------- boot ---------------- */
  var saved = store("lang");
  var initial = saved || ((navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en");
  window.addEventListener("scroll", onScroll, { passive: true });
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  window.addEventListener("load", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  setLang(initial);
})();
