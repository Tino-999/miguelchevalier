// Storyboard Generative Scene — p5.js (mobile-first)
// Tap: skip to next scene / fast-forward current
// Swipe: wind (affects cloud/rain/water a bit)

let seed = 0;
let wind = 0;

let scene = 0;
let sceneStart = 0;

let lake;
let swimmer;
let cloud;
let carousel;
let tower;

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

  wind = 0;
  scene = 0;
  sceneStart = frameCount;

  lake = { rip: random(1000) };
  swimmer = { phase: random(TAU), x0: random(-0.25, 0.25) };
  cloud = { x: -200, y: height * 0.18, vx: 1.5, raining: false, gone: false };
  carousel = { ang: 0 };
  tower = { grow: 0 };
}

// ---------------- Input ----------------
function touchMoved() {
  wind += constrain(movedX * 0.03, -1.4, 1.4);
  return false;
}
function touchEnded() {
  skipOrNext();
  return false;
}
function mousePressed() {
  skipOrNext();
}

function skipOrNext() {
  const p = sceneProgress();
  if (p < 0.92) {
    // fast-forward current scene
    sceneStart -= 999999;
  } else {
    // next scene
    if (scene < 10) {
      scene++;
      sceneStart = frameCount;
    } else {
      reseed();
    }
  }
}

function sceneProgress() {
  const m = min(width, height);
  const speed = map(m, 320, 1400, 1.2, 0.85, true);
  const durations = [240, 260, 260, 260, 270, 300, 280, 320, 300, 320, 340];
  const dur = durations[constrain(scene, 0, durations.length - 1)] * speed;
  return constrain((frameCount - sceneStart) / dur, 0, 1);
}

// --------------- Draw ---------------
function draw() {
  wind *= 0.965;
  wind = constrain(wind, -10, 10);

  // Determine global day/night factor based on scene (night arrives later)
  const nightTarget = (scene >= 7) ? 1 : 0;
  const nightMix = smoothstep(nightTarget ? mapSceneMix(7, 8) : 0); // 0..1
  drawSky(nightMix);

  // Matterhorn always (first thing)
  drawMatterhorn(mapSceneMix(0, 1));

  // Sun rises (scene 1+)
  if (scene >= 1) drawSun(mapSceneMix(1, 2), nightMix);

  // Lake appears (scene 2+)
  if (scene >= 2) drawLake(mapSceneMix(2, 3), nightMix);

  // Swimmer (scene 3+)
  if (scene >= 3) drawSwimmer(mapSceneMix(3, 4));

  // Oktoberfest tent (scene 4+)
  if (scene >= 4) drawTent(mapSceneMix(4, 5));

  // Bavarian schuhplattler dancer (scene 5+)
  if (scene >= 5) drawDancer(mapSceneMix(5, 6));

  // Big oak (scene 6+)
  if (scene >= 6) drawOak(mapSceneMix(6, 7), nightMix);

  // Cloud flies in, rains over oak, then leaves (scene 7+)
  if (scene >= 7) drawCloudAndRain(mapSceneMix(7, 9), nightMix);

  // Night + moon rises (scene 8+)
  if (scene >= 8) drawMoon(mapSceneMix(8, 9), nightMix);

  // Carousel with white elephant (scene 9+)
  if (scene >= 9) drawCarousel(mapSceneMix(9, 10), nightMix);

  // Tower forms (scene 10)
  if (scene >= 10) drawTower(mapSceneMix(10, 11), nightMix);

  drawHUD();
}

// Helper: returns a smooth 0..1 fade for a scene interval [a..b]
function mapSceneMix(a, b) {
  if (scene < a) return 0;
  if (scene > b) return 1;
  // if scene == a use its progress; if between, treat as 1
  if (scene === a) return smoothstep(sceneProgress());
  if (scene === b) return 0; // will be driven by next call
  return 1;
}

