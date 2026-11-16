/* flemos — trail edition v2: a camera that follows the runner.
   Scroll drives the camera: far away -> zoom in -> side view running right ->
   switchback -> side view running left -> runner comes toward the finish. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var TOTAL = 42.195;
  var W = 1600, H = 900, GROUND = 742;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lang = "es";
  function t(es, en) { return lang === "en" ? en : es; }

  /* ---------- timeline (scroll progress 0..1) ---------- */
  var T = {
    zoomStart: 0.07, sideIn: 0.21, turnA: 0.505, turnB: 0.525, sideEnd: 0.845, approachIn: 0.86
  };
  var LEN_R = 9000, LEN_L = 9000, OFFSET_L = 60000;
  var BEATS = {
    hexacta: { p: 0.27, seg: "R" }, globallogic: { p: 0.36, seg: "R" }, hitachi: { p: 0.45, seg: "R" },
    turn: { p: 0.497, seg: "R" },
    palemosoft: { p: 0.59, seg: "L" }, casos: { p: 0.68, seg: "L" }, mochila: { p: 0.78, seg: "L" }
  };
  var KM_ANCHORS = [[0, 0], [0.27, 3], [0.36, 14], [0.45, 21], [0.59, 28], [0.68, 33], [0.78, 38], [1, TOTAL]];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function range(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function interp(arr, x) {
    if (x <= arr[0][0]) return arr[0][1];
    for (var i = 1; i < arr.length; i++) if (x <= arr[i][0]) {
      var a = arr[i - 1], b = arr[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return arr[arr.length - 1][1];
  }
  function camAt(p) {
    if (p < T.turnA + (T.turnB - T.turnA) / 2) return range(p, T.sideIn, T.turnA) * LEN_R;
    return OFFSET_L - range(p, T.turnB, T.sideEnd) * LEN_L;
  }
  function itemX(b) {
    return camAt(b.p) + W / 2 + (b.seg === "R" ? 150 : -150);
  }

  /* ---------- tiny drawing kit ---------- */
  var seed = 7;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }
  function smooth(pts, closed) {
    var n = pts.length, d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (!closed) { if (i === 0) p0 = p1; if (i + 2 >= n) p3 = p2; }
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d + (closed ? "Z" : "");
  }
  function blob(cx, cy, rx, ry, n, jit) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2, r = 1 + (rnd() - 0.5) * jit;
      pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
    return smooth(pts, true);
  }
  function path(d, cls, extra) { return '<path class="' + cls + '" d="' + d + '"' + (extra || "") + "/>"; }
  function tree(x, y, h) {
    var w = h * (0.32 + rnd() * 0.14);
    var s = path("M" + x + " " + y + " L" + x + " " + (y - h * 0.38), "k");
    if (rnd() < 0.5) {   // tall cypress-like
      var pts = [[x, y - h], [x + w * 0.45, y - h * 0.72], [x + w * 0.55, y - h * 0.42], [x + w * 0.3, y - h * 0.26], [x - w * 0.3, y - h * 0.26], [x - w * 0.55, y - h * 0.44], [x - w * 0.42, y - h * 0.74]];
      pts.forEach(function (p) { p[0] += (rnd() - 0.5) * 8; p[1] += (rnd() - 0.5) * 8; });
      s += path(smooth(pts, true), "k f-tree");
    } else {             // round lenga
      s += path(blob(x, y - h * 0.62, w * 0.75, h * 0.38, 9, 0.3), "k f-tree");
    }
    s += path("M" + (x - w * 0.12) + " " + (y - h * 0.55) + " q" + w * 0.1 + " " + h * 0.08 + " " + w * 0.12 + " " + h * 0.16, "k thin");
    return s;
  }
  function stone(x, y, r) { return path(blob(x, y, r, r * 0.55, 7, 0.35), "k f-paper"); }
  function tuft(x, y, h) {
    return path("M" + (x - 6) + " " + y + " q-2 " + (-h * 0.6) + " -10 " + (-h) + " M" + x + " " + y + " q0 " + (-h * 0.7) + " 3 " + (-h * 1.2) + " M" + (x + 6) + " " + y + " q3 " + (-h * 0.5) + " 11 " + (-h * 0.85), "k thin");
  }
  function sign(x, label, dir, y, w) {
    y = y || GROUND; w = w || Math.max(130, label.length * 17 + 40);
    var top = y - 170, bx = dir > 0 ? x - 20 : x - w + 20;
    var tip = dir > 0 ? "L" + (bx + w + 22) + " " + (top + 22) : "L" + (bx - 22) + " " + (top + 22);
    var board = dir > 0
      ? "M" + bx + " " + top + " L" + (bx + w) + " " + top + " " + tip + " L" + (bx + w) + " " + (top + 44) + " L" + bx + " " + (top + 44) + "Z"
      : "M" + (bx + w) + " " + top + " L" + bx + " " + top + " " + tip + " L" + bx + " " + (top + 44) + " L" + (bx + w) + " " + (top + 44) + "Z";
    return path("M" + x + " " + y + " L" + x + " " + (top - 10), "k") + path(board, "k f-paper") +
      '<text x="' + (bx + w / 2) + '" y="' + (top + 31) + '" text-anchor="middle" class="lbl">' + label + "</text>";
  }

  /* ---------- scene setup ---------- */
  var svg = document.getElementById("scene");
  var g = {}; ["far", "farCam", "farRunner", "side", "sFar", "sPeak", "sMid", "sGround", "sItems", "sRunner", "sFore", "approach", "aWorld", "aRunner", "aArch"].forEach(function (id) { g[id] = document.getElementById(id); });

  function buildFar() {
    seed = 11;
    var s = "";
    s += '<circle class="k f-paper" cx="1260" cy="170" r="58"/>';
    s += path(blob(380, 150, 90, 26, 8, 0.25), "k f-paper") + path(blob(1020, 110, 70, 20, 8, 0.25), "k f-paper");
    var back = [[-60, 520], [120, 420], [260, 300], [360, 340], [470, 230], [600, 300], [720, 250], [860, 150], [1000, 260], [1120, 210], [1260, 330], [1400, 290], [1660, 430]];
    s += path(smooth(back, false) + " L1660 900 L-60 900Z", "k f-far");
    s += path("M440 262 q14 10 26 -2 q12 12 26 -4 M832 180 q14 10 26 0 q14 12 30 -6 M1094 232 q10 8 22 -2 q10 8 20 0", "k thin");
    var mid = [[-60, 720], [200, 650], [420, 540], [620, 440], [760, 400], [900, 430], [1080, 520], [1300, 620], [1660, 660]];
    s += path(smooth(mid, false) + " L1660 900 L-60 900Z", "k f-mid");
    s += '<path id="farTrail" class="trail-edge" d="M240 900 C420 870 720 860 780 815 C830 775 520 770 560 730 C600 696 860 708 885 668 C905 628 640 618 690 578 C730 548 900 566 902 526 C904 486 760 488 790 452"/>';
    s += '<use href="#farTrail" class="trail-fill"/>';
    for (var i = 0; i < 14; i++) { var x = 40 + rnd() * 1520, y = 760 + rnd() * 120; if (x > 200 && x < 1000 && y < 860) continue; s += tree(x, y, 70 + rnd() * 70); }
    s += path(smooth([[-60, 860], [300, 845], [700, 880], [1100, 850], [1660, 870]], false) + " L1660 900 L-60 900Z", "k f-paper");
    g.farCam.innerHTML = s;
  }

  var tiles = {};
  function buildSide() {
    // far ridge tile (parallax 0.08)
    seed = 21;
    var ridge = [[0, 520], [180, 400], [330, 450], [520, 300], [700, 420], [900, 330], [1080, 450], [1260, 360], [1430, 430], [1600, 520]];
    var far = path(smooth(ridge, false) + " L1600 " + GROUND + " L0 " + GROUND + "Z", "k f-far") +
      path("M495 322 q14 10 26 -2 q12 12 28 -4 M878 352 q12 8 22 -2 q12 10 24 -2 M1240 380 q10 8 20 0 q10 8 22 -2", "k thin");
    tiles.far = { w: 1600, html: far };
    // mid hills + trees (parallax 0.35)
    var hills = [[0, 640], [300, 590], [600, 620], [900, 570], [1200, 615], [1500, 585], [1800, 630], [2100, 590], [2400, 640]];
    var mid = path(smooth(hills, false) + " L2400 " + GROUND + " L0 " + GROUND + "Z", "k f-mid");
    for (var i = 0; i < 16; i++) { var x = 60 + i * 150 + rnd() * 60; mid += tree(x, 640 + rnd() * 70, 90 + rnd() * 110); }
    tiles.mid = { w: 2400, html: mid };
    // ground details (parallax 1)
    var gr = "";
    for (var j = 0; j < 22; j++) {
      var gx = rnd() * 1600, gy = GROUND + 30 + rnd() * 120;
      gr += rnd() < 0.45 ? stone(gx, gy, 8 + rnd() * 16) : tuft(gx, gy, 10 + rnd() * 14);
    }
    for (var k = 0; k < 7; k++) gr += tuft(rnd() * 1600, GROUND, 14 + rnd() * 10);
    tiles.ground = { w: 1600, html: gr };
    // foreground (parallax 1.7)
    var fo = "";
    fo += path(blob(300, 905, 150, 70, 10, 0.35), "k f-tree") + tuft(560, 900, 40) + path(blob(1150, 915, 120, 60, 9, 0.3), "k f-tree");
    tiles.fore = { w: 3200, html: fo };
    var peak = smooth([[-520, GROUND - 120], [-320, 520], [-160, 380], [-40, 250], [0, 232], [60, 262], [200, 400], [360, 520], [560, GROUND - 120]], false);
    g.sPeak.innerHTML = path(peak + " L560 " + GROUND + " L-520 " + GROUND + "Z", "k f-far") +
      path("M-60 278 q16 12 30 -2 q14 12 30 -4 q12 10 26 0", "k thin") +
      path("M0 232 L0 170", "k") + path("M0 170 L54 182 L0 196 Z", "k f-red") +
      '<text x="62" y="190" class="lbl">21K</text>';
    ["far", "mid", "ground", "fore"].forEach(function (k) {
      var el = { far: g.sFar, mid: g.sMid, ground: g.sGround, fore: g.sFore }[k];
      el.innerHTML = '<g class="tile">' + tiles[k].html + '</g><g class="tile">' + tiles[k].html + '</g><g class="tile">' + tiles[k].html + "</g>";
    });
  }

  function buildItems() {
    var s = "";
    var x = itemX(BEATS.hexacta);
    s += '<g data-x="' + x + '">' + sign(0, "HEXACTA", 1) + '<text x="0" y="' + (GROUND - 186) + '" class="lbl sm" text-anchor="middle">KM 3</text>' + tree(-260, GROUND, 150) + tree(240, GROUND + 4, 120) + "</g>";
    x = itemX(BEATS.globallogic);
    var river = path("M-360 " + GROUND + " C-320 " + (GROUND + 60) + " -260 " + (GROUND + 110) + " -230 " + (H + 10) + " L500 " + (H + 10) + " C450 " + (GROUND + 110) + " 400 " + (GROUND + 60) + " 360 " + GROUND + "Z", "k f-river") + path("M-358 " + GROUND + " L358 " + GROUND, "f-none", ' stroke="#9cc6ec" stroke-width="6"') +
      path("M-300 " + (GROUND + 40) + " q60 -12 120 0 t120 0 t120 0 t120 0 M-250 " + (GROUND + 90) + " q60 -12 120 0 t120 0 t120 0 M-320 " + (GROUND + 140) + " q60 -12 120 0 t120 0 t120 0 t120 0", "k thin st-blue") +
      stone(-90, GROUND + 6, 26) + stone(40, GROUND + 4, 30) + stone(170, GROUND + 6, 24);
    s += '<g data-x="' + x + '">' + river + '<g class="crossed">' + sign(-430, "HEXACTA", 1) + path("M-460 " + (GROUND - 168) + " L-300 " + (GROUND - 128), "k st-red") + "</g>" + sign(440, "GLOBALLOGIC", 1) + "</g>";
    x = itemX(BEATS.hitachi);
    s += '<g data-x="' + x + '">' + sign(0, "HITACHI DIGITAL", 1) + '<text x="0" y="' + (GROUND - 186) + '" class="lbl sm" text-anchor="middle">KM 21</text>' + tree(320, GROUND, 170) + "</g>";
    x = itemX(BEATS.turn);
    s += '<g data-x="' + x + '">' + path("M0 " + GROUND + " L0 " + (GROUND - 150), "k") + path(blob(0, GROUND - 190, 46, 46, 8, 0.08), "k f-paper") +
      path("M18 " + (GROUND - 176) + " C18 " + (GROUND - 214) + " -22 " + (GROUND - 214) + " -22 " + (GROUND - 186) + " L-22 " + (GROUND - 168) + " M-34 " + (GROUND - 180) + " L-22 " + (GROUND - 166) + " L-10 " + (GROUND - 180), "k") + "</g>";
    x = itemX(BEATS.palemosoft);
    s += '<g data-x="' + x + '">' + path("M0 " + GROUND + " L0 " + (GROUND - 230), "k") +
      sign(0, "HITACHI", 1, GROUND - 60) + sign(0, "PALEMOSOFT", -1) + tree(-360, GROUND, 140) + tree(280, GROUND, 110) +
      '<text x="-150" y="' + (GROUND - 104) + '" class="lbl sm" text-anchor="middle">' + t("after hours", "after hours") + "</text></g>";
    x = itemX(BEATS.casos);
    s += '<g data-x="' + x + '">' +
      path("M-200 " + GROUND + " L-200 " + (GROUND - 250) + " M200 " + GROUND + " L200 " + (GROUND - 250), "k") +
      path("M-230 " + (GROUND - 290) + " L230 " + (GROUND - 290) + " L230 " + (GROUND - 240) + " L-230 " + (GROUND - 240) + "Z", "k f-paper") +
      '<text x="0" y="' + (GROUND - 256) + '" class="lbl" text-anchor="middle">' + t("PUESTO DE HIDRATACIÓN", "AID STATION") + "</text>" +
      path("M-170 " + (GROUND - 96) + " L170 " + (GROUND - 96) + " L170 " + (GROUND - 80) + " L-170 " + (GROUND - 80) + "Z", "k f-paper") +
      path("M-150 " + (GROUND - 80) + " L-150 " + GROUND + " M150 " + (GROUND - 80) + " L150 " + GROUND, "k") +
      [-130, -90, -50, -10].map(function (cx) { return path("M" + cx + " " + (GROUND - 96) + " L" + (cx + 4) + " " + (GROUND - 124) + " L" + (cx + 22) + " " + (GROUND - 124) + " L" + (cx + 26) + " " + (GROUND - 96), "k f-paper"); }).join("") +
      path("M50 " + (GROUND - 96) + " L50 " + (GROUND - 160) + " C50 " + (GROUND - 176) + " 100 " + (GROUND - 176) + " 100 " + (GROUND - 160) + " L100 " + (GROUND - 96) + "Z", "k f-paper") +
      path("M60 " + (GROUND - 136) + " L90 " + (GROUND - 136), "k st-blue") +
      path("M-200 " + (GROUND - 290) + " L-200 " + (GROUND - 340), "k") + path("M-200 " + (GROUND - 340) + " L-150 " + (GROUND - 326) + " L-200 " + (GROUND - 312) + "Z", "k f-red") + "</g>";
    x = itemX(BEATS.mochila);
    var wall = "";
    for (var r = 0; r < 3; r++) for (var c = 0; c < 5; c++) wall += path(blob(-120 + c * 60 + (r % 2) * 30, GROUND - 22 - r * 40, 30, 18, 7, 0.15), "k f-paper");
    s += '<g data-x="' + x + '">' + wall + sign(220, t("EL MURO", "THE WALL"), -1) + '<text x="160" y="' + (GROUND - 186) + '" class="lbl sm" text-anchor="middle">KM 38</text>' + tree(-380, GROUND, 160) + "</g>";
    g.sItems.innerHTML = s;
    itemsEls = [].slice.call(g.sItems.children);
  }
  var itemsEls = [];

  function buildApproach() {
    seed = 33;
    var s = "";
    var back = [[-60, 470], [140, 390], [300, 300], [460, 380], [620, 260], [800, 330], [980, 230], [1160, 350], [1340, 290], [1660, 420]];
    s += '<circle class="k f-paper" cx="300" cy="150" r="50"/>';
    s += path(smooth(back, false) + " L1660 900 L-60 900Z", "k f-far");
    s += path(smooth([[-60, 600], [300, 560], [700, 580], [1000, 555], [1300, 575], [1660, 560]], false) + " L1660 900 L-60 900Z", "k f-mid");
    s += path("M790 572 C760 640 600 760 420 900 L1180 900 C1000 760 840 640 812 572 Z", "k f-paper");
    s += path("M800 600 L800 620 M796 660 L794 690 M790 740 L786 790 M780 840 L776 890", "k thin dash");
    for (var i = 0; i < 12; i++) {
      var side = i % 2 ? 1 : -1, d = rnd();
      var x = 800 + side * (140 + d * 640), y = 600 + d * 260;
      s += tree(x, y, 50 + d * 200);
    }
    g.aWorld.innerHTML = s;
    var a = "";
    a += path("M250 900 L250 210 M1350 900 L1350 210", "k thick");
    a += path("M200 150 L1400 150 L1400 250 L200 250 Z", "k f-paper thick");
    a += '<text x="800" y="222" text-anchor="middle" class="lbl xl">' + t("META", "FINISH") + " · 42.195K</text>";
    for (var f = 0; f < 14; f++) { var fx = 290 + f * 76; a += path("M" + fx + " 262 L" + (fx + 30) + " 262 L" + (fx + 15) + " 296Z", "k " + (f % 2 ? "f-blue" : "f-red")); }
    a += path("M260 262 Q800 280 1340 262", "k thin");
    g.aArch.innerHTML = a;
  }

  /* ---------- side runner rig ---------- */
  var R = {};
  function limb(id, len, w) {
    return '<g id="' + id + '"><line class="limb-o" x1="0" y1="0" x2="0" y2="' + len + '" stroke-width="' + (w + 7) + '"/><line class="limb-i" x1="0" y1="0" x2="0" y2="' + len + '" stroke-width="' + w + '"/>';
  }
  function buildSideRunner() {
    var leg = function (id, back) {
      return limb(id, 64, 12) + '<path class="k f-ink" d="M-11 -4 L13 -4 L15 30 L-13 32 Z"/>' + (back ? "" : '<g class="bib"><rect x="-12" y="8" width="26" height="18" rx="2" class="k thin f-paper"/><text x="1" y="21" text-anchor="middle" class="bibtxt">2185</text></g>') +
        '<g id="' + id + 'K" transform="translate(0,64)">' + limb(id + "S", 60, 11) + "</g>" +
        '<line x1="0" y1="44" x2="0" y2="54" stroke="#141414" stroke-width="16" stroke-linecap="butt"/>' +
        '<path class="k f-paper" d="M-8 54 C-8 62 -9 70 -10 72 L24 72 C30 72 30 62 22 60 L6 54 Z"/><path class="k f-ink" d="M-11 70 L27 70 L27 75 L-11 75Z"/></g></g>';
    };
    var arm = function (id) {
      return limb(id, 44, 10) + '<g id="' + id + 'E" transform="translate(0,44)">' + limb(id + "F", 40, 9) + '<circle cx="0" cy="44" r="8" class="k f-paper"/></g></g></g>';
    };
    var s = "";
    s += '<g id="rBob">';
    s += '<g class="farside" transform="translate(-2,0)">' + leg("lgF", true) + "</g>";
    s += '<g transform="translate(14,-76)" class="farside">' + arm("amF") + "</g>";
    // torso + head
    s += '<path class="k f-ink" d="M-16 8 C-20 -30 -14 -62 -2 -86 L28 -82 C32 -52 26 -20 18 8 Z"/>';
    s += '<path class="k thin st-red" d="M-12 -40 C0 -36 14 -46 26 -40 M-14 -20 C2 -14 12 -26 22 -18"/>';
    s += '<path class="vest" d="M0 -84 L-6 -36 M24 -82 L20 -36"/>';
    s += '<g id="rHead">' + limb("neck", 14, 12) + "</g>";
    s += '<circle cx="20" cy="-112" r="22" class="k f-paper"/>';
    s += '<path class="k f-ink" d="M14 -96 C20 -88 34 -88 40 -98 C38 -100 30 -97 22 -97 C18 -97 16 -97 14 -96Z"/>';
    s += '<path class="k f-ink" d="M30 -103 C34 -105 38 -105 41 -102"/>';
    s += '<circle cx="34" cy="-116" r="2.6" class="f-ink"/>';
    s += '<circle cx="12" cy="-111" r="5" class="k f-paper"/>';
    s += '<path class="k f-blue" d="M-2 -116 C-4 -142 42 -146 42 -120 Z"/><path class="k f-blue" d="M40 -122 L62 -118 C58 -112 48 -112 40 -114 Z"/>';
    s += '<circle cx="20" cy="-136" r="4" class="k thin f-paper"/>';
    s += '<g transform="translate(0,0)">' + leg("lgN", false) + "</g>";
    s += '<g transform="translate(10,-76)">' + arm("amN") + "</g>";
    s += "</g>";
    g.sRunner.innerHTML = '<g id="rFlip"><g transform="scale(1.25)">' + s + "</g></g>";
    // neck sits under the head: move it
    document.getElementById("neck").setAttribute("transform", "translate(12,-84) rotate(-160)");
    ["lgF", "lgFK", "lgN", "lgNK", "amF", "amFE", "amN", "amNE", "rBob", "rFlip"].forEach(function (id) { R[id] = document.getElementById(id); });
  }
  function poseSide(ph) {
    var f = Math.PI * 2 * ph;
    function legPose(id, phi) {
      var thigh = -30 * Math.sin(phi) - 4;
      var knee = 8 + 72 * Math.max(0, -Math.sin(phi - 0.6));
      R[id].setAttribute("transform", "rotate(" + thigh.toFixed(1) + ")");
      R[id + "K"].setAttribute("transform", "translate(0,64) rotate(" + knee.toFixed(1) + ")");
    }
    function armPose(id, phi) {
      var up = 34 * Math.sin(phi) + 4;
      var fore = -78 - 16 * Math.sin(phi);
      R[id].setAttribute("transform", "rotate(" + up.toFixed(1) + ")");
      R[id + "E"].setAttribute("transform", "translate(0,44) rotate(" + fore.toFixed(1) + ")");
    }
    legPose("lgN", f); legPose("lgF", f + Math.PI);
    armPose("amN", f); armPose("amF", f + Math.PI);
    R.rBob.setAttribute("transform", "translate(0," + (-7 * Math.abs(Math.sin(f))).toFixed(1) + ")");
  }

  /* ---------- front runner (drawn per frame) ---------- */
  function drawFront(ph, front) {
    var f = Math.PI * 2 * ph, s = "";
    var uL = Math.max(0, Math.sin(f)), uR = Math.max(0, -Math.sin(f));
    function leg(hx, u) {
      var kx = hx * 1.15, ky = 62 - 14 * u, fx = hx * 1.05, fy = 126 - 50 * u;
      var d = "M" + hx + " 4 L" + kx + " " + ky + " L" + fx + " " + fy;
      var sc = 1 + 0.25 * u;
      return '<path class="limb-o" d="' + d + '" stroke-width="20"/><path class="limb-i" d="' + d + '" stroke-width="13"/>' +
        '<path d="M' + fx + " " + (fy - 14) + " L" + fx + " " + (fy - 4) + '" stroke="#141414" stroke-width="20"/>' +
        '<ellipse cx="' + fx + '" cy="' + (fy + 4) + '" rx="' + 13 * sc + '" ry="' + 9 * sc + '" class="k f-paper"/><path class="k f-ink" d="M' + (fx - 13 * sc) + " " + (fy + 8) + " L" + (fx + 13 * sc) + " " + (fy + 8) + '"/>';
    }
    function arm(sx, v) {
      var ex = sx * 1.28, ey = -40 - 6 * v, hx = sx * (1.05 - 0.45 * Math.max(0, v)), hy = -18 - 30 * Math.max(0, v);
      var d = "M" + sx + " -74 L" + ex + " " + ey + " L" + hx + " " + hy;
      return '<path class="limb-o" d="' + d + '" stroke-width="18"/><path class="limb-i" d="' + d + '" stroke-width="11"/><circle cx="' + hx + '" cy="' + hy + '" r="8" class="k f-paper"/>';
    }
    // lifted leg is drawn last (closer to camera)
    s += uL > uR ? leg(14, uR) : leg(-14, uL);
    s += uL > uR ? leg(-14, uL) : leg(14, uR);
    s += '<path class="k f-ink" d="M-30 -2 L30 -2 L32 34 L4 36 L0 26 L-4 36 L-32 34 Z"/>';
    s += '<rect x="-30" y="10" width="26" height="18" rx="2" class="k thin f-paper"/><text x="-17" y="23" text-anchor="middle" class="bibtxt">2185</text>';
    var vL = -Math.sin(f), vR = Math.sin(f);
    s += vL < 0 ? arm(-30, vL) : ""; s += vR < 0 ? arm(30, vR) : "";
    s += '<path class="k f-ink" d="M-30 2 C-32 -30 -36 -60 -32 -80 L32 -80 C36 -60 32 -30 30 2 Z"/>';
    s += '<path class="vest" d="M-18 -80 L-14 -30 M18 -80 L14 -30"/><path class="k thin st-red" d="M-26 -46 C-10 -40 10 -52 26 -46 M-24 -24 C-6 -18 8 -30 24 -22"/>';
    s += '<path class="limb-o" d="M0 -78 L0 -90" stroke-width="20"/><path class="limb-i" d="M0 -78 L0 -90" stroke-width="13"/>';
    s += '<circle cx="-20" cy="-108" r="5" class="k f-paper"/><circle cx="20" cy="-108" r="5" class="k f-paper"/>';
    s += '<ellipse cx="0" cy="-108" rx="19" ry="22" class="k f-paper"/>';
    s += '<path class="k f-ink" d="M-16 -100 C-14 -84 14 -84 16 -100 C10 -96 -10 -96 -16 -100Z"/><path class="k f-ink" d="M-8 -98 C-4 -101 4 -101 8 -98"/>';
    s += '<circle cx="-7" cy="-111" r="2.4" class="f-ink"/><circle cx="7" cy="-111" r="2.4" class="f-ink"/>';
    s += '<path class="k f-blue" d="M-20 -116 C-22 -142 22 -142 20 -116 Z"/><path class="k f-blue" d="M-22 -117 C-10 -110 10 -110 22 -117 C18 -122 -18 -122 -22 -117Z"/>';
    s += vL >= 0 ? arm(-30, vL) : ""; s += vR >= 0 ? arm(30, vR) : "";
    front.innerHTML = '<g transform="translate(0,' + (-5 * Math.abs(Math.sin(f))).toFixed(1) + ')">' + s + "</g>";
  }

  /* ---------- far trail runner position ---------- */
  var farTrail;
  function farPoint(k) { var L = farTrail.getTotalLength(); return farTrail.getPointAtLength(L * k); }

  /* ---------- beats (text cards) ---------- */
  var beats = [].slice.call(document.querySelectorAll(".beat"));
  function beatAlpha(el, p) {
    var a = parseFloat(el.dataset.from), b = parseFloat(el.dataset.to), f = 0.025;
    if (p < a - f || p > b + f) return 0;
    if (p < a) return (p - (a - f)) / f;
    if (p > b) return b >= 0.999 ? 1 : 1 - (p - b) / f;
    return 1;
  }

  /* ---------- profile bar ---------- */
  var ELEV = [[0, .15], [3, .32], [7, .55], [10, .4], [14, .18], [17, .5], [21, .92], [25, .6], [28, .72], [31, .45], [33, .4], [36, .62], [38, .8], [40, .45], [42.195, .2]];
  var prof = document.getElementById("profile"), P = { w: 0, h: 0, pad: 18 }, meDot, doneClip, cps = [];
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function kx(km) { return P.pad + (km / TOTAL) * (P.w - P.pad * 2); }
  function ey(e) { return P.h - 8 - e * (P.h - 26); }
  var CHECKPOINTS = [
    { km: 0, p: 0, es: "LARGADA", en: "START" }, { km: 3, p: 0.27, es: "Hexacta", en: "Hexacta" }, { km: 14, p: 0.36, es: "GlobalLogic", en: "GlobalLogic" },
    { km: 21, p: 0.45, es: "Hitachi", en: "Hitachi" }, { km: 28, p: 0.59, es: "Palemosoft", en: "Palemosoft" }, { km: 33, p: 0.68, es: "Casos", en: "Cases" },
    { km: 38, p: 0.78, es: "Mochila", en: "Pack" }, { km: TOTAL, p: 1, es: "META", en: "FINISH" }
  ];
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
  function progress() {
    var r = race.getBoundingClientRect(), total = race.offsetHeight - innerHeight;
    return clamp(-r.top / total, 0, 1);
  }
  function scrollToP(p) {
    var y = race.offsetTop + p * (race.offsetHeight - innerHeight);
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }
  window.flemosGo = scrollToP;

  var kmEl = document.getElementById("km");
  var phase = 0, lastY = window.scrollY, lastT = performance.now();

  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var y = window.scrollY, dy = Math.abs(y - lastY); lastY = y;
    phase = (phase + dy * 0.0016 + (reduce ? 0 : dt * 0.55)) % 1;
    var p = progress();
    render(p);
    requestAnimationFrame(frame);
  }

  function render(p) {
    // scene visibility
    var farA = 1 - range(p, T.sideIn - 0.02, T.sideIn);
    var dip = p > T.turnA - 0.01 && p < T.turnB + 0.01 ? Math.abs((p - (T.turnA + T.turnB) / 2) / ((T.turnB - T.turnA) / 2 + 0.01)) : 1;
    var sideA = range(p, T.sideIn - 0.02, T.sideIn) * (1 - range(p, T.sideEnd, T.approachIn)) * clamp(dip, 0, 1);
    var appA = range(p, T.sideEnd, T.approachIn);
    g.far.style.opacity = farA; g.far.style.display = farA > 0 ? "" : "none";
    g.side.style.opacity = sideA; g.side.style.display = sideA > 0 ? "" : "none";
    g.approach.style.opacity = appA; g.approach.style.display = appA > 0 ? "" : "none";
    document.getElementById("switchback").style.opacity = clamp(1 - dip, 0, 1) * (p > T.sideIn ? 1 : 0);

    // far: camera zooms toward the tiny runner on the switchbacks
    if (farA > 0) {
      var kRun = lerp(0.42, 0.62, range(p, 0, T.sideIn));
      var pt = farPoint(kRun), pt2 = farPoint(Math.min(1, kRun + 0.003));
      var z = ease(range(p, T.zoomStart, T.sideIn));
      var k = lerp(1, 7, z * z);
      var cx = lerp(W / 2, pt.x, z), cy = lerp(H / 2, pt.y - 10, z);
      g.farCam.parentNode.setAttribute("transform", "translate(" + W / 2 + "," + H / 2 + ") scale(" + k + ") translate(" + (-cx) + "," + (-cy) + ")");
      var dir = pt2.x >= pt.x ? 1 : -1;
      g.farRunner.setAttribute("transform", "translate(" + pt.x.toFixed(1) + "," + pt.y.toFixed(1) + ") scale(" + (0.11 * dir) + ",0.11) translate(0,-132)");
      drawFront(phase, g.farRunner);
    }

    // side: parallax world
    if (sideA > 0) {
      var cam = camAt(p);
      var facing = p < (T.turnA + T.turnB) / 2 ? 1 : -1;
      setTile(g.sFar, cam * 0.08, tiles.far.w);
      setTile(g.sMid, cam * 0.35, tiles.mid.w);
      setTile(g.sGround, cam, tiles.ground.w);
      setTile(g.sFore, cam * 1.7, tiles.fore.w);
      g.sPeak.setAttribute("transform", "translate(" + (W / 2 + 260 - (cam - camAt(BEATS.hitachi.p)) * 0.2 + (cam > OFFSET_L / 2 ? 99999 : 0)).toFixed(1) + ",0)");
      itemsEls.forEach(function (it) {
        var x = parseFloat(it.dataset.x) - cam;
        it.style.display = x > -900 && x < W + 900 ? "" : "none";
        it.setAttribute("transform", "translate(" + x.toFixed(1) + ",0)");
      });
      R.rFlip.setAttribute("transform", "translate(" + W / 2 + "," + (GROUND - 160) + ") scale(" + facing + ",1)");
      poseSide(phase);
    }

    // approach: runner comes toward the camera, through the finish arch
    if (appA > 0) {
      var a = ease(range(p, T.approachIn - 0.01, 0.985));
      var feet = lerp(590, 860, a), sc = lerp(0.12, 1.5, a * a);
      var wob = Math.sin(a * Math.PI * 3) * 40 * (1 - a) - (wideScreen() ? 330 : 0) * ease(range(p, 0.93, 0.985));
      g.aRunner.setAttribute("transform", "translate(" + (800 + wob).toFixed(1) + "," + feet.toFixed(1) + ") scale(" + sc.toFixed(3) + ") translate(0,-132)");
      var dz = lerp(1, 1.18, a);
      g.aWorld.setAttribute("transform", "translate(800,600) scale(" + dz + ") translate(-800,-600)");
      g.aArch.setAttribute("transform", "translate(800,900) scale(" + lerp(0.92, 1.12, a) + ") translate(-800,-900)");
      drawFront(phase, g.aRunner);
    }

    // cards
    beats.forEach(function (b) {
      var al = beatAlpha(b, p);
      b.style.opacity = al;
      b.style.transform = "translateY(" + ((1 - al) * 18).toFixed(1) + "px)";
      b.style.visibility = al > 0.01 ? "visible" : "hidden";
      b.classList.toggle("live", al > 0.5);
    });

    // km + profile
    var km = clamp(interp(KM_ANCHORS, p), 0, TOTAL);
    kmEl.textContent = "KM " + (km >= TOTAL - 0.01 ? "42.2" : km.toFixed(1));
    if (meDot) {
      var x = kx(km);
      meDot.setAttribute("cx", x); meDot.setAttribute("cy", ey(interp(ELEV, km)));
      doneClip.setAttribute("width", x);
      cps.forEach(function (c) { c.g.classList.toggle("passed", km >= c.km - 0.05); });
    }
  }
  function wideScreen() { return innerWidth > 760; }
  function setTile(layer, offset, w) {
    var o = ((offset % w) + w) % w;
    var kids = layer.children;
    for (var i = 0; i < kids.length; i++) kids[i].setAttribute("transform", "translate(" + (-o + (i - 1) * w).toFixed(1) + ",0)");
  }

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
    buildItems(); buildApproach(); buildProfile(); render(progress());
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang); }); });

  /* ---------- cases dialog ---------- */
  var dlg = document.getElementById("caseDlg");
  document.querySelectorAll("[data-case]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var src = document.getElementById("case-" + btn.dataset.case);
      dlg.querySelector(".dlg-body").innerHTML = src.innerHTML;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest(".dlg-close")) dlg.close(); });

  document.querySelectorAll("[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); scrollToP(parseFloat(a.dataset.go)); });
  });

  /* ---------- boot ---------- */
  buildFar(); buildSide(); buildSideRunner();
  farTrail = document.getElementById("farTrail");
  var saved = store("lang");
  setLang(saved || ((navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en"));
  window.addEventListener("resize", function () { buildProfile(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildProfile);
  requestAnimationFrame(frame);
})();
