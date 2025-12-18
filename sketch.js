// Festive Generative Lights — Mobile-first Edition
// Touch: Tap gift = firework, Long-press gift = MEGA firework, Swipe = wind
// Adds: Score + combo (HO HO HO)

let seed = 0;
let paused = false;

let cells = [];
let glitter = [];
let gifts = [];
let fireworks = [];

let t0 = 0;

// touch / fun
let wind = 0;
let touchStartPos = null;
let longPressTimer = null;
let longPressFired = false;

// scoring
let score = 0;
let combo = 0;
let lastHitMs = 0;
let toast = { text: "", until: 0 };

// mobile scaling
let uiScale = 1;     // based on screen size
let fxScale = 1;     // fireworks scale (bigger on phone)
let lineScale = 1;   // thicker strokes on phone

function recomputeScales() {
  const m = min(windowWidth, windowHeight);
  // UI scale: readable on phones but not huge on desktop
  uiScale = map(m, 320, 1200, 1.2, 1.0, true);
  // FX scale: make fireworks noticeably larger on small screens
  fxScale = map(m, 320, 1200, 1.75, 1.15, true);
  // thicker lines on small screens
  lineScale = map(m, 320, 1200, 1.6, 1.0, true);
}

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);
  t0 = random(1000);

  cells = [];
  glitter = [];
  gifts = [];
  fireworks = [];

  const n = floor(map(min(width, height), 320, 1400, 70, 150, true));
  for (let i = 0; i < n; i++) {
    cells.push({
      x: random(width),
      y: random(height),
      r: random(18, 78) * (1.0 + (fxScale - 1) * 0.2),
      a: random(0.06, 0.22),
      wob: random(0.6, 2.2),
      hue: random(0, 360),
      drift: random(0.2, 1.2)
    });
  }

  const g = floor(map(min(width, height), 320, 1400, 260, 620, true));
  for (let i = 0; i < g; i++) {
    glitter.push({
      x: random(width),
      y: random(height),
      v: random(0.4, 1.8) * (1.0 + (fxScale - 1) * 0.15),
      p: random(TAU),
      s: random(0.9, 3.2) * lineScale,
      tw: random(0.02, 0.12)
    });
  }

  const giftCount = floor(map(min(width, height), 320, 1400, 12, 28, true));
  for (let i = 0; i < giftCount; i++) gifts.push(makeGift());
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  colorMode(HSB, 360, 100, 100, 1);
  noFill();
  recomputeScales();
  reseed();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  recomputeScales();
  reseed();
}

// ---------------------------
// Touch / Mouse input (mobile-first)
// ---------------------------
function touchStarted() {
  if (paused) return false;

  const x = touches?.[0]?.x ?? mouseX;
  const y = touches?.[0]?.y ?? mouseY;

  startPress(x, y);
  return false;
}

function touchMoved() {
  if (paused) return false;

  // swipe -> wind (stronger on phone)
  if (touches && touches.length) {
    wind += constrain(movedX * 0.06, -1.6, 1.6);
  }
  return false;
}

function touchEnded() {
  if (paused) return false;
  endPress();
  return false;
}

// desktop mouse fallback
function mousePressed() {
  if (paused) return;
  startPress(mouseX, mouseY);
}
function mouseReleased() {
  if (paused) return;
  endPress();
}

function startPress(x, y) {
  touchStartPos = { x, y };
  longPressFired = false;

  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    if (!touchStartPos) return;
    longPressFired = true;
    handleTap(touchStartPos.x, touchStartPos.y, true);
  }, 520);
}

function endPress() {
  if (longPressTimer) clearTimeout(longPressTimer);

  if (longPressFired) {
    touchStartPos = null;
    return;
  }

  if (touchStartPos) handleTap(touchStartPos.x, touchStartPos.y, false);
  touchStartPos = null;
}

function handleTap(x, y, mega) {
  const idx = hitGift(x, y);
  if (idx >= 0) {
    const g = gifts[idx];
    g.alive = false;

    popGiftToFirework(g, mega);
    registerHit(mega);

    // respawn gift quickly
    setTimeout(() => {
      gifts[idx] = makeGift();
    }, mega ? 520 : 300);
  } else {
    // tap empty space: little spark (still visible)
    fireworks.push(makeRocket(x, y, mega ? 2.0 : 1.2, true));
  }
}

function registerHit(mega) {
  const now = millis();
  if (now - lastHitMs < 1500) combo++;
  else combo = 1;
  lastHitMs = now;

  const add = (mega ? 40 : 15) + (combo - 1) * 7;
  score += add;

  if (combo >= 2) toast.text = `HO HO HO ×${combo}`;
  else toast.text = mega ? "MEGA!" : "POP!";
  toast.until = now + 900;
}

