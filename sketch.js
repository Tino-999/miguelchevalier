// "Hiersein ist herrlich" — Generative Light Garden (p5.js)
// Inspired by immersive, luminous, algorithmic installation aesthetics (Miguel Chevalier vibe).
// Touch: Tap = new composition, Drag = bend the field (wind), Two-finger = amplify pulse.

let seed = 0;
let t0 = 0;

let flow = [];
let particles = [];
let blooms = [];

let windX = 0;
let windY = 0;

let pulseBoost = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  colorMode(HSB, 360, 100, 100, 1);
  noFill();
  reseed();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  reseed();
}

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);
  t0 = random(1000);

  windX = 0;
  windY = 0;
  pulseBoost = 0;

  // flow grid
  const cell = max(18, floor(min(width, height) / 40));
  const cols = floor(width / cell) + 2;
  const rows = floor(height / cell) + 2;
  flow = { cell, cols, rows, a: new Array(cols * rows).fill(0) };

  // blooms (soft luminous “flowers”)
  blooms = [];
  const B = floor(map(min(width, height), 320, 1400, 10, 26, true));
  for (let i = 0; i < B; i++) blooms.push(makeBloom());

  // particles (light filaments)
  particles = [];
  const N = floor(map(min(width, height), 320, 1400, 1800, 5200, true));
  for (let i = 0; i < N; i++) particles.push(makeParticle());

  background(230, 20, 3);
}

// ---------------------- Input (mobile-first) ----------------------
function touchStarted() {
  if (touches && touches.length >= 2) pulseBoost = 1.0;
  return false;
}

function touchMoved() {
  windX += constrain(movedX * 0.02, -1.2, 1.2);
  windY += constrain(movedY * 0.02, -1.2, 1.2);
  return false;
}

function touchEnded() {
  // quick tap -> reseed
  if (abs(movedX) < 2 && abs(movedY) < 2) reseed();
  pulseBoost = 0.0;
  return false;
}

function mousePressed() {
  reseed();
}
function mouseDragged() {
  windX += constrain(movedX * 0.015, -1.0, 1.0);
  windY += constrain(movedY * 0.015, -1.0, 1.0);
}

// ---------------------- Draw loop ----------------------
function draw() {
  // soft persistence for luminous trails
  background(230, 20, 3, 0.10);

  // decay wind
  windX *= 0.965;
  windY *= 0.965;
  windX = constrain(windX, -8, 8);
  windY = constrain(windY, -8, 8);

  const t = t0 + frameCount * 0.007;

  // pulse (breathing)
  const pulse = 0.55 + 0.45 * sin(frameCount * 0.045 + t0);
  const amp = (0.85 + 0.55 * pulse) * (1.0 + 0.85 * pulseBoost);

  updateFlow(t, amp);
  drawBlooms(t, amp);
  drawFilaments(t, amp);

  drawMotto(t, amp);
  drawHUD();
}

// ---------------------- Flow field ----------------------
function updateFlow(t, amp) {
  const { cols, rows } = flow;
  const s = 0.006;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = x * s;
      const ny = y * s;

      // layered noise -> swirling vectors
      const n1 = noise(nx, ny, t * 0.7);
      const n2 = noise(nx * 1.7 + 20, ny * 1.7 + 20, t * 1.05);

      let ang = (n1 * TAU * 2.0) + (n2 - 0.5) * 1.3;

      // gentle wind bend (stronger near top = like air)
      const topBias = 1.0 - (y / rows);
      ang += (windX * 0.02) * topBias;
      ang += (windY * 0.02) * topBias;

      // pulse adds subtle precession
      ang += sin(t * 0.6 + x * 0.12 + y * 0.08) * 0.08 * amp;

      flow.a[x + y * cols] = ang;
    }
  }
}

// ---------------------- Particles / Filaments ----------------------
function makeParticle() {
  const m = min(width, height);
  const w = random(0.7, 2.0) * map(m, 320, 1400, 1.6, 1.0, true);
  const hue = random([345, 10, 28, 45, 135, 165, 190, 205, 315]); // festive-ish, but abstract
  return {
    x: random(width),
    y: random(height),
    vx: 0,
    vy: 0,
    w,
    hue,
    sat: random(55, 95),
    bri: random(65, 100),
    a: random(0.03, 0.12),
    life: floor(random(120, 520)),
    phase: random(TAU)
  };
}

