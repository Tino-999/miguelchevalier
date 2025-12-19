// Generative Heart Field (p5.js)
// Touch: tap = reseed, drag = wind, two-finger = stronger pulse
// Mobile-first, fullscreen, dark background, luminous heart emerges from flow particles.

let seed = 0;
let particles = [];
let t0 = 0;

let windX = 0;
let windY = 0;

let pulse = 0;
let pulseBoost = 0;

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);
  t0 = random(1000);

  particles = [];
  const m = min(width, height);

  // particle count scales with screen
  const N = floor(map(m, 320, 1400, 1600, 5200, true));

  for (let i = 0; i < N; i++) {
    particles.push(makeParticle(i));
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  colorMode(HSB, 360, 100, 100, 1);
  background(230, 20, 4);
  reseed();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(230, 20, 4);
  reseed();
}

// ---------------------------
// Touch / mouse
// ---------------------------
function touchStarted() {
  // Tap reseed if it's a short touch
  if (touches && touches.length === 2) {
    pulseBoost = 1.0; // two-finger = stronger pulse
  }
  return false;
}

function touchMoved() {
  // drag = wind
  windX += constrain(movedX * 0.015, -0.9, 0.9);
  windY += constrain(movedY * 0.015, -0.9, 0.9);
  return false;
}

function touchEnded() {
  // if it was basically a tap (no drag), reseed
  // (p5 doesn't give tap detection perfectly; this is a simple heuristic)
  if (abs(movedX) < 2 && abs(movedY) < 2) reseed();
  pulseBoost = 0.0;
  return false;
}

function mousePressed() {
  reseed();
}

function mouseDragged() {
  windX += constrain(movedX * 0.012, -0.8, 0.8);
  windY += constrain(movedY * 0.012, -0.8, 0.8);
}

// ---------------------------
// Core: heart attractor + flow field
// ---------------------------

function draw() {
  // soft trail (keeps it luminous)
  background(230, 20, 4, 0.10);

  // wind decays
  windX *= 0.96;
  windY *= 0.96;
  windX = constrain(windX, -8, 8);
  windY = constrain(windY, -8, 8);

  // pulse
  pulse = 0.5 + 0.5 * sin(frameCount * 0.06 + t0);
  const pulseAmp = (0.35 + 0.75 * pulse) * (1.0 + 0.85 * pulseBoost);

  // draw heart scaffold very subtly (optional vibe)
  drawHeartHalo(pulseAmp);

  // update particles
  const t = t0 + frameCount * 0.007;
  for (let p of particles) {
    stepParticle(p, t, pulseAmp);
    renderParticle(p, t, pulseAmp);
  }

  // small HUD on canvas (touch instructions)
  drawHUD();
}

function makeParticle(i) {
  const m = min(width, height);
  return {
    // start scattered
    x: random(width),
    y: random(height),
    vx: random(-0.5, 0.5),
    vy: random(-0.5, 0.5),
    // personal color bias
    h0: random([350, 0, 10, 320, 200]), // reds + a hint of cyan
    w: random(0.7, 2.2) * map(m, 320, 1400, 1.4, 1.0, true),
    a: random(0.04, 0.14),
    phase: random(TAU),
    age: random(0, 1000)
  };
}

// Parametric heart curve (classic)
function heartPoint(u) {
  // u in [0..TAU]
  // produces points roughly in range [-16..16] horizontally, [-17..13] vertically
  const x = 16 * pow(sin(u), 3);
  const y = 13 * cos(u) - 5 * cos(2 * u) - 2 * cos(3 * u) - cos(4 * u);
  return { x, y: -y }; // flip y for screen coords
}

function heartTarget(t, pulseAmp) {
  // A slowly precessing u value for motion on the heart perimeter
  const u = (t * 1.05) % TAU;
  const p = heartPoint(u);

  // scale & center
  const m = min(width, height);
  const s = (m * 0.030) * (1.0 + 0.07 * sin(t * 1.7)) * (0.85 + 0.35 * pulseAmp);

  return {
    x: width * 0.5 + p.x * s,
    y: height * 0.48 + p.y * s
  };
}