// ---------------------------
// Draw loop
// ---------------------------
function draw() {
  // gentle wind decay
  wind *= 0.965;
  wind = constrain(wind, -10, 10);

  // subtle trail for glow build-up
  background(230, 25, 3.5, 0.18);

  const t = t0 + frameCount * 0.008;

  drawCellularLights(t);
  drawGlitter(t);
  drawGifts(t);
  updateFireworks();
  drawSanta(t);
  vignette();
  drawHUD();
}

// ---------------------------
// Visual language helpers
// ---------------------------
function festivePalette(h) {
  const pick = (h + noise(h * 0.02, seed * 0.00001) * 140) % 360;
  const bands = [8, 30, 55, 140, 165, 190, 210, 320, 340];
  const target = bands[floor(map(noise(h * 0.03), 0, 1, 0, bands.length))];
  const out = lerp(pick, target, 0.55);
  return (out + 360) % 360;
}

function drawCellularLights(t) {
  for (const c of cells) {
    const nx = noise(c.x * 0.0016, c.y * 0.0016, t * 0.6);
    const ny = noise(c.x * 0.0016 + 10, c.y * 0.0016 + 10, t * 0.6);
    const dx = (nx - 0.5) * 180 * c.drift;
    const dy = (ny - 0.5) * 180 * c.drift;

    const x = (c.x + dx + width) % width;
    const y = (c.y + dy + height) % height;

    const h = festivePalette(c.hue + sin(t * c.wob) * 40);
    const sat = 80 + 20 * noise(x * 0.002, y * 0.002);
    const bri = 70 + 30 * noise(x * 0.002 + 5, y * 0.002 + 5);

    for (let k = 0; k < 5; k++) {
      const rr = c.r * (1 + k * 0.22);
      const a = c.a * (1 - k * 0.18);
      stroke(h, sat, bri, a);
      strokeWeight((1.4 + k * 1.1) * lineScale);
      circle(x, y, rr * 2);
    }

    stroke(h, sat, 95, 0.12);
    strokeWeight(1.2 * lineScale);
    circle(x, y, c.r * 0.7);
  }
}

function drawGlitter(t) {
  for (const g of glitter) {
    g.p += g.tw;
    g.y += g.v;
    g.x += sin(g.p + t) * 0.45 + wind * 0.55;

    if (g.y > height + 30) {
      g.y = -30;
      g.x = random(width);
    }
    if (g.x < -40) g.x = width + 40;
    if (g.x > width + 40) g.x = -40;

    const n = noise(g.x * 0.004, g.y * 0.004, t * 0.8);
    const h = festivePalette(180 + n * 240);
    const a = 0.08 + n * 0.14;

    strokeWeight(g.s * 1.15);
    stroke(h, 30, 100, a);
    point(g.x, g.y);

    if (n > 0.88) {
      strokeWeight(1.5 * lineScale);
      stroke(h, 45, 100, 0.11);
      line(g.x - 8, g.y, g.x + 8, g.y);
      line(g.x, g.y - 8, g.x, g.y + 8);
    }
  }
}

function vignette() {
  noStroke();
  for (let i = 0; i < 10; i++) {
    const a = 0.04 * (i / 10);
    fill(230, 30, 2, a);
    rect(-i * 12, -i * 12, width + i * 24, height + i * 24);
  }
  noFill();
}

// ---------------------------
// Santa (stylized neon silhouette)
// ---------------------------
function drawSanta(t) {
  push();
  translate(width * 0.5 + sin(t * 0.6) * 120, height * 0.42 + cos(t * 0.4) * 80);
  const sc = min(width, height) * 0.00225 * (1.0 + (fxScale - 1) * 0.10);
  scale(sc);
  rotate(sin(t * 0.3) * 0.05);

  // glow layers (thicker on phone)
  for (let i = 8; i > 0; i--) {
    stroke(0, 80, 100, 0.022);
    strokeWeight(i * 9 * lineScale);
    santaShape();
  }

  stroke(0, 85, 95, 0.88);
  strokeWeight(7 * lineScale);
  santaShape();

  pop();
}

function santaShape() {
  // hat
  beginShape();
  vertex(-20, -60);
  vertex(0, -95);
  vertex(35, -55);
  endShape();

  // head
  ellipse(5, -35, 35, 30);

  // beard
  beginShape();
  vertex(-20, -25);
  vertex(-10, 10);
  vertex(25, 10);
  vertex(30, -20);
  endShape(CLOSE);

  // body
  beginShape();
  vertex(-35, 10);
  vertex(-45, 70);
  vertex(45, 70);
  vertex(35, 10);
  endShape(CLOSE);

  // belt hint
  line(-28, 38, 28, 38);
}