// ---------------- Visuals ----------------
function drawSky(nightMix) {
  noStroke();
  for (let y = 0; y < height; y += 3) {
    const t = y / height;

    // day gradient
    const hDayTop = 205, sDayTop = 40, bDayTop = 36;
    const hDayHor = 195, sDayHor = 20, bDayHor = 48;

    // night gradient
    const hNigTop = 235, sNigTop = 55, bNigTop = 10;
    const hNigHor = 230, sNigHor = 45, bNigHor = 14;

    const hTop = lerp(hDayTop, hNigTop, nightMix);
    const sTop = lerp(sDayTop, sNigTop, nightMix);
    const bTop = lerp(bDayTop, bNigTop, nightMix);

    const hHor = lerp(hDayHor, hNigHor, nightMix);
    const sHor = lerp(sDayHor, sNigHor, nightMix);
    const bHor = lerp(bDayHor, bNigHor, nightMix);

    const e = pow(t, 1.7);
    fill(lerp(hTop, hHor, e), lerp(sTop, sHor, e), lerp(bTop, bHor, e), 1);
    rect(0, y, width, 3);
  }

  // stars at night
  if (nightMix > 0.25) {
    const a = 0.22 * (nightMix - 0.25) / 0.75;
    stroke(0, 0, 100, a);
    strokeWeight(1);
    const n = floor(map(min(width, height), 320, 1400, 70, 220, true));
    randomSeed(seed + 12345);
    for (let i = 0; i < n; i++) {
      const x = random(width);
      const y = random(height * 0.55);
      point(x, y);
    }
  }
}

function drawMatterhorn(intro) {
  // silhouette mountain with slight highlight later
  const horizon = height * 0.62;
  const baseY = horizon + 90 * (1 - intro);
  const peakX = width * 0.46;
  const peakY = horizon - 210 * intro;
  const leftX = width * 0.18;
  const rightX = width * 0.74;

  // glow
  noFill();
  for (let k = 7; k >= 1; k--) {
    stroke(220, 30, 100, 0.012 * intro);
    strokeWeight(k * 10);
    beginShape();
    vertex(leftX, baseY);
    vertex(peakX, peakY);
    vertex(rightX, baseY);
    endShape();
  }

  // body
  noStroke();
  fill(225, 22, 12, 1);
  beginShape();
  vertex(0, height);
  vertex(leftX, baseY);
  vertex(peakX, peakY);
  vertex(rightX, baseY);
  vertex(width, height);
  endShape(CLOSE);

  // snow cap hint (subtle)
  if (intro > 0.5) {
    stroke(0, 0, 100, 0.10 * (intro - 0.5) / 0.5);
    strokeWeight(2);
    noFill();
    beginShape();
    vertex(peakX - 30, peakY + 55);
    vertex(peakX, peakY + 40);
    vertex(peakX + 40, peakY + 70);
    endShape();
  }
}

function drawSun(p, nightMix) {
  const horizon = height * 0.62;
  const x = width * 0.58;
  const y = lerp(horizon + 80, horizon - 120, smoothstep(p));
  const r = min(width, height) * 0.055 * (0.75 + 0.35 * p) * (1 - 0.9 * nightMix);

  if (nightMix > 0.6) return;

  noStroke();
  for (let i = 10; i >= 1; i--) {
    fill(38, 75, 100, 0.012 * i * p);
    circle(x, y, r * (1 + i * 0.28));
  }
  fill(38, 80, 100, 0.9);
  circle(x, y, r * 1.1);
}

function drawLake(p, nightMix) {
  const horizon = height * 0.62;
  const y0 = horizon + 60;
  const y1 = height * 0.92;

  // lake shape
  noStroke();
  const h = lerp(200, 220, nightMix);
  const s = lerp(45, 35, nightMix);
  const b = lerp(22, 12, nightMix);

  fill(h, s, b, 0.90 * p);
  beginShape();
  vertex(0, y0);
  vertex(width, y0);
  vertex(width, y1);
  vertex(0, y1);
  endShape(CLOSE);

  // ripples
  stroke(h, s, 55, 0.10 * p);
  strokeWeight(1.2);
  lake.rip += 0.01;
  for (let i = 0; i < 24; i++) {
    const yy = y0 + i * (y1 - y0) / 24;
    const amp = (2 + i * 0.25) * p;
    beginShape();
    for (let x = 0; x <= width; x += 18) {
      const n = noise(x * 0.01, yy * 0.01, lake.rip);
      const wv = sin(x * 0.02 + lake.rip * 2 + i) * amp + (n - 0.5) * amp;
      curveVertex(x, yy + wv + wind * 0.05);
    }
    endShape();
  }
}

