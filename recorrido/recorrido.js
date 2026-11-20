/* flemos · recorrido
   A line-drawn trail race rendered on a canvas and driven by scroll.
   The world is a strip of terrain that repeats every P units, seen through a
   perspective camera. The runner starts tiny up on the mountain, comes down the
   switchbacks, runs the timeline small along the bottom, passes close in profile,
   takes the final stretch and crosses the finish. Then the camera climbs back to
   the next mountain, which is the same frame as the start, and the page wraps. */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var P = 400;          // world period (x)
  var ZT = 20;          // depth of the main trail
  var Z0 = 170;         // depth of the start, up on the mountain
  var XD = 40;          // x where the descent reaches the trail
  var XF = P - 60;      // finish line
  var S_DESC = 0.12, S_FIN = 0.9;
  var BG = "#e7e7e5", INK = "#0a0a0a";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cv = document.getElementById("world");
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function wrapDist(x) { var m = ((x % P) + P) % P; return Math.min(m, P - m); }
  function grey(t) { // 0 = ink, 1 = very light
    var v = Math.round(lerp(10, 178, t));
    return "rgb(" + v + "," + v + "," + (v - 2 < 0 ? 0 : v - 2) + ")";
  }
  var w = TAU / P;

  /* ---------------- terrain ---------------- */
  function trailH(x) { return 0.55 * Math.sin(w * 9 * x + 0.5) + 0.3 * Math.sin(w * 23 * x + 1.7); }
  function height(x, z) {
    var d = z - ZT;
    var h = trailH(x);
    if (d < 0) return h + 0.25 * Math.sin(w * 37 * x - d * 1.3) - d * 0.05;
    var hill = sstep(1.5, 45, d);
    h += hill * (3.2 + 2.6 * Math.sin(w * 11 * x + d * 0.11) + 1.8 * Math.sin(w * 5 * x + d * 0.05 + 1));
    var mt = sstep(30, 240, d);
    var r = 1 - Math.abs(Math.sin(w * 6 * x + d * 0.012 + 0.3));
    h += mt * (16 + 12 * Math.sin(w * 3 * x + d * 0.008) + 20 * r * r + 5 * Math.sin(w * 13 * x + d * 0.02));
    var xd = wrapDist(x), dz = z - 215;
    h += 46 * Math.exp(-(xd * xd) / 2025 - (dz * dz) / 5625);
    return h;
  }

  /* ---------------- the route ---------------- */
  function pathXZ(s) {
    var lap = Math.floor(s), t, x, z;
    s -= lap;
    if (s < S_DESC) {
      t = s / S_DESC;
      x = XD * t + 9 * Math.sin(t * TAU * 2.5) * (1 - t);
      z = ZT + (Z0 - ZT) * Math.pow(1 - t, 1.6);
    } else if (s < S_FIN) {
      t = (s - S_DESC) / (S_FIN - S_DESC);
      x = XD + (XF + 6 - XD) * t;
      z = ZT;
    } else {
      t = (s - S_FIN) / (1 - S_FIN);
      x = XF + 6 + (P - XF - 6) * t - 9 * Math.sin(t * TAU * 2.5) * t;
      z = ZT + (Z0 - ZT) * Math.pow(t, 1.6);
    }
    return [x + lap * P, z];
  }
  function sAtX(x) { return S_DESC + (x - XD) / (XF + 6 - XD) * (S_FIN - S_DESC); }

  /* ---------------- story keyframes (anchored to sections) ---------------- */
  // s: where the camera looks along the route · r: where the runner is (defaults to s)
  // u, v: runner position on screen (0..1) · hr: runner height as a fraction of the screen
  var KEYS = [
    { id: "inicio", at: 0, s: 0, u: 0.64, v: 0.33, hr: 0.016 },
    { id: "ficha", at: 0.55, s: 0.06, u: 0.6, v: 0.6, hr: 0.04 },
    { id: "hexacta", at: 0.1, s: 0.12, u: 0.3, v: 0.83, hr: 0.085 },
    { id: "palemosoft", at: 1, s: 0.44, u: 0.36, v: 0.83, hr: 0.085 },
    { id: "enfoque", at: 0.22, s: 0.48, u: 0.74, v: 0.57, hr: 0.5 },
    { id: "enfoque", at: 0.8, s: 0.53, u: 0.72, v: 0.57, hr: 0.52 },
    { id: "porque", at: 0.06, s: 0.565, u: 0.5, v: 0.9, hr: 0.075 },
    { id: "casos", at: 1, s: 0.8, u: 0.5, v: 0.9, hr: 0.075 },
    { id: "recta", at: 0.35, s: 0.845, u: 0.3, v: 0.78, hr: 0.13 },
    { id: "contacto", at: 0.02, s: sAtX(XF), u: 0.7, v: 0.66, hr: 0.3 },
    { id: "contacto", at: 0.5, s: 0.9, u: 0.72, v: 0.7, hr: 0.24 },
    { id: "vuelta", at: 0.35, s: 0.93, r: 0.9, u: 0.5, v: 0.55, hr: 0.06 },
    { id: "loop", at: 0, s: 1, r: 0.9, u: 0.64, v: 0.33, hr: 0.016 }
  ];
  var CH = ["s", "r", "u", "v", "lh"];
  var curves = null, loopTop = 1, pos = [];

  // monotone cubic interpolation (Fritsch–Carlson): smooth, no overshoot
  function buildCurve(xs, ys) {
    var n = xs.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var k = 1; while (xs[k] < x) k++;
      var h = xs[k] - xs[k - 1], t = (x - xs[k - 1]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k - 1] + (t3 - 2 * t2 + t) * h * m[k - 1] + (-2 * t3 + 3 * t2) * ys[k] + (t3 - t2) * h * m[k];
    };
  }

  function layout() {
    pos = KEYS.map(function (k) {
      var el = document.getElementById(k.id);
      return el.offsetTop + k.at * el.offsetHeight;
    });
    loopTop = document.getElementById("loop").offsetTop;
    var portrait = W / H < 0.85;
    curves = {};
    CH.forEach(function (c) {
      curves[c] = buildCurve(pos, KEYS.map(function (k) {
        if (c === "r") return k.r != null ? k.r : k.s;
        if (c === "lh") return Math.log(k.hr * (portrait ? (k.hr > 0.2 ? 0.6 : 0.85) : 1));
        if (c === "u" && portrait) return 0.5 + (k.u - 0.5) * 0.35;
        if (c === "v" && portrait && k.hr > 0.2) return Math.max(k.v, 0.8);
        return k[c];
      }));
    });
    buildTrack();
  }

  /* ---------------- camera ---------------- */
  var cam = { x: 0, h: 0, z: 0 }, F = 1;
  function setCamera(st) {
    F = 1.25 * H;
    var fx = pathXZ(st.s), rx = fx[0], rz = fx[1], ry = height(rx, rz);
    var k = Math.exp(st.lh) * H / 1.8;
    cam.z = rz - F / k;
    cam.x = rx - (st.u - 0.5) * W / k;
    cam.h = ry + 0.9 + (st.v - 0.5) * H / k;
    // never let the camera sink into a hill in front of it
    var g = Math.max(height(cam.x, cam.z + 2), height(cam.x, cam.z + 6), height(cam.x, cam.z + 12)) + 2.2;
    if (cam.h < g) cam.h = g;
  }
  function kAt(z) { return F / (z - cam.z); }
  function sx(x, z) { return W / 2 + (x - cam.x) * kAt(z); }
  function sy(y, z) { return H / 2 - (y - cam.h) * kAt(z); }

  /* ---------------- slices ---------------- */
  var OFFS = [-3.2, -1.5, 0, 1.6, 4, 7, 9, 14, 20, 28, 38, 51, 67, 87, 112, 142, 178, 220, 268, 325, 390, 470];
  var SLICES = OFFS.map(function (o, i) { return { z: ZT + o, d: o, i: i }; });

  function depthTone(z) { return sstep(6, 420, z - cam.z) * 0.92; }

  function drawSlice(sl) {
    var z = sl.z, k = kAt(z), step = sl.d > 60 ? 7 : 4;
    var near = z - cam.z;
    if (near < 1.2) return;
    ctx.globalAlpha = sstep(1.2, 3.5, near);
    var tone = depthTone(z);
    var pts = [], x0 = -12, x1 = W + 12, px;
    for (px = x0; px <= x1 + step; px += step) {
      var wx = cam.x + (px - W / 2) / k;
      pts.push(px, sy(height(wx, z), z));
    }
    ctx.beginPath();
    ctx.moveTo(pts[0], H + 4);
    for (var i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineTo(pts[pts.length - 2], H + 4);
    ctx.closePath();
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = grey(tone);
    ctx.lineWidth = sl.d === 0 ? clamp(k * 0.05, 1.4, 3.2) : clamp(k * 0.02, 0.6, 1.4);
    ctx.stroke();

    if (sl.d > 40) hatch(sl, k, tone);
    else if (sl.d > 3 && near > 5) { ctx.globalAlpha = sstep(5, 12, near); trees(sl, k, tone); }
    if (sl.d < 0.5) grass(sl, k, tone);
    ctx.globalAlpha = 1;
  }

  // slanted strokes under the ridges of far mountains
  function hatch(sl, k, tone) {
    var z = sl.z, g = Math.max(0.8, sl.d * 0.035);
    var n = Math.round(P / g); g = P / n;
    var a = Math.floor((cam.x - W / 2 / k) / g), b = Math.ceil((cam.x + W / 2 / k) / g);
    ctx.beginPath();
    for (var i = a; i <= b; i++) {
      var im = ((i % n) + n) % n, x = i * g;
      var y = height(x, z), y2 = height(x + g, z);
      var slope = (y - y2) / g;
      if (y < 12 || hash(im, sl.i) > 0.55 + Math.abs(slope) * 0.6) continue;
      var len = (2 + hash(im, sl.i + 9) * 6) * Math.min(1, y / 40);
      var X = sx(x, z), Y = sy(y, z) + 2;
      var dir = slope > 0 ? 1 : -1;
      ctx.moveTo(X, Y);
      ctx.lineTo(X + dir * len * 0.35 * k, Y + len * k);
    }
    ctx.strokeStyle = grey(Math.min(1, tone + 0.15));
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function trees(sl, k, tone) {
    var z = sl.z, d = sl.d;
    var cs = 2.6 + d * 0.32, n = Math.round(P / cs); cs = P / n;
    var dens = d < 6 ? 0.16 : d < 12 ? 0.3 : 0.45;
    var a = Math.floor((cam.x - W / 2 / k) / cs) - 1, b = Math.ceil((cam.x + W / 2 / k) / cs) + 1;
    ctx.strokeStyle = grey(tone);
    ctx.lineWidth = clamp(k * 0.02, 0.6, 1.4);
    for (var i = a; i <= b; i++) {
      var im = ((i % n) + n) % n;
      if (hash(im, sl.i) > dens) continue;
      var x = (i + 0.15 + 0.7 * hash(im, sl.i + 7)) * cs;
      if (Math.abs(((x % P) + P) % P - XF) < (d < 20 ? 14 : 0)) continue;
      var th = 3 + 4 * hash(im, sl.i + 3);
      pine(sx(x, z), sy(height(x, z), z), th * k, hash(im, sl.i + 5));
    }
  }

  function pine(X, Y, h, seed) {
    if (h < 2) return;
    var wd = h * (0.3 + seed * 0.1), tiers = 3 + Math.floor(seed * 2);
    ctx.beginPath();
    ctx.moveTo(X, Y); ctx.lineTo(X, Y - h * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X, Y - h);
    for (var t = 0; t < tiers; t++) {
      var f = (t + 1) / tiers, yy = Y - h + h * 0.82 * f;
      ctx.lineTo(X + wd * f, yy);
      ctx.lineTo(X + wd * f * 0.45, yy - h * 0.04);
    }
    for (t = tiers - 1; t >= 0; t--) {
      f = (t + 1) / tiers; yy = Y - h + h * 0.82 * f;
      ctx.lineTo(X - wd * f * 0.45, yy - h * 0.04);
      ctx.lineTo(X - wd * f, yy);
    }
    ctx.closePath();
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.stroke();
  }

  function grass(sl, k, tone) {
    var z = sl.z, g = 0.45;
    var n = Math.round(P / g); g = P / n;
    var a = Math.floor((cam.x - W / 2 / k) / g), b = Math.ceil((cam.x + W / 2 / k) / g);
    if (b - a > 900) return;
    ctx.beginPath();
    for (var i = a; i <= b; i++) {
      var im = ((i % n) + n) % n, hh = hash(im, sl.i + 2);
      if (hh > 0.5) continue;
      var x = (i + hash(im, sl.i + 4)) * g, X = sx(x, z), Y = sy(height(x, z), z);
      var L = (0.08 + hh * 0.3) * k;
      if (sl.d === 0) L *= 0.5;
      ctx.moveTo(X, Y); ctx.lineTo(X - L * 0.25, Y - L);
      ctx.moveTo(X + L * 0.15, Y); ctx.lineTo(X + L * 0.35, Y - L * 0.8);
    }
    ctx.strokeStyle = grey(tone);
    ctx.lineWidth = clamp(k * 0.02, 0.6, 1.6);
    ctx.stroke();
    // a few stones in the foreground
    if (sl.d < 0) {
      var cs = 3.1, nn = Math.round(P / cs); cs = P / nn;
      a = Math.floor((cam.x - W / 2 / k) / cs) - 1; b = Math.ceil((cam.x + W / 2 / k) / cs) + 1;
      for (i = a; i <= b; i++) {
        var j = ((i % nn) + nn) % nn;
        if (hash(j, sl.i + 11) > 0.35) continue;
        var sxw = (i + hash(j, sl.i + 12)) * cs, r = (0.12 + 0.25 * hash(j, sl.i + 13)) * k;
        X = sx(sxw, z); Y = sy(height(sxw, z), z);
        ctx.beginPath();
        ctx.moveTo(X - r, Y + 1);
        ctx.quadraticCurveTo(X - r * 0.9, Y - r * 0.9, X, Y - r * 0.85);
        ctx.quadraticCurveTo(X + r * 1.1, Y - r * 0.7, X + r, Y + 1);
        ctx.closePath();
        ctx.fillStyle = BG; ctx.fill(); ctx.stroke();
      }
    }
  }

  /* ---------------- sky ---------------- */
  function sky() {
    var zc = 1400, k = kAt(zc);
    ctx.strokeStyle = grey(0.62);
    ctx.lineWidth = 1;
    var sunX = W * 0.8 - (cam.x % P) * k * 0.2, sunY = sy(150, zc);
    ctx.beginPath(); ctx.arc(((sunX % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3, sunY, Math.max(14, H * 0.045), 0, TAU); ctx.stroke();
    var cs = P / 5;
    var a = Math.floor((cam.x - W / 2 / k) / cs) - 1, b = Math.ceil((cam.x + W / 2 / k) / cs) + 1;
    for (var i = a; i <= b; i++) {
      var im = ((i % 5) + 5) % 5;
      var x = (i + hash(im, 1)) * cs, y = 120 + hash(im, 2) * 90;
      cloud(sx(x, zc), sy(y, zc), (40 + hash(im, 3) * 40) * k, hash(im, 4));
    }
  }
  function cloud(X, Y, s, seed) {
    if (s < 6) return;
    ctx.beginPath();
    var n = 4 + Math.floor(seed * 3);
    ctx.moveTo(X - s, Y);
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, cx = X - s + 2 * s * t, r = s / n * (1.1 + 0.6 * Math.sin(i * 2.3 + seed * 9));
      ctx.arc(cx, Y - r * 0.3, r, Math.PI, 0);
    }
    ctx.lineTo(X + s, Y);
    ctx.closePath();
    ctx.fillStyle = BG; ctx.fill(); ctx.stroke();
  }

  /* ---------------- props ---------------- */
  var POSTS = [[0.165, "KM 3"], [0.255, "KM 14"], [0.345, "KM 21"], [0.43, "KM 28"], [0.82, "KM 41"]];
  function post(x, label) {
    var z = ZT + 0.7, k = kAt(z);
    if (k < 2) return;
    var X = sx(x, z), Y = sy(height(x, z), z);
    ctx.strokeStyle = INK; ctx.lineWidth = clamp(k * 0.06, 1, 4);
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 1.5 * k); ctx.stroke();
    var bw = 1.15 * k, bh = 0.42 * k;
    ctx.fillStyle = INK; ctx.fillRect(X - bw / 2, Y - 1.5 * k - bh, bw, bh);
    if (bh > 9) {
      ctx.fillStyle = BG;
      ctx.font = "700 " + Math.round(bh * 0.56) + "px Geist, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, X, Y - 1.5 * k - bh / 2 + 1);
    }
  }

  // finish arch, drawn in three-quarter view so the banner reads
  var ARCH = { bx: -0.7, bz: 1.5, fx: 0.7, fz: -1.5, top: 3.3, band: 0.7 };
  function archPoint(side, y, lap) {
    var x = XF + lap * P + (side ? ARCH.fx : ARCH.bx), z = ZT + (side ? ARCH.fz : ARCH.bz);
    return [sx(x, z), sy(y, z), kAt(z), x, z];
  }
  function archBack(lap, runnerX) {
    if (ZT + ARCH.fz - cam.z < 1.5) return;
    var b0 = archPoint(0, height(XF + ARCH.bx, ZT + ARCH.bz), lap), b1 = archPoint(0, ARCH.top, lap);
    var f1 = archPoint(1, ARCH.top, lap), f2 = archPoint(1, ARCH.top - ARCH.band, lap), b2 = archPoint(0, ARCH.top - ARCH.band, lap);
    if (b0[2] < 1.5) return;
    ctx.strokeStyle = INK; ctx.lineWidth = clamp(b0[2] * 0.09, 1, 6);
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    // banner
    ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(f1[0], f1[1]); ctx.lineTo(f2[0], f2[1]); ctx.lineTo(b2[0], b2[1]); ctx.closePath();
    ctx.fillStyle = INK; ctx.fill(); ctx.stroke();
    var bh = Math.abs(b2[1] - b1[1]);
    if (bh > 8) {
      ctx.save();
      // map text space (0..1 along, 0..1 across) onto the banner quad
      var ux = f1[0] - b1[0], uy = f1[1] - b1[1], vx = b2[0] - b1[0], vy = b2[1] - b1[1];
      ctx.setTransform(DPR * ux, DPR * uy, DPR * vx, DPR * vy, DPR * b1[0], DPR * b1[1]);
      ctx.fillStyle = BG;
      ctx.font = "800 0.62px Geist, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.scale(1 / 3.2, 1);
      ctx.fillText(lang === "en" ? "FINISH" : "META", 1.6, 0.54);
      ctx.restore();
    }
    // tape at chest height; snaps once the runner is through
    var ty = 1.25 + height(XF, ZT);
    var tb = archPoint(0, ty, lap), tf = archPoint(1, ty, lap);
    ctx.lineWidth = clamp(b0[2] * 0.025, 1, 3);
    
    ctx.beginPath();
    if (runnerX < XF + lap * P - 0.15) { ctx.moveTo(tb[0], tb[1]); ctx.lineTo(tf[0], tf[1]); }
    else {
      var mx = (tb[0] + tf[0]) / 2;
      ctx.moveTo(tb[0], tb[1]); ctx.quadraticCurveTo(tb[0] + (mx - tb[0]) * 0.6, tb[1] + b0[2] * 0.2, mx - b0[2] * 0.05, tb[1] + b0[2] * 0.7);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function archFront(lap, runnerX) {
    if (ZT + ARCH.fz - cam.z < 1.5) return;
    var f0 = archPoint(1, height(XF + ARCH.fx, ZT + ARCH.fz), lap), f1 = archPoint(1, ARCH.top, lap);
    if (f0[2] < 1.5 || f0[4] - cam.z < 0.5) return;
    ctx.strokeStyle = INK; ctx.lineWidth = clamp(f0[2] * 0.09, 1, 8);
    ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.stroke();
    if (runnerX >= XF + lap * P - 0.15) {
      var ty = 1.25 + height(XF, ZT), tf = archPoint(1, ty, lap), tb = archPoint(0, ty, lap);
      var mx = (tb[0] + tf[0]) / 2;
      ctx.lineWidth = clamp(f0[2] * 0.025, 1, 3);
      
      ctx.beginPath(); ctx.moveTo(tf[0], tf[1]); ctx.quadraticCurveTo(tf[0] - (tf[0] - mx) * 0.6, tf[1] + f0[2] * 0.25, mx + f0[2] * 0.05, tf[1] + f0[2] * 0.75);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // dashed trail over the mountains (descent and climb)
  function trailSegments(list, lap) {
    function seg(s0, s1) {
      var a = pathXZ(s0 + lap), b = pathXZ(s1 + lap);
      list.push({ z: (a[1] + b[1]) / 2 + 0.05, draw: function () {
        if (Math.min(a[1], b[1]) - cam.z < 1) return;
        var t = depthTone(a[1]);
        ctx.strokeStyle = grey(t);
        ctx.lineWidth = clamp(kAt(a[1]) * 0.08, 0.8, 2.4);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx(a[0], a[1]), sy(height(a[0], a[1]) + 0.05, a[1]));
        ctx.lineTo(sx(b[0], b[1]), sy(height(b[0], b[1]) + 0.05, b[1]));
        ctx.stroke(); ctx.setLineDash([]);
      } });
    }
    var N = 70, i;
    for (i = 0; i < N; i++) seg(S_DESC * i / N, S_DESC * (i + 1) / N);
    for (i = 0; i < N; i++) seg(S_FIN + (1 - S_FIN) * i / N, S_FIN + (1 - S_FIN) * (i + 1) / N);
  }

  /* ---------------- the runner ---------------- */
  // angle a is measured from straight down, positive = forward
  function limb(x0, y0, a, len, dir) { return [x0 + Math.sin(a) * len * dir, y0 - Math.cos(a) * len]; }

  function runner(X, Y, k, dir, ph, cel, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(X, Y);
    ctx.scale(k, -k);          // local units, y up, feet at 0
    var amp = 1 - cel * 0.9;
    var bob = 0.05 * Math.abs(Math.sin(ph)) * amp;
    var hip = [0, 0.9 + bob];
    var lean = 0.2 * amp + 0.03;
    var sh = [hip[0] + Math.sin(lean) * 0.56 * dir, hip[1] + Math.cos(lean) * 0.56];
    var px1 = 1 / k;
    var lw = Math.max(0.08, 1.4 * px1);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    function leg(p, shade) {
      var th = (0.12 + 0.6 * Math.sin(p)) * amp;                       // thigh swing
      var bend = (0.15 + 1.25 * Math.pow(0.5 + 0.5 * Math.sin(p - 1.6), 2)) * amp + 0.05;
      var knee = limb(hip[0], hip[1], th, 0.45, dir);
      var sa = th - bend;                                               // shin folds back
      var ank = limb(knee[0], knee[1], sa, 0.45, dir);
      ctx.strokeStyle = shade;
      ctx.lineWidth = lw * 1.15;
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(ank[0], ank[1]); ctx.stroke();
      var fa = sa + Math.PI / 2 - 0.15;                                  // foot roughly square to the shin
      var toe = limb(ank[0], ank[1], fa, 0.2, dir);
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath(); ctx.moveTo(ank[0] - Math.sin(fa) * 0.04 * dir, ank[1] + Math.cos(fa) * 0.04); ctx.lineTo(toe[0], toe[1]); ctx.stroke();
    }
    function arm(p, shade, near) {
      var ua = -0.7 * Math.sin(p) * amp, fa = 1.5;
      if (cel > 0) { ua = lerp(ua, Math.PI - (near ? 0.35 : 0.6), cel); fa = lerp(fa, 0.25, cel); }
      var el = limb(sh[0], sh[1], ua, 0.29, dir);
      var hd = limb(el[0], el[1], ua + fa, 0.27, dir);
      ctx.strokeStyle = shade;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(el[0], el[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
    }

    var far = "#7a7a77";
    arm(ph, far, false);
    leg(ph + Math.PI, far);
    // shorts
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.9;
    var sk = limb(hip[0], hip[1], 0.12 + 0.6 * Math.sin(ph) * amp, 0.16, dir);
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(sk[0], sk[1]); ctx.stroke();
    leg(ph, INK);
    // torso
    ctx.lineWidth = lw * 2.6;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1] + 0.04); ctx.lineTo(sh[0], sh[1] - 0.06); ctx.stroke();
    // bib
    if (k > 60) {
      var bx = lerp(hip[0], sh[0], 0.5) + 0.04 * dir, by = lerp(hip[1], sh[1], 0.5);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-lean * dir);
      ctx.fillStyle = BG; ctx.fillRect(-0.055, -0.06, 0.11, 0.11);
      ctx.restore();
    }
    // head (solid, pictogram style) with a cap brim
    var head = [sh[0] + 0.08 * dir, sh[1] + 0.2];
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(head[0], head[1], 0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.045, 1.5 * px1);
    ctx.beginPath(); ctx.moveTo(head[0], head[1] + 0.06); ctx.lineTo(head[0] + 0.2 * dir, head[1] + 0.045); ctx.stroke();
    arm(ph + Math.PI, INK, true);
    ctx.restore();
  }

  /* ---------------- frame ---------------- */
  var lang = "es";
  var lastRunX = 0, runDir = 1, travelled = 0, lastR = 0;

  function render(y) {
    var st = {}; CH.forEach(function (c) { st[c] = curves[c](y); });
    setCamera(st);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    sky();

    var lap = Math.floor(st.s);
    var list = SLICES.map(function (sl) { return { z: sl.z, draw: function () { drawSlice(sl); } }; });
    trailSegments(list, 0); trailSegments(list, 1);

    // runner(s)
    var r = st.r, rp = pathXZ(r), rx = rp[0], rz = rp[1];
    var dr = r - lastR;
    if (Math.abs(dr) < 0.2) travelled += Math.hypot(pathXZ(r)[0] - pathXZ(lastR)[0], pathXZ(r)[1] - pathXZ(lastR)[1]) * (dr < 0 ? -1 : 1);
    lastR = r;
    var p2 = pathXZ(r + 0.0015), dxr = p2[0] - rx;
    if (Math.abs(dxr) > 0.02) runDir = dxr > 0 ? 1 : -1;
    var cel = sstep(sAtX(XF) - 0.001, sAtX(XF) + 0.012, r) * (r < 0.99 ? 1 : 0);
    var ph = travelled / 1.55 * Math.PI;
    var tail = st.s > S_FIN + 0.004;
    var a1 = tail ? 1 - sstep(0.915, 0.965, st.s) : 1;
    var a2 = tail ? sstep(0.955, 0.998, st.s) : 0;
    list.push({ z: rz - 0.02, draw: function () {
      if (rz - cam.z < 0.6) return;
      runner(sx(rx, rz), sy(height(rx, rz), rz), kAt(rz), runDir, ph, cel, a1);
    } });
    if (a2 > 0) {
      var np = pathXZ(1);
      list.push({ z: np[1] - 0.02, draw: function () { runner(sx(np[0], np[1]), sy(height(np[0], np[1]), np[1]), kAt(np[1]), 1, 0.3, 0, a2); } });
    }

    // props on the trail (current lap and the next, for the seam)
    [lap - 1, lap, lap + 1].forEach(function (L) {
      POSTS.forEach(function (pp) {
        var x = pathXZ(pp[0])[0] + L * P;
        list.push({ z: ZT + 0.7, draw: function () { post(x, pp[1]); } });
      });
      list.push({ z: ZT + ARCH.bz - 0.5, draw: function () { archBack(L, rx); } });
      list.push({ z: ZT + ARCH.fz, draw: function () { archFront(L, rx); } });
    });

    list.sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < list.length; i++) list[i].draw();

    updateTrack(y);
  }

  /* ---------------- bottom route bar ---------------- */
  var CHAPTERS = [["inicio", "Largada", "Start"], ["hexacta", "Recorrido", "Path"], ["porque", "Por qué", "Why"], ["proceso", "Proceso", "Process"], ["casos", "Casos", "Work"], ["contacto", "Meta", "Finish"]];
  var fill = document.getElementById("fill"), dot = document.getElementById("dot"), marks = document.getElementById("marks");
  function buildTrack() {
    marks.innerHTML = "";
    CHAPTERS.forEach(function (c) {
      var el = document.getElementById(c[0]);
      var li = document.createElement("li");
      li.style.left = (el.offsetTop / loopTop * 100).toFixed(2) + "%";
      var a = document.createElement("a");
      a.href = "#" + c[0]; a.textContent = lang === "en" ? c[2] : c[1];
      li.appendChild(a); marks.appendChild(li);
    });
  }
  function updateTrack(y) {
    var f = clamp(y / loopTop, 0, 1) * 100;
    fill.style.width = f + "%"; dot.style.left = f + "%";
  }

  /* ---------------- scroll, smoothing, infinite loop ---------------- */
  var cur = window.scrollY, last = performance.now(), dirty = true;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout();
    dirty = true;
  }
  function wrapCheck() {
    var y = window.scrollY;
    if (y >= loopTop - 1) {
      window.scrollTo(0, y - loopTop);
      cur -= loopTop; lastR -= 1;
    }
  }
  window.addEventListener("scroll", function () { wrapCheck(); dirty = true; }, { passive: true });
  // scrolling up from the very top goes round to the end
  window.addEventListener("wheel", function (e) {
    if (window.scrollY <= 0 && e.deltaY < 0) {
      window.scrollTo(0, loopTop - 2);
      cur += loopTop; lastR += 1;
    }
  }, { passive: true });

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var target = window.scrollY;
    if (reduce) cur = target;
    else cur += (target - cur) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - cur) < 0.05) cur = target;
    if (dirty || cur !== target) { render(cur); dirty = cur !== target; }
    requestAnimationFrame(tick);
  }

  /* ---------------- language ---------------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll("[data-en]").forEach(function (n) {
      if (n.dataset.es == null) n.dataset.es = n.innerHTML;
      n.innerHTML = l === "en" ? n.dataset.en : n.dataset.es;
    });
    document.querySelectorAll("[data-en-aria-label]").forEach(function (n) {
      if (n.dataset.esAria == null) n.dataset.esAria = n.getAttribute("aria-label");
      n.setAttribute("aria-label", l === "en" ? n.dataset.enAriaLabel : n.dataset.esAria);
    });
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === l)); });
    cloneHero();
    store("lang", l);
    if (curves) { buildTrack(); dirty = true; }
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.addEventListener("click", function () { setLang(b.dataset.lang); }); });

  // the last screen is a copy of the first, so the wrap is invisible
  function cloneHero() {
    var src = document.getElementById("inicio"), dst = document.getElementById("loop");
    dst.innerHTML = src.innerHTML;
    dst.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
  }

  /* ---------------- cases (expand in place) ---------------- */
  document.querySelectorAll("article.case").forEach(function (c) {
    var btn = c.querySelector(".tile");
    var cap = c.querySelector(".cap"), more = c.querySelector(".more");
    var h = document.createElement("h3");
    h.className = "more-title";
    h.innerHTML = cap.innerHTML;
    more.insertBefore(h, more.firstChild);
    var x = document.createElement("button");
    x.type = "button"; x.className = "close-x"; x.textContent = "✕";
    x.setAttribute("aria-label", "Cerrar");
    x.hidden = true;
    c.appendChild(x);
    function toggle(open) {
      var run = function () {
        document.querySelectorAll("article.case.open").forEach(function (o) {
          if (o !== c) { o.classList.remove("open"); o.querySelector(".tile").setAttribute("aria-expanded", "false"); o.querySelector(".close-x").hidden = true; }
        });
        c.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
        x.hidden = !open;
      };
      if (document.startViewTransition && !reduce) document.startViewTransition(run); else run();
      setTimeout(function () {
        layout(); dirty = true;
        if (open) c.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }, 380);
    }
    btn.addEventListener("click", function () { toggle(!c.classList.contains("open")); });
    x.addEventListener("click", function () { toggle(false); btn.focus(); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { var o = document.querySelector("article.case.open .close-x"); if (o) o.click(); }
  });

  /* ---------------- boot ---------------- */
  setLang(store("lang") || ((navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en"));
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", function () { layout(); dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); dirty = true; });
  if ("ResizeObserver" in window) new ResizeObserver(function () { layout(); dirty = true; }).observe(document.getElementById("story"));
  lastR = curves.r(cur);
  requestAnimationFrame(tick);

  // debug hook for screenshots
  window.__recorrido = { render: function (y) { cur = y; render(y); }, keys: function () { return pos; }, loopTop: function () { return loopTop; } };
})();