// ---------------------------
// Gifts (tap targets)
// ---------------------------
function makeGift() {
  const s = random(38, 80) * (1.0 + (fxScale - 1) * 0.15);
  const hue = random([0, 12, 40, 140, 165, 190]); // red/gold/green/ice
  return {
    x: random(s, width - s),
    y: random(s, height - s),
    s,
    vx: random(-0.42, 0.42),
    vy: random(-0.30, 0.30),
    hue,
    wob: random(0.6, 1.6),
    alive: true
  };
}

function drawGifts(t) {
  for (const g of gifts) {
    if (!g.alive) continue;
    drawGift(g, t);
  }
}

function drawGift(g, t) {
  g.x += g.vx + sin(t * g.wob) * 0.25 + wind * 0.14;
  g.y += g.vy + cos(t * g.wob) * 0.18;
  if (g.x < g.s || g.x > width - g.s) g.vx *= -1;
  if (g.y < g.s || g.y > height - g.s) g.vy *= -1;
  g.x = constrain(g.x, g.s, width - g.s);
  g.y = constrain(g.y, g.s, height - g.s);

  const x = g.x, y = g.y, s = g.s;

  // “look at me” sparkle aura
  const halo = 0.07 + 0.04 * sin(t * 2.2 + x * 0.01);
  stroke((g.hue + 40) % 360, 30, 100, halo);
  strokeWeight(1.2 * lineScale);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    point(x + cos(a) * (s * 0.9), y + sin(a) * (s * 0.9));
  }

  rectMode(CENTER);

  // glow
  for (let k = 5; k >= 1; k--) {
    stroke(g.hue, 85, 100, 0.050);
    strokeWeight(k * 7 * lineScale);
    rect(x, y, s, s, 12);
  }

  // box
  stroke(g.hue, 80, 95, 0.62);
  strokeWeight(2.6 * lineScale);
  rect(x, y, s, s, 12);

  // ribbon
  stroke((g.hue + 180) % 360, 40, 100, 0.62);
  strokeWeight(3.6 * lineScale);
  line(x - s * 0.22, y - s * 0.48, x - s * 0.22, y + s * 0.48);
  line(x + s * 0.22, y - s * 0.48, x + s * 0.22, y + s * 0.48);
  line(x - s * 0.48, y, x + s * 0.48, y);

  // bow
  strokeWeight(2.4 * lineScale);
  noFill();
  arc(x - s * 0.12, y - s * 0.36, s * 0.30, s * 0.24, PI, TWO_PI);
  arc(x + s * 0.12, y - s * 0.36, s * 0.30, s * 0.24, PI, TWO_PI);
  noFill();
}

function hitGift(px, py) {
  for (let i = gifts.length - 1; i >= 0; i--) {
    const g = gifts[i];
    if (!g.alive) continue;
    const half = g.s * 0.60; // generous hitbox for phones
    if (px >= g.x - half && px <= g.x + half && py >= g.y - half && py <= g.y + half) {
      return i;
    }
  }
  return -1;
}

// ---------------------------
// Fireworks (BIG + visible on mobile)
// ---------------------------
function popGiftToFirework(g, mega) {
  fireworks.push(makeRocket(g.x, g.y, mega ? 2.8 : 1.9, false, g.hue));
}

function makeRocket(x, y, power = 1.6, sparkleOnly = false, hueOverride = null) {
  const h = hueOverride != null ? hueOverride : festivePalette(x + y);
  return {
    x, y,
    vx: random(-0.7, 0.7) + wind * 0.12,
    vy: sparkleOnly ? random(-6.0, -8.0) : random(-12.0, -16.0) * power * 0.35,
    hue: h,
    life: 0,
    explodeAt: sparkleOnly ? floor(random(10, 16)) : floor(random(14, 22)),
    exploded: false,
    parts: null,
    power
  };
}