function drawSwimmer(p) {
  const horizon = height * 0.62;
  const y0 = horizon + 60;
  const y1 = height * 0.92;

  const t = frameCount * 0.03 + swimmer.phase;
  const x = width * (0.48 + swimmer.x0) + sin(t * 0.7) * 120;
  const y = lerp(y1, y0 + (y1 - y0) * 0.35, p) + sin(t) * 4;

  // little wake
  stroke(0, 0, 100, 0.10 * p);
  strokeWeight(2);
  noFill();
  arc(x - 10, y + 12, 40, 16, 0.1 * PI, 0.9 * PI);
  arc(x + 10, y + 12, 40, 16, 0.1 * PI, 0.9 * PI);

  // swimmer stick-ish
  stroke(0, 0, 100, 0.55 * p);
  strokeWeight(3);
  // head
  point(x, y);
  // arms splashing
  line(x - 18, y + 6, x - 2, y + 14);
  line(x + 18, y + 6, x + 2, y + 14);
}

function drawTent(p) {
  const groundY = height * 0.78;
  const x = width * 0.22;
  const w = min(width, height) * 0.30;
  const h = min(width, height) * 0.16;

  const g = smoothstep(p);

  // glow
  for (let k = 6; k >= 1; k--) {
    stroke(50, 25, 100, 0.01 * g);
    strokeWeight(k * 8);
    noFill();
    tentOutline(x, groundY, w * g, h * g);
  }

  // body
  noStroke();
  fill(210, 30, 22, 0.65 * g);
  tentBody(x, groundY, w * g, h * g);

  // stripes
  stroke(0, 0, 100, 0.18 * g);
  strokeWeight(3);
  for (let i = -4; i <= 4; i++) {
    const xx = x + i * (w * 0.10) * g;
    line(xx, groundY - h * g, xx, groundY);
  }

  // banner
  noStroke();
  fill(45, 55, 100, 0.22 * g);
  rect(x - w * 0.20 * g, groundY - h * 1.05 * g, w * 0.40 * g, h * 0.25 * g, 10);
}

function tentOutline(x, groundY, w, h) {
  beginShape();
  vertex(x - w * 0.55, groundY);
  vertex(x - w * 0.40, groundY - h);
  vertex(x, groundY - h * 1.15);
  vertex(x + w * 0.40, groundY - h);
  vertex(x + w * 0.55, groundY);
  endShape(CLOSE);
}
function tentBody(x, groundY, w, h) {
  beginShape();
  vertex(x - w * 0.55, groundY);
  vertex(x - w * 0.40, groundY - h);
  vertex(x, groundY - h * 1.15);
  vertex(x + w * 0.40, groundY - h);
  vertex(x + w * 0.55, groundY);
  endShape(CLOSE);
}

function drawDancer(p) {
  const g = smoothstep(p);
  const groundY = height * 0.78;
  const x = width * 0.40;
  const y = groundY;

  const t = frameCount * 0.06;
  const bounce = sin(t) * 6 * g;
  const clap = 0.5 + 0.5 * sin(t * 1.7);

  // simple “schuhplattler” stick figure with moving arms/legs
  stroke(0, 0, 100, 0.55 * g);
  strokeWeight(4);

  const headY = y - 95 * g + bounce;
  point(x, headY);

  // body
  line(x, headY + 10, x, y - 40 * g + bounce);

  // arms clapping thighs
  const armA = lerp(0.2, 1.0, clap);
  line(x, headY + 25, x - 35 * g, headY + (55 + 20 * armA) * g);
  line(x, headY + 25, x + 35 * g, headY + (55 + 20 * armA) * g);

  // legs kicking
  const kick = sin(t * 1.2);
  line(x, y - 40 * g + bounce, x - (18 + 22 * kick) * g, y + (-5 + 18 * abs(kick)) * g);
  line(x, y - 40 * g + bounce, x + (18 + 22 * -kick) * g, y + (-5 + 18 * abs(kick)) * g);

  // hat
  strokeWeight(3);
  line(x - 18 * g, headY - 10 * g, x + 18 * g, headY - 10 * g);
}

