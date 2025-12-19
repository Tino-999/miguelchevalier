// Alpine Story — p5.js
// Act 1: Sunrise behind Alps
// Act 2: Church tower appears
// Act 3: Apple orchard grows
// Touch: Tap = next act / restart, Swipe = wind

let seed = 0;

let act = 1;            // 1..3
let actStart = 0;       // frameCount when act began
let wind = 0;

let clouds = [];
let trees = [];
let apples = [];

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);

  act = 1;
  actStart = frameCount;
  wind = 0;

  clouds = [];
  trees = [];
  apples = [];

  const cloudCount = floor(map(min(windowWidth, windowHeight), 320, 1400, 6, 12, true));
  for (let i = 0; i < cloudCount; i++) clouds.push(makeCloud());

  // orchard placeholders (spawn later)
  const treeCount = floor(map(min(width, height), 320, 1400, 10, 26, true));
  for (let i = 0; i < treeCount; i++) trees.push(makeTree(i, treeCount));
}

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

// ----------------- Input -----------------
function touchStarted() { return false; }
function touchMoved() {
  wind += constrain(movedX * 0.03, -1.4, 1.4);
  return false;
}
function touchEnded() {
  nextAct();
  return false;
}
function mousePressed() { nextAct(); }

function nextAct() {
  // If current act still mid-animation, jump to its end
  const p = actProgress();
  if (p < 0.98) {
    actStart -= 99999; // hack: makes progress ~1
    return;
  }
  // advance act
  if (act < 3) {
    act++;
    actStart = frameCount;
  } else {
    reseed();
  }
}

function actProgress() {
  // each act duration in frames (scaled a bit with screen size)
  const m = min(width, height);
  const speed = map(m, 320, 1400, 1.15, 0.85, true);
  const dur = (act === 1) ? 380 : (act === 2 ? 320 : 520);
  return constrain((frameCount - actStart) / (dur * speed), 0, 1);
}

// --------------- Draw loop ---------------
function draw() {
  wind *= 0.96;
  wind = constrain(wind, -8, 8);

  // background sky depends on act 1 sunrise progress
  const p1 = (act === 1) ? actProgress() : 1;
  drawSky(p1);

  // far glow / haze
  drawHaze(p1);

  // Alps always present
  drawAlps(p1);

  // Act 1: sun
  if (act >= 1) drawSunrise(p1);

  // clouds always, slightly different mood early/late
  drawClouds();

  // Act 2+: church tower
  if (act >= 2) {
    const p2 = (act === 2) ? actProgress() : 1;
    drawChurchTower(p2);
  }

  // Act 3: orchard grows
  if (act >= 3) {
    const p3 = actProgress();
    drawOrchard(p3);
  }

  drawGroundForeground();

  drawHUD();
}

// ----------------- Scene elements -----------------
function drawSky(pSun) {
  // pSun 0..1 controls dawn -> day
  // Use vertical gradient with HSB
  noStroke();
  for (let y = 0; y < height; y += 3) {
    const t = y / height;

    // dawn: deep blue -> warm orange near horizon
    const hDawnTop = 220, sDawnTop = 55, bDawnTop = 18;
    const hDawnHor = 25,  sDawnHor = 70, bDawnHor = 30;

    // day: rich blue -> pale near horizon
    const hDayTop  = 205, sDayTop  = 45, bDayTop  = 35;
    const hDayHor  = 195, sDayHor  = 25, bDayHor  = 45;

    const hTop = lerp(hDawnTop, hDayTop, pSun);
    const sTop = lerp(sDawnTop, sDayTop, pSun);
    const bTop = lerp(bDawnTop, bDayTop, pSun);

    const hHor = lerp(hDawnHor, hDayHor, pSun);
    const sHor = lerp(sDawnHor, sDayHor, pSun);
    const bHor = lerp(bDawnHor, bDayHor, pSun);

    const h = lerp(hTop, hHor, pow(t, 1.7));
    const s = lerp(sTop, sHor, pow(t, 1.7));
    const b = lerp(bTop, bHor, pow(t, 1.7));

    fill(h, s, b, 1);
    rect(0, y, width, 3);
  }
}