function stepParticle(p, t, pulseAmp) {
  p.age += 1;

  // Flow field
  const n = noise(p.x * 0.0022, p.y * 0.0022, t);
  const ang = n * TAU * 2;
  const fx = cos(ang);
  const fy = sin(ang);

  // Heart attractor: each particle chases a slightly different point on the heart
  const u = (t * 0.85 + p.phase + (p.age * 0.0008)) % TAU;
  const hp = heartPoint(u);

  const m = min(width, height);
  const s = (m * 0.030) * (0.85 + 0.35 * pulseAmp);
  const hx = width * 0.5 + hp.x * s;
  const hy = height * 0.48 + hp.y * s;

  // Direction to heart point
  const dx = hx - p.x;
  const dy = hy - p.y;
  const d = sqrt(dx * dx + dy * dy) + 1e-6;

  // Attraction strength increases when far, softens when close (creates a crisp outline)
  const pull = (0.9 + 1.4 * pulseAmp) * (0.7 + 0.6 * (1 - exp(-d / (m * 0.12))));
  const ax = (dx / d) * pull;
  const ay = (dy / d) * pull;

  // Combine: flow + attraction + wind + tiny jitter
  const jitter = 0.15 * (noise(p.phase + t) - 0.5);
  p.vx += fx * 0.55 + ax * 0.18 + windX * 0.02 + jitter;
  p.vy += fy * 0.55 + ay * 0.18 + windY * 0.02 + jitter;

  // Velocity damping (keeps it stable)
  p.vx *= 0.93;
  p.vy *= 0.93;

  // Move
  p.x += p.vx;
  p.y += p.vy;

  // Wrap-around for continuity
  if (p.x < -20) p.x = width + 20;
  if (p.x > width + 20) p.x = -20;
  if (p.y < -20) p.y = height + 20;
  if (p.y > height + 20) p.y = -20;
}

function renderParticle(p, t, pulseAmp) {
  // color evolves: mostly red/pink, sometimes gold/cyan glints
  const glint = noise(p.x * 0.004, p.y * 0.004, t * 0.7);
  let h = (p.h0 + 25 * sin(t + p.phase)) % 360;

  // occasional icy glint
  if (glint > 0.86) h = 190 + 40 * (glint - 0.86) / 0.14;

  const sat = 65 + 35 * (0.5 + 0.5 * sin(p.phase + t * 1.3));
  const bri = 70 + 30 * glint;

  // alpha stronger near heart (approx: use noise as proxy + pulse)
  const a = p.a * (0.7 + 0.7 * pulseAmp) * (0.8 + 0.6 * glint);

  // fat glow
  strokeWeight(p.w * 2.2);
  stroke(h, sat * 0.6, 100, a * 0.10);
  point(p.x, p.y);

  // core
  strokeWeight(p.w);
  stroke(h, sat, bri, a);
  point(p.x, p.y);

  // tiny star cross sometimes for “spark”
  if (glint > 0.92) {
    strokeWeight(1);
    stroke(h, 40, 100, a * 0.35);
    const s = 7 * (0.8 + 0.6 * pulseAmp);
    line(p.x - s, p.y, p.x + s, p.y);
    line(p.x, p.y - s, p.x, p.y + s);
  }
}

function drawHeartHalo(pulseAmp) {
  // subtle glowing heart outline (not a solid line)
  const steps = 220;
  const m = min(width, height);
  const s = (m * 0.030) * (0.85 + 0.35 * pulseAmp);

  for (let layer = 4; layer >= 1; layer--) {
    const a = 0.018 * layer;
    stroke(350, 60, 100, a);
    strokeWeight((layer * 2.2) * map(m, 320, 1400, 1.5, 1.0, true));

    beginShape();
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * TAU;
      const p = heartPoint(u);
      const x = width * 0.5 + p.x * s;
      const y = height * 0.48 + p.y * s;
      curveVertex(x, y);
    }
    endShape();
  }
}

function drawHUD() {
  push();
  resetMatrix();
  textAlign(LEFT, TOP);
  noStroke();

  const m = min(width, height);
  const s = map(m, 320, 1200, 1.2, 1.0, true);
  const pad = 14 * s;

  fill(0, 0, 0, 0.18);
  rect(pad - 8, pad - 8, 340 * s, 62 * s, 10);

  fill(0, 0, 100, 0.86);
  textSize(14 * s);
  text("Generative Heart", pad, pad);

  fill(0, 0, 100, 0.68);
  textSize(12 * s);
  text("Tap: new heart  •  Drag: bend the field  •  Two-finger: pulse", pad, pad + 20 * s);

  pop();
}