function drawOak(p, nightMix) {
  const g = smoothstep(p);
  const groundY = height * 0.78;
  const x = width * 0.78;

  const trunkH = min(width, height) * 0.28 * g;
  const trunkW = min(width, height) * 0.03;

  // trunk glow + trunk
  for (let k = 6; k >= 1; k--) {
    stroke(45, 25, 100, 0.010 * g);
    strokeWeight(k * 9);
    line(x, groundY, x, groundY - trunkH);
  }
  stroke(28, 35, 25, 0.70 * g);
  strokeWeight(6);
  line(x, groundY, x, groundY - trunkH);

  // branches
  strokeWeight(4);
  const by = groundY - trunkH * 0.65;
  line(x, by, x - 60 * g, by - 45 * g);
  line(x, by, x + 70 * g, by - 35 * g);

  // canopy
  noStroke();
  const hue = lerp(120, 130, nightMix);
  for (let i = 9; i >= 1; i--) {
    fill(hue, 45, lerp(28, 18, nightMix), 0.05 * g);
    circle(x + wind * 0.15 * i, groundY - trunkH - 30 * g, (120 + i * 35) * g);
  }
  for (let i = 0; i < 10; i++) {
    const ox = (noise(seed + i * 9) - 0.5) * 140 * g + wind * 0.8;
    const oy = (noise(seed + i * 13) - 0.5) * 90 * g;
    fill(hue + random(-6, 6), 55, lerp(35, 20, nightMix), 0.22 * g);
    circle(x + ox, groundY - trunkH - 40 * g + oy, (60 + 40 * noise(i * 2)) * g);
  }
}

function drawCloudAndRain(p, nightMix) {
  // p goes 0..1 across scenes 7..9
  // phase: fly in (0..0.35), rain (0.35..0.7), fly out (0.7..1)
  const inP = smoothstep(map(p, 0.00, 0.35, 0, 1, true));
  const rainP = smoothstep(map(p, 0.35, 0.70, 0, 1, true));
  const outP = smoothstep(map(p, 0.70, 1.00, 0, 1, true));

  const xIn = lerp(-220, width * 0.78, inP);
  const xOut = lerp(width * 0.78, width + 260, outP);
  const x = (p < 0.70) ? xIn : xOut;
  const y = height * 0.17 + sin(frameCount * 0.01) * 6;

  // cloud
  noStroke();
  const a = 0.16 + 0.16 * (1 - nightMix);
  for (let i = 0; i < 7; i++) {
    const ox = (i - 3) * 40 + noise(seed + i * 10, frameCount * 0.01) * 12;
    const oy = noise(seed + i * 20, frameCount * 0.01) * 10;
    const rr = 95 + noise(seed + i * 30) * 40;
    fill(0, 0, 100, a * (0.75 - i * 0.06));
    circle(x + ox + wind * 0.6, y + oy, rr);
  }

  // rain over oak (center at oak x)
  if (rainP > 0.02) {
    const oakX = width * 0.78;
    const top = y + 40;
    const bottom = height * 0.80;
    stroke(205, 30, 100, 0.12 * rainP);
    strokeWeight(2);
    for (let i = 0; i < 70; i++) {
      const rx = oakX + (noise(seed + i * 3, frameCount * 0.02) - 0.5) * 220 + wind * 1.5;
      const ry = top + noise(seed + i * 7, frameCount * 0.02) * (bottom - top);
      line(rx, ry, rx + wind * 0.2, ry + 22);
    }
  }
}

function drawMoon(p, nightMix) {
  if (nightMix < 0.2) return;
  const x = width * 0.62;
  const horizon = height * 0.62;
  const y = lerp(horizon + 90, height * 0.16, smoothstep(p));
  const r = min(width, height) * 0.05;

  noStroke();
  fill(60, 10, 100, 0.22 * nightMix);
  circle(x, y, r * 2.6);

  fill(60, 12, 100, 0.85 * nightMix);
  circle(x, y, r * 2.0);

  // crescent cut
  fill(235, 55, 10, 1); // match night sky tone-ish
  circle(x + r * 0.55, y - r * 0.15, r * 1.8);
}

function drawCarousel(p, nightMix) {
  const g = smoothstep(p);
  const groundY = height * 0.78;
  const x = width * 0.50;
  const y = groundY;

  // rotate
  carousel.ang += 0.02 * (0.3 + 0.7 * g);

  // base
  noStroke();
  fill(300, 20, 18, 0.65 * g);
  rect(x - 140 * g, y - 20 * g, 280 * g, 30 * g, 12);

  // canopy
  fill(45, 55, 100, 0.18 * g);
  ellipse(x, y - 140 * g, 320 * g, 140 * g);

  // poles
  stroke(0, 0, 100, 0.18 * g);
  strokeWeight(3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + carousel.ang;
    const px = x + cos(a) * 110 * g;
    line(px, y - 20 * g, px, y - 130 * g);
  }

  // white elephant on carousel (simple, readable)
  const ex = x + cos(carousel.ang) * 110 * g;
  const ey = y - 55 * g + sin(carousel.ang) * 8;

  drawElephant(ex, ey, 0.9 * g, nightMix);
}