function drawHaze(pSun) {
  // subtle horizon haze
  noStroke();
  const horizon = height * 0.62;
  for (let i = 0; i < 8; i++) {
    const a = 0.06 * (1 - i / 8) * (0.4 + 0.6 * pSun);
    fill(30, 20, 100, a);
    rect(0, horizon - i * 18, width, 28);
  }
}

function drawAlps(pSun) {
  // layered mountain silhouettes
  const horizon = height * 0.62;
  const layers = 3;
  for (let L = 0; L < layers; L++) {
    const z = L / (layers - 1);
    const yBase = horizon + z * 70;
    const amp = lerp(130, 55, z);
    const freq = lerp(0.006, 0.012, z);

    // color: farther = lighter, closer = darker
    const h = 220;
    const s = lerp(18, 30, 1 - z);
    const b = lerp(18, 10, 1 - z) + 12 * pSun;
    fill(h, s, b, 1);
    noStroke();

    beginShape();
    vertex(0, height);
    for (let x = 0; x <= width; x += 16) {
      const n = noise(seed * 0.0001 + x * freq, 0.7 + z * 3);
      const ridge = yBase - n * amp - pow(noise(x * freq * 1.6, z * 2.2), 2) * 40;
      curveVertex(x, ridge);
    }
    vertex(width, height);
    endShape(CLOSE);

    // snow caps (subtle) on front layer when sun is up
    if (L === 1 || L === 2) drawSnowCaps(yBase, amp, freq, z, pSun);
  }
}

function drawSnowCaps(yBase, amp, freq, z, pSun) {
  if (pSun < 0.4) return;
  noFill();
  stroke(0, 0, 100, 0.08 * pSun);
  strokeWeight(1.1);

  beginShape();
  for (let x = 0; x <= width; x += 18) {
    const n = noise(seed * 0.0001 + x * freq, 0.7 + z * 3);
    const ridge = yBase - n * amp;
    const cap = ridge + 10 + noise(x * 0.02, z * 4) * 10;
    curveVertex(x, cap);
  }
  endShape();
}

function drawSunrise(p) {
  // sun rises behind mountains: from below horizon to above
  const horizon = height * 0.62;
  const x = width * 0.5 + sin((seed % 1000) * 0.01) * width * 0.08;
  const y = lerp(horizon + 70, horizon - 90, smoothstep(p));
  const r = lerp(28, 60, smoothstep(p)) * map(min(width, height), 320, 1400, 1.25, 1.0, true);

  // glow
  noStroke();
  for (let i = 10; i >= 1; i--) {
    const a = 0.035 * i * (0.6 + 0.8 * p);
    fill(35, 70, 100, a * 0.08);
    circle(x, y, r * (1 + i * 0.25));
  }

  // core
  fill(38, 80, 100, 0.95);
  circle(x, y, r * 1.1);

  // rays (subtle)
  stroke(38, 55, 100, 0.10 * p);
  strokeWeight(1);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    const rr1 = r * 1.25;
    const rr2 = r * 1.75 + noise(k * 0.2, seed * 0.001) * 18;
    line(x + cos(a) * rr1, y + sin(a) * rr1, x + cos(a) * rr2, y + sin(a) * rr2);
  }
}

function makeCloud() {
  return {
    x: random(width),
    y: random(height * 0.08, height * 0.38),
    s: random(0.6, 1.3),
    v: random(0.12, 0.35),
    p: random(1000),
  };
}

function drawClouds() {
  const mood = (act === 1) ? actProgress() : 1; // brighter later
  for (let c of clouds) {
    c.x += c.v + wind * 0.10;
    c.p += 0.006;
    if (c.x > width + 160) c.x = -160;

    const a = 0.06 + 0.05 * mood;
    noStroke();
    // layered puffs
    const base = 0.65 + 0.35 * noise(c.p);
    for (let i = 0; i < 6; i++) {
      const ox = (i - 2.5) * 40 * c.s + noise(c.p + i) * 18;
      const oy = noise(c.p + 10 + i) * 14;
      const rr = 70 * c.s * (0.75 + 0.35 * noise(c.p + 30 + i)) * base;
      fill(0, 0, 100, a * (0.55 - i * 0.04));
      circle(c.x + ox, c.y + oy, rr);
    }
  }
}

