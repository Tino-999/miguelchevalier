// Presence Engine — "hiersein ist herrlich"
// Generative system driven by STILLNESS, not interaction.
// p5.js — mobile & desktop

let seed;
let particles = [];
let presence = 0;          // 0..1  (how still the user is)
let lastInputTime = 0;

const PRESENCE_RISE = 0.0008;   // how fast presence grows when still
const PRESENCE_DROP = 0.015;    // how fast presence drops on input

let showText = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  colorMode(HSB, 360, 100, 100, 1);
  reseed();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  reseed();
}

function reseed() {
  seed = Date.now();
  randomSeed(seed);
  noiseSeed(seed);

  presence = 0;
  lastInputTime = millis();
  showText = false;

  particles = [];
  const n = floor(map(min(width, height), 320, 1400, 1200, 4200, true));
  for (let i = 0; i < n; i++) {
    particles.push(makeParticle());
  }

  background(230, 20, 3);
}

// ---------------- Presence detection ----------------
function registerInput() {
  lastInputTime = millis();
  presence = max(0, presence - PRESENCE_DROP);
  showText = false;
}

function touchStarted() { registerInput(); return false; }
function touchMoved()   { registerInput(); return false; }
function touchEnded()   { registerInput(); return false; }
function mousePressed() { registerInput(); }
function mouseMoved()   { if (mouseX || mouseY) registerInput(); }
function keyPressed()   { registerInput(); }

// ---------------- Core loop ----------------
function draw() {
  // Presence grows only if there was no input
  const stillFor = millis() - lastInputTime;
  if (stillFor > 200) {
    presence = min(1, presence + PRESENCE_RISE);
  }

  // background persistence
  background(230, 20, 3, 0.08);

  const t = frameCount * 0.006;

  updateParticles(t);
  drawParticles(t);

  if (presence > 0.55) drawEmergence();
  if (presence > 0.78) drawText();

  drawDebugHint();
}

// ---------------- Particles ----------------
function makeParticle() {
  return {
    x: random(width),
    y: random(height),
    vx: 0,
    vy: 0,
    h: random([345, 0, 20, 40, 160, 190, 210]),
    w: random(0.8, 2.0),
    phase: random(TAU)
  };
}

function updateParticles(t) {
  for (let p of particles) {
    const n = noise(p.x * 0.002, p.y * 0.002, t);
    const ang = n * TAU * 2;

    // chaos vs order controlled by presence
    const chaos = lerp(1.8, 0.2, presence);
    const order = lerp(0.1, 1.2, presence);

    p.vx += cos(ang) * chaos;
    p.vy += sin(ang) * chaos;

    // gentle global convergence when present
    const cx = width * 0.5;
    const cy = height * 0.5;
    const dx = cx - p.x;
    const dy = cy - p.y;
    const d = sqrt(dx * dx + dy * dy) + 0.001;

    p.vx += (dx / d) * order * 0.03;
    p.vy += (dy / d) * order * 0.03;

    p.vx *= 0.92;
    p.vy *= 0.92;

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;
  }
}

function drawParticles(t) {
  for (let p of particles) {
    const glow = 0.04 + presence * 0.12;

    strokeWeight(p.w * (0.8 + presence));
    stroke(p.h, 50 + presence * 30, 100, glow);
    point(p.x, p.y);

    // halo
    strokeWeight(p.w * 2.2);
    stroke(p.h, 30, 100, glow * 0.15);
    point(p.x, p.y);
  }
}

// ---------------- Emergence ----------------
function drawEmergence() {
  const r = min(width, height) * 0.28 * smoothstep((presence - 0.55) / 0.45);
  const x = width * 0.5;
  const y = height * 0.5;

  noFill();
  for (let i = 6; i >= 1; i--) {
    stroke(340, 40, 100, 0.02 * i);
    strokeWeight(i * 6);
    circle(x, y, r * (1 + i * 0.18));
  }
}

// ---------------- Text (earned, not shown) ----------------
function drawText() {
  if (!showText) showText = true;

  push();
  resetMatrix();
  textAlign(CENTER, CENTER);

  const s = map(min(width, height), 320, 1200, 1.2, 1.0, true);
  const y = height * 0.82;
  const msg = "hiersein ist herrlich";

  // text flickers if presence not stable
  const stability = map(presence, 0.78, 1.0, 0.2, 1.0, true);

  for (let i = 7; i >= 1; i--) {
    fill(340, 20, 100, 0.02 * i * stability);
    textSize((26 + i) * s);
    text(msg, width * 0.5, y);
  }

  fill(340, 15, 100, 0.35 * stability);
  textSize(28 * s);
  text(msg, width * 0.5, y);

  pop();
}

// ---------------- Minimal hint ----------------
function drawDebugHint() {
  if (presence > 0.15) return;

  push();
  resetMatrix();
  textAlign(CENTER, CENTER);
  fill(0, 0, 100, 0.25);
  textSize(12);
  text("stay still", width * 0.5, height * 0.9);
  pop();
}

// ---------------- Utils ----------------
function smoothstep(x) {
  x = constrain(x, 0, 1);
  return x * x * (3 - 2 * x);
}