function drawFilaments(t, amp) {
  const { cell, cols } = flow;

  for (let p of particles) {
    const px = p.x;
    const py = p.y;

    // sample flow angle
    const gx = floor(px / cell);
    const gy = floor(py / cell);
    const idx = constrain(gx, 0, cols - 1) + constrain(gy, 0, flow.rows - 1) * cols;
    const ang = flow.a[idx] ?? 0;

    // step
    const sp = (0.7 + 1.6 * noise(px * 0.004, py * 0.004, t)) * (0.55 + 0.65 * amp);
    const ax = cos(ang) * sp + windX * 0.03;
    const ay = sin(ang) * sp + windY * 0.03;

    p.vx = p.vx * 0.86 + ax * 0.34;
    p.vy = p.vy * 0.86 + ay * 0.34;

    const nx = px + p.vx;
    const ny = py + p.vy;

    // color modulation
    const glint = noise(px * 0.006, py * 0.006, t * 0.9);
    let h = (p.hue + 20 * sin(t + p.phase)) % 360;
    if (glint > 0.90) h = (200 + 120 * (glint - 0.90) / 0.10) % 360;

    const a = p.a * (0.6 + 0.9 * amp) * (0.7 + 0.7 * glint);
    const w = p.w * (0.9 + 0.5 * amp);

    // luminous stroke: glow + core
    strokeWeight(w * 2.4);
    stroke(h, p.sat * 0.55, 100, a * 0.10);
    line(px, py, nx, ny);

    strokeWeight(w);
    stroke(h, p.sat, p.bri, a);
    line(px, py, nx, ny);

    // occasional star-cross
    if (glint > 0.93 && (frameCount % 2 === 0)) {
      strokeWeight(1);
      stroke(h, 35, 100, a * 0.30);
      const s = 8 * (0.8 + 0.6 * amp);
      line(nx - s, ny, nx + s, ny);
      line(nx, ny - s, nx, ny + s);
    }

    p.x = nx;
    p.y = ny;

    // wrap
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;

    // respawn
    p.life--;
    if (p.life <= 0) {
      p.x = random(width);
      p.y = random(height);
      p.vx = 0;
      p.vy = 0;
      p.life = floor(random(140, 620));
      p.hue = random([345, 10, 28, 45, 135, 165, 190, 205, 315]);
      p.phase = random(TAU);
    }
  }
}

// ---------------------- Blooms (soft “garden lights”) ----------------------
function makeBloom() {
  const m = min(width, height);
  const r = random(35, 120) * map(m, 320, 1400, 1.4, 1.0, true);
  const hue = random([350, 0, 15, 35, 160, 185, 205, 310]);
  return {
    x: random(width),
    y: random(height),
    r,
    hue,
    phase: random(TAU),
    drift: random(0.15, 0.9),
    alpha: random(0.05, 0.16)
  };
}

function drawBlooms(t, amp) {
  for (let b of blooms) {
    // slow drift
    const n1 = noise(b.x * 0.0018, b.y * 0.0018, t * 0.35);
    const n2 = noise(b.x * 0.0018 + 10, b.y * 0.0018 + 10, t * 0.35);
    b.x = (b.x + (n1 - 0.5) * 0.8 * b.drift + windX * 0.04 + width) % width;
    b.y = (b.y + (n2 - 0.5) * 0.6 * b.drift + windY * 0.04 + height) % height;

    const rr = b.r * (0.85 + 0.25 * sin(t * 1.2 + b.phase)) * (0.85 + 0.35 * amp);
    const a = b.alpha * (0.7 + 0.7 * amp);

    noFill();
    for (let k = 5; k >= 1; k--) {
      stroke(b.hue, 70, 100, a * 0.08);
      strokeWeight(k * 7);
      circle(b.x, b.y, rr * (1 + k * 0.22));
    }
    stroke(b.hue, 75, 100, a * 0.12);
    strokeWeight(1.2);
    circle(b.x, b.y, rr * 0.6);
  }
}

// ---------------------- Motto (“Hiersein ist herrlich”) ----------------------
function drawMotto(t, amp) {
  // Draw the motto as a subtle, shifting luminous typographic presence.
  // We avoid heavy fonts: simple canvas text with glow.
  push();
  resetMatrix();
  textAlign(CENTER, CENTER);

  const m = min(width, height);
  const s = map(m, 320, 1400, 1.2, 1.0, true);

  const x = width * 0.5;
  const y = height * 0.84;

  const wob = 1.5 * sin(t * 0.9) + 0.8 * sin(t * 1.7);
  const hue = (340 + 30 * sin(t * 0.6)) % 360;

  const msg = "hiersein ist herrlich";

  // glow layers
  for (let i = 8; i >= 1; i--) {
    const a = 0.018 * i * (0.8 + 0.4 * amp);
    fill(hue, 25, 100, a * 0.10);
    textSize((26 + i * 1.2) * s);
    text(msg, x + wob, y);
  }

  // core
  fill(hue, 18, 100, 0.35 + 0.20 * amp);
  textSize(28 * s);
  text(msg, x + wob, y);

  // tiny underline sparkle (like a signature)
  stroke(hue, 40, 100, 0.10 + 0.08 * amp);
  strokeWeight(1);
  const w = textWidth(msg) * 0.55;
  line(x - w, y + 20 * s, x + w, y + 20 * s);

  pop();
}

// ---------------------- HUD (touch instructions) ----------------------
function drawHUD() {
  push();
  resetMatrix();
  textAlign(LEFT, TOP);
  noStroke();

  const m = min(width, height);
  const s = map(m, 320, 1200, 1.2, 1.0, true);
  const pad = 14 * s;

  fill(0, 0, 0, 0.18);
  rect(pad - 8, pad - 8, 360 * s, 52 * s, 10);

  fill(0, 0, 100, 0.86);
  textSize(14 * s);
  text("Tap: new garden   •   Drag: bend the field   •   Two-finger: pulse", pad, pad);

  fill(0, 0, 100, 0.62);
  textSize(12 * s);
  text(`seed: ${seed}`, pad, pad + 20 * s);

  pop();
}