function drawChurchTower(p) {
  // build from ground up near right third (Bavarian vibe)
  const groundY = height * 0.78;
  const x = width * 0.72;
  const w = min(width, height) * 0.075;
  const h = min(width, height) * 0.42;

  const grow = smoothstep(p);

  // silhouette with soft glow
  push();
  translate(x, groundY);
  const hh = h * grow;

  // glow
  for (let k = 6; k >= 1; k--) {
    stroke(45, 25, 100, 0.02);
    strokeWeight(k * 6);
    noFill();
    churchShape(w, hh);
  }

  // body
  stroke(40, 12, 95, 0.55);
  strokeWeight(2.2);
  fill(35, 8, 20, 0.65);
  churchShapeFilled(w, hh);

  // windows (appear late)
  if (p > 0.55) {
    const ww = w * 0.18;
    const wy = -hh * 0.55;
    noStroke();
    fill(50, 60, 100, 0.22);
    rect(-ww * 0.5, wy, ww, ww * 1.6, 6);
    rect(-ww * 0.5, wy + ww * 2.1, ww, ww * 1.6, 6);
  }

  pop();
}

function churchShape(w, hh) {
  // outline (no fill)
  beginShape();
  // base
  vertex(-w * 0.55, 0);
  vertex(-w * 0.55, -hh * 0.75);
  // belfry step
  vertex(-w * 0.40, -hh * 0.75);
  vertex(-w * 0.40, -hh * 0.90);
  vertex(-w * 0.28, -hh * 0.90);
  // spire
  vertex(0, -hh);
  vertex(w * 0.28, -hh * 0.90);
  vertex(w * 0.40, -hh * 0.90);
  vertex(w * 0.40, -hh * 0.75);
  vertex(w * 0.55, -hh * 0.75);
  vertex(w * 0.55, 0);
  endShape(CLOSE);
}

function churchShapeFilled(w, hh) {
  beginShape();
  vertex(-w * 0.55, 0);
  vertex(-w * 0.55, -hh * 0.75);
  vertex(-w * 0.40, -hh * 0.75);
  vertex(-w * 0.40, -hh * 0.90);
  vertex(-w * 0.28, -hh * 0.90);
  vertex(0, -hh);
  vertex(w * 0.28, -hh * 0.90);
  vertex(w * 0.40, -hh * 0.90);
  vertex(w * 0.40, -hh * 0.75);
  vertex(w * 0.55, -hh * 0.75);
  vertex(w * 0.55, 0);
  endShape(CLOSE);
}

function drawOrchard(p) {
  // trees grow across the valley foreground, apples appear later
  const grow = smoothstep(p);

  for (let t of trees) {
    drawTree(t, grow);
  }

  // apples appear after trunk/branches formed
  if (p > 0.55) {
    const aP = smoothstep(map(p, 0.55, 1.0, 0, 1, true));
    drawApples(aP);
  }
}

function makeTree(i, n) {
  // distribute in two bands left + center
  const band = (i % 2 === 0) ? 0.18 : 0.52;
  const x = width * (band + random(-0.12, 0.22));
  const groundY = height * 0.78 + random(-6, 10);
  const size = random(0.75, 1.35);
  const lean = random(-0.08, 0.08);
  const hue = random([110, 120, 135]); // green-ish
  return { x, groundY, size, lean, hue, id: i };
}

function drawTree(tr, g) {
  const baseH = min(width, height) * 0.22 * tr.size;
  const trunkH = baseH * (0.55 + 0.45 * g);
  const crownR = baseH * (0.55 + 0.65 * g);

  // trunk
  push();
  translate(tr.x, tr.groundY);
  rotate(tr.lean);

  // trunk glow
  for (let k = 4; k >= 1; k--) {
    stroke(30, 20, 100, 0.015);
    strokeWeight(k * 5);
    line(0, 0, 0, -trunkH);
  }

  stroke(28, 35, 25, 0.65);
  strokeWeight(3.0);
  line(0, 0, 0, -trunkH);

  // simple branches
  if (g > 0.25) {
    const bg = smoothstep(map(g, 0.25, 1.0, 0, 1, true));
    strokeWeight(2.0);
    const b1 = trunkH * 0.30;
    const b2 = trunkH * 0.45;
    line(0, -b1, -18 * tr.size * bg, -b1 - 22 * tr.size * bg);
    line(0, -b2,  20 * tr.size * bg, -b2 - 24 * tr.size * bg);
  }

  // crown (apple tree blobs)
  if (g > 0.18) {
    const cg = smoothstep(map(g, 0.18, 1.0, 0, 1, true));
    noStroke();
    const cx = 0;
    const cy = -trunkH - crownR * 0.15;

    // layered foliage with slight wind sway
    const sway = wind * 0.12 + sin((frameCount + tr.id * 30) * 0.01) * 0.6;
    for (let i = 10; i >= 1; i--) {
      const a = 0.030 * i * cg;
      fill(tr.hue, 45, 28 + 24 * cg, a * 0.08);
      circle(cx + sway * i, cy, crownR * (1 + i * 0.12));
    }

    for (let i = 0; i < 9; i++) {
      const ox = (noise(tr.id * 3 + i) - 0.5) * crownR * 0.85 + sway * 2.5;
      const oy = (noise(tr.id * 7 + i) - 0.5) * crownR * 0.55;
      const rr = crownR * (0.35 + 0.25 * noise(tr.id * 11 + i)) * cg;
      fill(tr.hue + random(-6, 6), 55, 32 + 30 * cg, 0.26);
      circle(cx + ox, cy + oy, rr);
    }
  }

  pop();
}

