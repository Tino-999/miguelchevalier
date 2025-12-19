// art.js — Kindness Field + Secret Phrase Bloom (single file, no libs)
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
    rebuildMask();
  }
  window.addEventListener("resize", resize, { passive: true });

  // ---------- Pointer ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, down: false };
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

  function updatePointer() {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
  }

  // ---------- Utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const TAU = Math.PI * 2;

  // ---------- Noise ----------
  function hash2i(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    return n;
  }
  function rand01(x, y) {
    return (hash2i(x, y) & 0xfffffff) / 0xfffffff;
  }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi,       yf = y - yi;
    const u = smoothstep(xf), v = smoothstep(yf);
    const a = rand01(xi, yi);
    const b = rand01(xi + 1, yi);
    const c = rand01(xi, yi + 1);
    const d = rand01(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm2(x, y) {
    let f = 0, amp = 0.55, freq = 1.0;
    for (let i = 0; i < 4; i++) {
      f += amp * noise2(x * freq, y * freq);
      freq *= 2.02;
      amp *= 0.5;
    }
    return f;
  }

  function flowAngle(x, y, t) {
    const s = 0.00155;
    const n = fbm2(x * s + t * 0.00003, y * s - t * 0.000025);
    return n * TAU * 1.2;
  }

  // ---------- Secret Phrase Mask (offscreen) ----------
  const mask = document.createElement("canvas");
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  let maskData = null;
  let maskW = 0, maskH = 0;
  const PHRASE = "HIERSEIN"; // change me
  function rebuildMask() {
    maskW = Math.max(320, Math.floor(W * 0.9));
    maskH = Math.max(180, Math.floor(H * 0.35));
    mask.width = maskW;
    mask.height = maskH;

    mctx.clearRect(0, 0, maskW, maskH);

    // Composition: slightly above center
    const x = maskW * 0.5;
    const y = maskH * 0.55;

    const fontSize = Math.floor(Math.min(maskW, maskH) * 0.22);
    mctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial`;
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";

    // soft text "ink"
    mctx.fillStyle = "rgba(255,255,255,1)";
    mctx.fillText(PHRASE, x, y);

    // blur-ish by drawing offset copies (cheap)
    mctx.globalAlpha = 0.18;
    for (let i = 0; i < 10; i++) {
      const ox = (Math.random() - 0.5) * 3.0;
      const oy = (Math.random() - 0.5) * 3.0;
      mctx.fillText(PHRASE, x + ox, y + oy);
    }
    mctx.globalAlpha = 1;

    maskData = mctx.getImageData(0, 0, maskW, maskH).data;
  }

  // sample mask alpha at normalized coords (0..1 in mask space)
  function maskAlpha(nx, ny) {
    if (!maskData) return 0;
    const x = Math.floor(clamp(nx, 0, 1) * (maskW - 1));
    const y = Math.floor(clamp(ny, 0, 1) * (maskH - 1));
    const i = (y * maskW + x) * 4 + 3;
    return maskData[i] / 255;
  }

  // ---------- Particles ----------
  const particles = [];
  let baseCount = 0;

  function initParticles() {
    particles.length = 0;
    const area = W * H;
    baseCount = Math.floor(clamp(area / 7000, 260, 1100));

    // Deliberate density gradient: more in center band, less at edges
    for (let i = 0; i < baseCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const x = lerp(0.08, 0.92, u) * W + (Math.random() - 0.5) * 20;
      const y = (0.15 + 0.75 * Math.pow(v, 0.85)) * H;

      particles.push({
        x, y,
        vx: 0, vy: 0,
        sp: lerp(0.12, 0.62, Math.random()),
        w: lerp(0.45, 1.35, Math.random()),
        a: lerp(0.05, 0.16, Math.random()),
        hue: lerp(200, 232, Math.random()),
        seed: Math.random() * 1000
      });
    }
  }

  // ---------- Time / Event schedule ----------
  // "Moment" cycles: mostly normal, occasionally phrase forms
  let nextEventAt = 0;
  let eventStart = 0;
  let eventDur = 0;
  function scheduleNext(now) {
    nextEventAt = now + lerp(38000, 72000, Math.random()); // 38–72s
    eventStart = 0;
    eventDur = 0;
  }
  function maybeStartEvent(now) {
    if (eventStart === 0 && now >= nextEventAt) {
      eventStart = now;
      eventDur = lerp(2600, 4200, Math.random()); // 2.6–4.2s
      // refresh mask slightly each event so it feels alive
      rebuildMask();
      scheduleNext(now);
    }
  }
  function eventStrength(now) {
    if (eventStart === 0) return 0;
    const t = (now - eventStart) / eventDur;
    if (t <= 0 || t >= 1) { eventStart = 0; return 0; }
    // bell curve
    const s = Math.sin(Math.PI * t);
    return s * s;
  }

  // ---------- Render ----------
  let last = performance.now();
  function step(now) {
    const dt = clamp((now - last) / 16.6667, 0.5, 1.8);
    last = now;

    updatePointer();
    maybeStartEvent(now);
    const E = eventStrength(now); // 0..1

    // Fade / trails
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(5, 6, 10, 0.075)";
    ctx.fillRect(0, 0, W, H);

    // Subtle vignette (every few frames)
    if ((now | 0) % 10 === 0) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.12, W * 0.5, H * 0.52, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.10)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const calmRadius = Math.min(W, H) * 0.18;
    const calmHard  = Math.min(W, H) * 0.06;

    // Phrase anchor position in world space
    const phraseX = W * 0.5;
    const phraseY = H * 0.46;

    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      const ang = flowAngle(p.x, p.y, now);
      const fx = Math.cos(ang), fy = Math.sin(ang);

      // Calm around pointer
      const dxp = p.x - pointer.x, dyp = p.y - pointer.y;
      const d  = Math.hypot(dxp, dyp);
      let calm = 0;
      if (d < calmRadius) calm = smoothstep(1 - d / calmRadius);
      let superCalm = 0;
      if (d < calmHard) superCalm = smoothstep(1 - d / calmHard);

      const breath = 0.6 + 0.4 * Math.sin(now * 0.00012);
      const speed = p.sp * (0.62 + 0.38 * breath);

      const calmSlow = 1 - 0.72 * calm - 0.18 * superCalm;

      // Base flow force
      let ax = fx * speed * calmSlow;
      let ay = fy * speed * calmSlow;

      // ---------- EVENT: phrase formation force ----------
      if (E > 0.001 && maskData) {
        // Map particle position into mask space around phrase anchor
        const localX = (p.x - (phraseX - maskW * 0.5)) / maskW; // 0..1
        const localY = (p.y - (phraseY - maskH * 0.5)) / maskH;

        // If near text pixels, attract to that region softly
        const a0 = maskAlpha(localX, localY);
        if (a0 > 0.02) {
          // approximate gradient by sampling neighbors (cheap)
          const eps = 1 / maskW;
          const gx = maskAlpha(localX + eps, localY) - maskAlpha(localX - eps, localY);
          const gy = maskAlpha(localX, localY + eps) - maskAlpha(localX, localY - eps);

          // pull “into ink”
          const k = 0.9 * E; // strength
          ax += (-gx) * k * 2.2;
          ay += (-gy) * k * 2.2;

          // slow down inside the word (quiet)
          ax *= (1 - 0.35 * E);
          ay *= (1 - 0.35 * E);
        } else {
          // gentle drift toward phrase region so the reveal can happen
          const toX = (phraseX - p.x) * 0.00008 * E;
          const toY = (phraseY - p.y) * 0.00008 * E;
          ax += toX;
          ay += toY;
        }
      }

      // Damping
      const damp = 0.865 + 0.07 * (1 - calm);
      p.vx = p.vx * damp + ax * 0.36;
      p.vy = p.vy * damp + ay * 0.36;

      // Gentle global composition pull (keeps the scene “framed”)
      const cx = W * 0.5, cy = H * 0.52;
      p.vx += (cx - p.x) * 0.00018;
      p.vy += (cy - p.y) * 0.00018;

      const ox = p.x, oy = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // Styling
      const a = p.a * (0.62 + 0.55 * (1 - calm));
      const hue = p.hue + 10 * calm + 10 * E;
      ctx.strokeStyle = `hsla(${hue.toFixed(1)}, 60%, 72%, ${a.toFixed(3)})`;
      ctx.lineWidth = p.w;

      const vx = p.vx, vy = p.vy;
      const vmag = Math.max(0.0001, Math.hypot(vx, vy));
      const nx = vx / vmag, ny = vy / vmag;

      // In the event, strokes become slightly shorter (more "ink-like")
      const baseLen = (2.2 + 5.2 * (1 - calm)) * (0.7 + 0.3 * breath);
      const strokeLen = baseLen * (1 - 0.25 * E);

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox - nx * strokeLen, oy - ny * strokeLen);
      ctx.stroke();
    }

    // Subtle halo around pointer (presence)
    const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, calmRadius * 0.9);
    halo.addColorStop(0, "rgba(255,255,255,0.03)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = halo;
    ctx.fillRect(pointer.x - calmRadius, pointer.y - calmRadius, calmRadius * 2, calmRadius * 2);

    // Very light film grain (materiality)
    if ((now | 0) % 2 === 0) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.08;
      for (let k = 0; k < 140; k++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const s = Math.random() < 0.92 ? 1 : 2;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(step);
  }

  // Init
  resize();
  pointer.x = pointer.tx = W * 0.5;
  pointer.y = pointer.ty = H * 0.55;
  rebuildMask();
  initParticles();

  // Event schedule
  scheduleNext(performance.now());

  // Start
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, W, H);
  requestAnimationFrame(step);
})();