function drawElephant(x, y, s, nightMix) {
  push();
  translate(x, y);
  scale(s);

  // glow
  for (let k = 5; k >= 1; k--) {
    stroke(0, 0, 100, 0.02);
    strokeWeight(k * 6);
    noFill();
    elephantShape();
  }

  // body
  stroke(0, 0, 100, 0.55);
  strokeWeight(3);
  fill(0, 0, 100, 0.10 + 0.10 * nightMix);
  elephantShapeFilled();

  // eye
  noStroke();
  fill(0, 0, 100, 0.45);
  circle(18, -10, 4);
  pop();
}

function elephantShape() {
  // outline-ish
  beginShape();
  // body
  vertex(-30, 0);
  vertex(-28, -18);
  vertex(-10, -28);
  vertex(18, -26);
  vertex(34, -14);
  vertex(32, 6);
  vertex(-30, 6);
  endShape(CLOSE);

  // trunk
  beginShape();
  vertex(34, -10);
  vertex(46, -6);
  vertex(50, 6);
  vertex(42, 14);
  vertex(36, 8);
  endShape(CLOSE);
}

function elephantShapeFilled() {
  // body
  beginShape();
  vertex(-30, 0);
  vertex(-28, -18);
  vertex(-10, -28);
  vertex(18, -26);
  vertex(34, -14);
  vertex(32, 6);
  vertex(-30, 6);
  endShape(CLOSE);

  // legs
  rect(-22, 6, 10, 16, 4);
  rect(-4, 6, 10, 16, 4);
  rect(14, 6, 10, 16, 4);

  // ear
  ellipse(14, -12, 18, 16);

  // trunk
  beginShape();
  vertex(34, -10);
  vertex(46, -6);
  vertex(50, 6);
  vertex(42, 14);
  vertex(36, 8);
  endShape(CLOSE);
}

function drawTower(p, nightMix) {
  const g = smoothstep(p);
  const groundY = height * 0.78;
  const x = width * 0.90;
  const w = min(width, height) * 0.07;
  const h = min(width, height) * 0.52 * g;

  push();
  translate(x, groundY);

  // glow
  for (let k = 7; k >= 1; k--) {
    stroke(190, 25, 100, 0.010 * g);
    strokeWeight(k * 9);
    noFill();
    towerOutline(w, h);
  }

  // body
  stroke(200, 15, 85, 0.45);
  strokeWeight(2.2);
  fill(210, 10, lerp(18, 10, nightMix), 0.70 * g);
  towerBody(w, h);

  // top beacon
  if (p > 0.65) {
    const a = 0.12 + 0.10 * sin(frameCount * 0.08);
    noStroke();
    fill(50, 60, 100, a);
    circle(0, -h - 18, 18);
  }

  pop();
}

function towerOutline(w, h) {
  beginShape();
  vertex(-w, 0);
  vertex(-w * 0.75, -h);
  vertex(0, -h - 28);
  vertex(w * 0.75, -h);
  vertex(w, 0);
  endShape(CLOSE);
}
function towerBody(w, h) {
  beginShape();
  vertex(-w, 0);
  vertex(-w * 0.75, -h);
  vertex(0, -h - 28);
  vertex(w * 0.75, -h);
  vertex(w, 0);
  endShape(CLOSE);
}

// ---------------- HUD ----------------
function drawHUD() {
  push();
  resetMatrix();
  textAlign(LEFT, TOP);
  noStroke();

  const s = map(min(width, height), 320, 1200, 1.2, 1.0, true);
  const pad = 14 * s;

  fill(0, 0, 0, 0.18);
  rect(pad - 8, pad - 8, 360 * s, 52 * s, 10);

  fill(0, 0, 100, 0.86);
  textSize(14 * s);
  text("Tap: skip / next   •   Swipe: wind", pad, pad);

  fill(0, 0, 100, 0.62);
  textSize(12 * s);
  text(`Scene ${scene + 1}/11`, pad, pad + 20 * s);
  pop();
}

// ---------------- Utils ----------------
function smoothstep(x) {
  x = constrain(x, 0, 1);
  return x * x * (3 - 2 * x);
}
