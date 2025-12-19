// art.js — "HIERSEIN" / Chevalier-esque light installation (single file, no libs)
// Reveal: ~10s after start (and then every 30–55s). Press SPACE to trigger instantly.
(() => {
  "use strict";

  // ---------- Canvas ----------
  const c = document.createElement("canvas");
  const x = c.getContext("2d", { alpha: true });
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#04050a";
  document.body.appendChild(c);

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(innerWidth);
    H = Math.floor(innerHeight);
    c.width = Math.floor(W * DPR);
    c.height = Math.floor(H * DPR);
    c.style.width = W + "px";
    c.style.height = H + "px";
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildMask();
    buildGrid();
  }
  addEventListener("resize", resize, { passive: true });

  // ---------- Pointer ----------
  const P = { x: 0, y: 0, tx: 0, ty: 0, down: false };
  const move = (px, py) => { P.tx = px; P.ty = py; };
  addEventListener("mousemove", (e) => move(e.clientX, e.clientY), { passive: true });
  addEventListener("mousedown", () => (P.down = true), { passive: true });
  addEventListener("mouseup", () => (P.down = false), { passive: true });
  addEventListener("touchstart", (e) => {
    P.down = true;
    const t = e.touches[0];
    if (t) move(t.clientX, t.clientY);
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) move(t.clientX, t.clientY);
  }, { passive: true });
  addEventListener("touchend", () => (P.down = false), { passive: true });

  function updPointer() {
    P.x += (P.tx - P.x) * 0.08;
    P.y += (P.ty - P.y) * 0.08;
  }

  // ---------- Utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (t) => t * t * (3 - 2 * t);
  const TAU = Math.PI * 2;

  // ---------- Noise ----------
  function hash2i(ix, iy) {
    let n = ix * 374761393 + iy * 668265263;
    n = (n ^ (n >>> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    return n;
  }
  function r01(ix, iy) { return (hash2i(ix, iy) & 0xfffffff) / 0xfffffff; }
  function n2(px, py) {
    const ix = Math.floor(px), iy = Math.floor(py);
    const fx = px - ix, fy = py - iy;
    const u = ss(fx), v = ss(fy);
    const a = r01(ix, iy), b = r01(ix + 1, iy), c = r01(ix, iy + 1), d = r01(ix + 1, iy + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(px, py) {
    let f = 0, amp = 0.55, frq = 1.0;
    for (let i = 0; i < 4; i++) {
      f += amp * n2(px * frq, py * frq);
      frq *= 2.03; amp *= 0.5;
    }
    return f;
  }

  // ---------- Grid nodes ----------
  let nodes = []; // {x,y,z,px,py,phase}
  let spacing = 18;
  let cols = 0, rows = 0;

  function buildGrid() {
    nodes.length = 0;
    spacing = clamp(Math.min(W, H) / 42, 14, 24);
    cols = Math.floor(W / spacing) + 3;
    rows = Math.floor(H / spacing) + 3;

    const ox = (W - (cols - 1) * spacing) * 0.5;
    const oy = (H - (rows - 1) * spacing) * 0.5;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const gx = ox + i * spacing;
        const gy = oy + j * spacing;
        nodes.push({
          x: gx, y: gy,
          px: gx, py: gy,
          z: Math.random(),
          phase: Math.random() * 1000
        });
      }
    }
  }

  // ---------- Offscreen mask ("HIERSEIN") ----------
  const m = document.createElement("canvas");
  const mx = m.getContext("2d", { willReadFrequently: true });
  let mData = null, mW = 0, mH = 0;
  const PHRASE = "HIERSEIN";

  function buildMask() {
    mW = Math.max(420, Math.floor(W * 0.85));
    mH = Math.max(220, Math.floor(H * 0.32));
    m.width = mW; m.height = mH;

    mx.clearRect(0, 0, mW, mH);
    const fs = Math.floor(Math.min(mW, mH) * 0.30);

    mx.textAlign = "center";
    mx.textBaseline = "middle";
    mx.font = `800 ${fs}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial`;
    mx.fillStyle = "rgba(255,255,255,1)";
    mx.fillText(PHRASE, mW * 0.5, mH * 0.55);

    // soft glow
    mx.globalAlpha = 0.18;
    for (let k = 0; k < 14; k++) {
      const ox = (Math.random() - 0.5) * 4.2;
      const oy = (Math.random() - 0.5) * 4.2;
      mx.fillText(PHRASE, mW * 0.5 + ox, mH * 0.55 + oy);
    }
    mx.globalAlpha = 1;

    mData = mx.getImageData(0, 0, mW, mH).data;
  }

  function aMask(nx, ny) {
    if (!mData) return 0;
    const xx = Math.floor(clamp(nx, 0, 1) * (mW - 1));
    const yy = Math.floor(clamp(ny, 0, 1) * (mH - 1));
    return mData[(yy * mW + xx) * 4 + 3] / 255;
  }

  // ---------- Event choreography ----------
  let nextEvt = 0, evtStart = 0, evtDur = 0;

  function scheduleNext(now) {
    nextEvt = now + lerp(30000, 55000, Math.random()); // after first reveal
    evtStart = 0; evtDur = 0;
  }

  function startEvent(now, durationMs = 4600) {
    evtStart = now;
    evtDur = durationMs;
    buildMask(); // fresh glow each event
  }

  function maybeStartEvent(now) {
    if (evtStart === 0 && now >= nextEvt) {
      startEvent(now, lerp(3800, 5200, Math.random()));
      scheduleNext(now);
    }
  }

  function evtStrength(now) {
    if (evtStart === 0) return 0;
    const t = (now - evtStart) / evtDur;
    if (t <= 0 || t >= 1) { evtStart = 0; return 0; }
    const s = Math.sin(Math.PI * t);
    return s * s; // smooth bell curve
  }

  // SPACE = trigger instantly
  addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      const now = performance.now();
      startEvent(now, 4800);
    }
  });

  // ---------- Render helpers ----------
  function vignette() {
    const g = x.createRadialGradient(
      W * 0.5, H * 0.52, Math.min(W, H) * 0.12,
      W * 0.5, H * 0.52, Math.max(W, H) * 0.82
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.12)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 16.6667, 0.6, 1.6);
    last = now;

    updPointer();
    maybeStartEvent(now);
    const E = evtStrength(now);

    // background fade
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "rgba(4,5,10,0.10)";
    x.fillRect(0, 0, W, H);

    if ((now | 0) % 10 === 0) vignette();

    const centerX = W * 0.5, centerY = H * 0.52;
    const phraseX = W * 0.5, phraseY = H * 0.46;
    const calmR = Math.min(W, H) * 0.16;

    x.globalCompositeOperation = "lighter";

    const t = now * 0.001;
    const ns = 0.0065;
    const warp = 0.7 + 0.3 * Math.sin(now * 0.00011);

    for (let idx = 0; idx < nodes.length; idx++) {
      const p = nodes[idx];

      // base drift (noise)
      const nn = fbm((p.x + 200) * ns + t * 0.07, (p.y - 120) * ns - t * 0.06);
      const ang = nn * TAU * 1.1;
      const vx = Math.cos(ang) * 0.35 * warp;
      const vy = Math.sin(ang) * 0.35 * warp;

      // calm near pointer
      const dxp = p.x - P.x, dyp = p.y - P.y;
      const d = Math.hypot(dxp, dyp);
      const calm = d < calmR ? ss(1 - d / calmR) : 0;

      // composition pull
      const toC = 0.0009;
      const cx = (centerX - p.x) * toC;
      const cy = (centerY - p.y) * toC;

      // phrase formation
      let fx = 0, fy = 0;
      if (E > 0.001 && mData) {
        const nx = (p.x - (phraseX - mW * 0.5)) / mW;
        const ny = (p.y - (phraseY - mH * 0.5)) / mH;
        const a0 = aMask(nx, ny);

        if (a0 > 0.02) {
          const eps = 1 / mW;
          const gx = aMask(nx + eps, ny) - aMask(nx - eps, ny);
          const gy = aMask(nx, ny + eps) - aMask(nx, ny - eps);
          const k = 7.0 * E; // strong enough to actually form
          fx += (-gx) * k;
          fy += (-gy) * k;
        } else {
          fx += (phraseX - p.x) * 0.00055 * E;
          fy += (phraseY - p.y) * 0.00055 * E;
        }
      }

      // integrate (very damped)
      p.px += (vx + cx + fx) * (1 - 0.72 * calm);
      p.py += (vy + cy + fy) * (1 - 0.72 * calm);

      // relax back to grid anchor
      // during event: reduce relax strongly so the word can form
      const relax = 0.06 * (1 - 0.85 * E) + 0.10 * (1 - E);
      p.px += (p.x - p.px) * relax;
      p.py += (p.y - p.py) * relax;

      // parallax
      const zz = 0.6 + 0.4 * p.z;
      const px = p.px + (p.px - centerX) * (zz - 1) * 0.02;
      const py = p.py + (p.py - centerY) * (zz - 1) * 0.02;

      // light palette
      const localGlow = 0.25 * calm + 1.0 * E;
      const alpha = clamp(0.05 + 0.09 * zz + localGlow * 0.12, 0.05, 0.26);
      const hue = 205 + 22 * zz + 14 * E + 12 * Math.sin((p.phase + now) * 0.00008);

      x.fillStyle = `hsla(${hue.toFixed(1)}, 70%, 72%, ${alpha.toFixed(3)})`;
      const r = clamp(0.7 + 1.3 * zz + 1.0 * calm + 1.0 * E, 0.7, 3.2);
      x.beginPath();
      x.arc(px, py, r, 0, TAU);
      x.fill();
    }

    // sparse grid lines for "installation network"
    const stride = Math.floor(clamp(nodes.length / 280, 2, 6));
    x.lineWidth = 1;
    for (let k = 0; k < nodes.length; k += stride) {
      if (Math.random() < (0.06 + 0.16 * E)) {
        const i = k % cols;
        if (i < cols - 1) {
          const p = nodes[k];
          const q = nodes[k + 1];
          const a = 0.012 + 0.060 * E;
          x.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
          x.beginPath();
          x.moveTo(p.px, p.py);
          x.lineTo(q.px, q.py);
          x.stroke();
        }
      }
    }

    // guaranteed subtle text glow overlay during event (so it never "doesn't come")
    if (E > 0.02) {
      x.globalCompositeOperation = "screen";
      x.globalAlpha = 0.10 * E;
      x.drawImage(m, phraseX - mW * 0.5, phraseY - mH * 0.5);
      x.globalAlpha = 1;
    }

    // pointer halo
    const halo = x.createRadialGradient(P.x, P.y, 0, P.x, P.y, calmR * 1.1);
    halo.addColorStop(0, "rgba(255,255,255,0.030)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    x.globalCompositeOperation = "screen";
    x.fillStyle = halo;
    x.fillRect(P.x - calmR * 1.2, P.y - calmR * 1.2, calmR * 2.4, calmR * 2.4);

    // light grain
    if ((now | 0) % 2 === 0) {
      x.globalCompositeOperation = "overlay";
      x.globalAlpha = 0.07;
      for (let g = 0; g < 120; g++) {
        const gx = Math.random() * W, gy = Math.random() * H;
        const s = Math.random() < 0.94 ? 1 : 2;
        x.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
        x.fillRect(gx, gy, s, s);
      }
      x.globalAlpha = 1;
    }

    requestAnimationFrame(loop);
  }

  // ---------- Init ----------
  resize();
  P.x = P.tx = W * 0.5;
  P.y = P.ty = H * 0.55;

  buildGrid();
  buildMask();

  // First reveal exactly ~10s after start:
  const t0 = performance.now();
  nextEvt = t0 + 10000; // 10 seconds
  evtStart = 0; evtDur = 0;

  x.fillStyle = "#04050a";
  x.fillRect(0, 0, W, H);
  requestAnimationFrame(loop);
})();
