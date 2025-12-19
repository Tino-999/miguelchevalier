// art.js — "Kindness Field" (single file, no libs)
(() => {
  "use strict";

  // ---------- Canvas ----------
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#05060a";
  document.body.appendChild(canvas);

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  // ---------- Pointer (mouse/touch) ----------
  const pointer = { x: W * 0.5, y: H * 0.5, tx: W * 0.5, ty: H * 0.5, down: false };
  const onMove = (x, y) => { pointer.tx = x; pointer.ty = y; };
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("mousedown", () => (pointer.down = true), { passive: true });
  window.addEventListener("mouseup",   () => (pointer.down = false), { passive: true });

  window.addEventListener("touchstart", (e) => {
    pointer.down = true;
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("touchend", () => (pointer.down = false), { passive: true });

  // Smooth pointer
  function updatePointer() {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
  }

  // ---------- Utility ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  // ---------- Noise (value noise) ----------
  // Small deterministic hash
  function hash2i(x, y) {
    let n = x * 374761393 + y * 668265263; // large primes
    n = (n ^ (n >> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    return n;
  }
  function rand01(x, y) {
    return (hash2i(x, y) & 0xfffffff) / 0xfffffff;
  }
  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi,       yf = y - yi;

    const u = smoothstep(xf);
    const v = smoothstep(yf);

    const a = rand01(xi, yi);
    const b = rand01(xi + 1, yi);
    const c = rand01(xi, yi + 1);
    const d = rand01(xi + 1, yi + 1);

    const ab = lerp(a, b, u);
    const cd = lerp(c, d, u);
    return lerp(ab, cd, v);
  }

  // Fractal noise
  function fbm2(x, y) {
    let f = 0, amp = 0.55, freq = 1.0;
    for (let i = 0; i < 4; i++) {
      f += amp * noise2(x * freq, y * freq);
      freq *= 2.02;
      amp *= 0.5;
    }
    return f;
  }

  // ---------- Flow field ----------
  function flowAngle(x, y, t) {
    // Scale coordinates into noise space
    const s = 0.0015;
    const n = fbm2(x * s + t * 0.00003, y * s - t * 0.000025);
    return n * TAU * 1.25;
  }

  // ---------- Particles ----------
  const particles = [];
  let baseCount = 0;

  function initParticles() {
    particles.length = 0;

    // Density based on area
    const area = W * H;
    baseCount = Math.floor(clamp(area / 6500, 260, 1200));

    for (let i = 0; i < baseCount; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0,
        vy: 0,
        sp: lerp(0.15, 0.65, Math.random()),
        w: lerp(0.4, 1.4, Math.random()),
        a: lerp(0.06, 0.18, Math.random()), // alpha for trails
        hue: lerp(205, 230, Math.random()), // cool range
        life: Math.random() * 1000
      });
    }
  }
  initParticles();
  window.addEventListener("resize", () => initParticles(), { passive: true });

  // ---------- Rendering ----------
  let last = performance.now();
  let t = 0;

  function step(now) {
    const dt = clamp((now - last) / 16.6667, 0.5, 1.8);
    last = now;
    t += (now - last + 16.6667) * 0.001; // stable-ish, not too important
    updatePointer();

    // Soft fade (trails)
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(5, 6, 10, 0.08)";
    ctx.fillRect(0, 0, W, H);

    // Vignette-like gentle darkening edges
    // (cheap: draw a subtle radial gradient occasionally)
    if ((now | 0) % 8 === 0) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.55, Math.min(W, H) * 0.1, W * 0.5, H * 0.55, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.08)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Draw particles as short strokes along velocity
    ctx.globalCompositeOperation = "lighter";

    const calmRadius = Math.min(W, H) * 0.18;     // zone of calm
    const calmHard  = Math.min(W, H) * 0.06;     // extra calm near pointer

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Flow direction
      const ang = flowAngle(p.x, p.y, now);
      const fx = Math.cos(ang);
      const fy = Math.sin(ang);

      // Calm factor near pointer: turbulence reduced, speed reduced
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const d  = Math.hypot(dx, dy);

      let calm = 0;
      if (d < calmRadius) {
        calm = 1 - (d / calmRadius);
        calm = smoothstep(calm);
      }
      let superCalm = 0;
      if (d < calmHard) {
        superCalm = 1 - (d / calmHard);
        superCalm = smoothstep(superCalm);
      }

      // Base speed with slow "breath"
      const breath = 0.6 + 0.4 * Math.sin(now * 0.00012);
      const speed = p.sp * (0.65 + 0.35 * breath);

      // When calm: slow down and reduce randomness (smoother motion)
      const calmSlow = 1 - 0.75 * calm - 0.15 * superCalm;

      // Integrate velocity towards flow
      const ax = fx * speed * calmSlow;
      const ay = fy * speed * calmSlow;

      // Damping
      const damp = 0.86 + 0.08 * (1 - calm);
      p.vx = p.vx * damp + ax * 0.35;
      p.vy = p.vy * damp + ay * 0.35;

      // Extra gentle attraction to a loose "center line" to prevent dead zones
      const cx = W * 0.5, cy = H * 0.52;
      const toC = 0.0002;
      p.vx += (cx - p.x) * toC;
      p.vy += (cy - p.y) * toC;

      // Update position
      const ox = p.x, oy = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around edges softly
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // Color/alpha slightly influenced by calmness
      const a = p.a * (0.6 + 0.6 * (1 - calm)) * (pointer.down ? 0.9 : 1.0);
      const hue = p.hue + 12 * calm + 6 * Math.sin((now + i * 7) * 0.00008);

      ctx.strokeStyle = `hsla(${hue.toFixed(1)}, 60%, 70%, ${a.toFixed(3)})`;
      ctx.lineWidth = p.w;

      // Draw a short stroke along motion; in calm zone: shorter (quieter)
      const strokeLen = (2.2 + 5.5 * (1 - calm)) * (0.7 + 0.3 * breath);
      const vx = p.vx, vy = p.vy;
      const vmag = Math.max(0.0001, Math.hypot(vx, vy));
      const nx = vx / vmag, ny = vy / vmag;

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox - nx * strokeLen, oy - ny * strokeLen);
      ctx.stroke();

      // Occasionally: tiny "spark" far from pointer (subtle secret)
      p.life += dt;
      if (p.life > 900 + Math.random() * 900) {
        p.life = 0;
        if (d > calmRadius * 1.1) {
          ctx.fillStyle = `rgba(255,255,255,0.035)`;
          ctx.fillRect(p.x, p.y, 1, 1);
        }
      }
    }

    // A very subtle halo around pointer (calm presence)
    const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, calmRadius * 0.9);
    halo.addColorStop(0, "rgba(255,255,255,0.035)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = halo;
    ctx.fillRect(pointer.x - calmRadius, pointer.y - calmRadius, calmRadius * 2, calmRadius * 2);

    requestAnimationFrame(step);
  }

  // Start with a clean frame
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, W, H);
  requestAnimationFrame(step);
})();