function drawApples(aP) {
  // sprinkle apples around crowns; deterministic positions
  noStroke();
  for (let tr of trees) {
    const baseH = min(width, height) * 0.22 * tr.size;
    const trunkH = baseH * 0.95;
    const crownR = baseH * 1.10;

    const cx = tr.x;
    const cy = tr.groundY - trunkH - crownR * 0.15;

    const count = 4 + (tr.id % 5);
    for (let i = 0; i < count; i++) {
      // deterministic pseudo-random per tree
      const rx = (noise(tr.id * 13.7 + i * 9.1) - 0.5) * crownR * 0.9;
      const ry = (noise(tr.id * 21.3 + i * 6.2) - 0.5) * crownR * 0.55;
      const r = (6 + 6 * noise(tr.id * 4.2 + i * 3.3)) * aP;

      const shine = 0.4 + 0.6 * noise((frameCount * 0.02) + tr.id + i);
      // apples: red with tiny highlight
      fill(0, 70, 55 + 35 * shine, 0.22 * aP);
      circle(cx + rx, cy + ry, r * 2.3);
      fill(0, 75, 85, 0.16 * aP);
      circle(cx + rx - r * 0.35, cy + ry - r * 0.35, r * 0.8);
    }
  }
}

function drawGroundForeground() {
  const y = height * 0.78;

  // ground gradient
  noStroke();
  for (let i = 0; i < 10; i++) {
    const a = 0.10 + i * 0.02;
    fill(110, 35, 12 + i * 2, a);
    rect(0, y + i * 16, width, 20);
  }

  // subtle grass strokes
  stroke(110, 35, 25, 0.06);
  strokeWeight(1);
  for (let x = 0; x < width; x += 10) {
    const h = 12 + noise(x * 0.02, seed * 0.01) * 18;
    line(x, y + 60, x + wind * 0.2, y + 60 - h);
  }
}

// ----------------- HUD -----------------
function drawHUD() {
  const p = actProgress();
  const textA = (act === 1) ? "Sunrise" : (act === 2 ? "Church tower" : "Apple orchard");
  const hint = "Tap: next / finish  •  Swipe: wind";

  push();
  resetMatrix();
  textAlign(LEFT, TOP);
  noStroke();

  const s = map(min(width, height), 320, 1200, 1.2, 1.0, true);
  const pad = 14 * s;

  fill(0, 0, 0, 0.18);
  rect(pad - 8, pad - 8, 330 * s, 56 * s, 10);

  fill(0, 0, 100, 0.86);
  textSize(14 * s);
  text(`Alpine Story — ${textA}`, pad, pad);

  fill(0, 0, 100, 0.66);
  textSize(12 * s);
  text(hint, pad, pad + 20 * s);

  // tiny progress bar
  fill(0, 0, 100, 0.20);
  rect(pad, pad + 40 * s, 280 * s, 6 * s, 4);
  fill(45, 35, 100, 0.35);
  rect(pad, pad + 40 * s, 280 * s * p, 6 * s, 4);

  pop();
}

// --------------- Utility ---------------
function smoothstep(x) {
  x = constrain(x, 0, 1);
  return x * x * (3 - 2 * x);
}