function updateFireworks() {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const r = fireworks[i];
    r.life++;

    if (!r.exploded) {
      // SUPER visible rocket
      const w = (6.5 * lineScale) * (0.9 + r.power * 0.22) * fxScale;
      strokeWeight(w);
      stroke(r.hue, 85, 100, 0.55);
      point(r.x, r.y);

      // fat glowing trail
      strokeWeight(w * 0.75);
      stroke(r.hue, 65, 100, 0.16);
      line(r.x, r.y + 30 * fxScale, r.x - r.vx * 8, r.y + 60 * fxScale);

      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.16;       // gravity
      r.vx += wind * 0.007;

      if (r.life >= r.explodeAt || r.vy > -0.8) {
        r.exploded = true;

        const parts = [];
        const baseN = (sparkleCount(r.power)) * (fxScale * 1.2);
        const n = floor(baseN);

        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          const sp = random(3.0, 13.0) * (0.75 + noise(k * 0.2) * 0.8) * (0.7 + r.power * 0.25) * fxScale;
          parts.push({
            x: r.x, y: r.y,
            vx: cos(a) * sp + wind * 0.45,
            vy: sin(a) * sp,
            hue: (r.hue + random(-22, 22) + 360) % 360,
            a: 0.40,
            w: random(3.0, 7.2) * lineScale * (0.9 + r.power * 0.18) * fxScale,
            ttl: floor(random(38, 86) * (0.9 + r.power * 0.18)),
            sparkle: random() < 0.30
          });
        }

        // comedic “comets” (more esprit)
        const comets = floor(4 * (0.9 + r.power * 0.2));
        for (let c = 0; c < comets; c++) {
          parts.push({
            x: r.x, y: r.y,
            vx: random(-6, 6) * fxScale + wind * 0.8,
            vy: random(-6, 6) * fxScale,
            hue: (r.hue + random(120, 220)) % 360,
            a: 0.30,
            w: random(5.0, 9.0) * lineScale * fxScale,
            ttl: floor(random(44, 96)),
            sparkle: true,
            comet: true
          });
        }

        r.parts = parts;
      }
    } else {
      const parts = r.parts;
      for (let p = parts.length - 1; p >= 0; p--) {
        const s = parts[p];
        s.ttl--;

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.12;
        s.vx *= 0.982;
        s.vy *= 0.982;
        s.vx += wind * 0.004;

        // fade
        s.a *= 0.965;

        // draw particle (BIG + bright)
        strokeWeight(s.w);
        stroke(s.hue, 80, 100, s.a);
        point(s.x, s.y);

        // glow echo (makes it pop on phones)
        strokeWeight(s.w * 1.55);
        stroke(s.hue, 45, 100, s.a * 0.08);
        point(s.x, s.y);

        // sparkle cross sometimes
        if (s.sparkle && (s.ttl % 6 === 0)) {
          strokeWeight(2.2 * lineScale * fxScale);
          stroke(s.hue, 35, 100, s.a * 0.22);
          line(s.x - 10 * fxScale, s.y, s.x + 10 * fxScale, s.y);
          line(s.x, s.y - 10 * fxScale, s.x, s.y + 10 * fxScale);
        }

        // comet streak
        if (s.comet && (s.ttl % 2 === 0)) {
          strokeWeight(3.0 * lineScale * fxScale);
          stroke(s.hue, 55, 100, s.a * 0.16);
          line(s.x, s.y, s.x - s.vx * 0.8, s.y - s.vy * 0.8);
        }

        if (s.ttl <= 0 || s.a < 0.015) parts.splice(p, 1);
      }
      if (parts.length === 0) fireworks.splice(i, 1);
    }
  }
}

function sparkleCount(power) {
  // bigger bursts (especially on mobile)
  return 70 + power * 55;
}

// ---------------------------
// HUD (touch instructions + score)
// ---------------------------
function drawHUD() {
  const now = millis();

  // overlay text directly on canvas (no DOM needed)
  push();
  resetMatrix();
  textAlign(LEFT, TOP);
  noStroke();

  const pad = 14 * uiScale;
  const fontSize = 14 * uiScale;
  textSize(fontSize);

  // subtle background for readability
  fill(0, 0, 0, 0.18);
  rect(pad - 8, pad - 8, 360 * uiScale, 88 * uiScale, 10);

  fill(0, 0, 100, 0.85);
  text("Festive Pop!", pad, pad);

  fill(0, 0, 100, 0.70);
  textSize(12 * uiScale);
  text("Tap gift: firework   •   Long-press: MEGA   •   Swipe: wind", pad, pad + 20 * uiScale);

  fill(0, 0, 100, 0.85);
  textSize(13 * uiScale);
  text(`Score: ${score}   Combo: x${combo}`, pad, pad + 42 * uiScale);

  // toast
  if (now < toast.until && toast.text) {
    fill(0, 0, 100, 0.88);
    textSize(22 * uiScale);
    text(toast.text, pad, pad + 64 * uiScale);
  }

  pop();
}
