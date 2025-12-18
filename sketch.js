let seed = 0;
let mode = 1;
let paused = false;

let cells = [];
let glitter = [];
let gifts = [];
let fireworks = [];

let t0 = 0;

// touch / fun
let wind = 0;               // swipe affects this
let touchStartAt = 0;
let touchStartPos = null;
let longPressTimer = null;
let longPressFired = false;

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);
  t0 = random(1000);

  cells = [];
  glitter = [];
  gifts = [];
  fireworks = [];

  const n = floor(map(min(width, height), 400, 1400, 55, 130, true));
  for (let i = 0; i < n; i++) {
    cells.push({
      x: random(width),
      y: random(height),
      r: random(18, 70),
      a: random(0.05, 0.22),
      wob: random(0.6, 2.2),
      hue: random(0, 360),
      drift: random(0.2, 1.2)
    });
  }

  const g = floor(map(min(width, height), 400, 1400, 220, 520, true));
  for (let i = 0; i < g; i++) {
    glitter.push({
      x: random(width),
      y: random(height),
      v: random(0.3, 1.4),
      p: random(TAU),
      s: random(0.6, 2.2),
      tw: random(0.02, 0.12)
    });
  }

  const giftCount = floor(map(min(width, height), 400, 1400, 10, 26, true));
  for (let i = 0; i < giftCount; i++) gifts.push(makeGift());
}

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

function keyPressed() {
  if (key === 'r' || key === 'R') reseed();
  if (key === ' ') paused = !paused;
  if (key === 's' || key === 'S') saveCanvas(`festive_${seed}_m${mode}`, 'png');
  if (key === '1') mode = 1;
  if (key === '2') mode = 2;
  if (key === '3') mode = 3;
}

// ---------------------------
// Touch / Mouse input
// ---------------------------
function touchStarted() {
  if (touches && touches.length) {
    const x = touches[0].x, y = touches[0].y;
    startPress(x, y);
  } else {
    startPress(mouseX, mouseY);
  }
  return false; // prevent scroll/zoom
}

function touchMoved() {
  // swipe -> wind
  if (touches && touches.length) {
    // p5 gives movedX/movedY
    wind += constrain(movedX * 0.02, -0.8, 0.8);
  }
  return false;
}

function touchEnded() {
  endPress();
  return false;
}

function mousePressed() {
  startPress(mouseX, mouseY);
}

function mouseReleased() {
  endPress();
}

function startPress(x, y) {
  if (paused) return;

  touchStartAt = millis();
  touchStartPos = { x, y };
  longPressFired = false;

  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    // long press: mega rocket if finger didn't move too far
    if (!touchStartPos) return;
    longPressFired = true;
    handleTap(touchStartPos.x, touchStartPos.y, true);
  }, 520);
}

function endPress() {
  if (paused) return;

  if (longPressTimer) clearTimeout(longPressTimer);

  // if long press already fired, do nothing
  if (longPressFired) {
    touchStartPos = null;
    return;
  }

  // short tap -> normal pop
  if (touchStartPos) handleTap(touchStartPos.x, touchStartPos.y, false);
  touchStartPos = null;
}

function handleTap(x, y, mega) {
  const idx = hitGift(x, y);
  if (idx >= 0) {
    const g = gifts[idx];
    g.alive = false;
    popGiftToFirework(g, mega);

    // respawn gift quickly
    setTimeout(() => {
      gifts[idx] = makeGift();
    }, mega ? 450 : 250);
  } else {
    // tap empty space: playful “spark” (small firework)
    fireworks.push(makeRocket(x, y, mega ? 1.6 : 1.0, true));
  }
}

// ---------------------------
// Draw loop
// ---------------------------
function draw() {
  // gentle wind decay
  wind *= 0.965;
  wind = constrain(wind, -6, 6);

  if (paused) {
    drawHUD();
    return;
  }

  background(230, 25, 3.5, 0.18);
  const t = t0 + frameCount * 0.008;

  if (mode === 1) drawCellularLights(t);
  if (mode === 2) drawTessellatedRibbons(t);
  if (mode === 3) drawFestiveGarden(t);

  // always: snow/glitter + gifts + fireworks + santa + vignette
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
      strokeWeight(1.2 + k * 0.9);
      circle(x, y, rr * 2);
    }

    stroke(h, sat, 95, 0.12);
    strokeWeight(1.1);
    circle(x, y, c.r * 0.7);
  }
}

function drawTessellatedRibbons(t) {
  const step = floor(map(min(width, height), 400, 1400, 34, 58, true));
  strokeWeight(1.1);

  for (let y = -step; y <= height + step; y += step) {
    beginShape();
    for (let x = -step; x <= width + step; x += step) {
      const n = noise(x * 0.003, y * 0.003, t);
      const ang = n * TAU * 2;
      const amp = step * 0.55;

      const xx = x + cos(ang) * amp;
      const yy = y + sin(ang) * amp;

      const h = festivePalette(x + y + t * 120);
      stroke(h, 85, 90, 0.12);
      curveVertex(xx, yy);

      if (n > 0.86) {
        stroke(h, 95, 100, 0.18);
        strokeWeight(2.2);
        point(xx, yy);
        strokeWeight(1.1);
      }
    }
    endShape();
  }

  for (let s = 0; s < 12; s++) {
    const y0 = (s / 12) * height;
    beginShape();
    for (let x = 0; x <= width; x += 18) {
      const n = noise(x * 0.0022, y0 * 0.0022, t * 1.2 + s * 9);
      const yy = y0 + (n - 0.5) * 240;
      const h = festivePalette(220 + s * 30 + t * 80);
      stroke(h, 80, 100, 0.08);
      strokeWeight(3.6);
      curveVertex(x, yy);
    }
    endShape();
  }
  strokeWeight(1.1);
}

function drawFestiveGarden(t) {
  const stems = 140;
  for (let i = 0; i < stems; i++) {
    const x0 = (i / stems) * width;
    const y0 = height * (0.55 + 0.45 * noise(i * 0.08, t * 0.25));
    const h = festivePalette(i * 7 + t * 90);

    let x = x0;
    let y = y0;
    strokeWeight(1.2);
    stroke(h, 75, 95, 0.10);

    for (let k = 0; k < 55; k++) {
      const n = noise(x * 0.002, y * 0.002, t);
      const ang = n * TAU * 2;
      const step = 7 + 6 * noise(i * 0.2, k * 0.1);

      const nx = x + cos(ang) * step;
      const ny = y - abs(sin(ang)) * step * 0.9;

      line(x, y, nx, ny);
      x = nx; y = ny;

      if (k % 9 === 0) {
        for (let b = 0; b < 3; b++) {
          const rr = 6 + b * 6;
          stroke(h, 85, 100, 0.08 - b * 0.015);
          strokeWeight(1.1 + b * 1.2);
          circle(x, y, rr);
        }
        strokeWeight(1.2);
        stroke(h, 75, 95, 0.10);
      }
      if (y < 0) break;
    }
  }
}

function drawGlitter(t) {
  for (const g of glitter) {
    g.p += g.tw;
    g.y += g.v;
    g.x += sin(g.p + t) * 0.35 + wind * 0.35; // wind affects snow
    if (g.y > height + 20) {
      g.y = -20;
      g.x = random(width);
    }
    if (g.x < -30) g.x = width + 30;
    if (g.x > width + 30) g.x = -30;

    const n = noise(g.x * 0.004, g.y * 0.004, t * 0.8);
    const h = festivePalette(180 + n * 240);
    const a = 0.06 + n * 0.10;

    strokeWeight(g.s);
    stroke(h, 30, 100, a);
    point(g.x, g.y);

    if (n > 0.88) {
      strokeWeight(1.2);
      stroke(h, 45, 100, 0.09);
      line(g.x - 6, g.y, g.x + 6, g.y);
      line(g.x, g.y - 6, g.x, g.y + 6);
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
  translate(width * 0.5 + sin(t * 0.6) * 120, height * 0.45 + cos(t * 0.4) * 80);
  const sc = min(width, height) * 0.0022;
  scale(sc);
  rotate(sin(t * 0.3) * 0.05);

  // glow layers
  for (let i = 7; i > 0; i--) {
    stroke(0, 80, 100, 0.022);
    strokeWeight(i * 8);
    santaShape();
  }

  // main stroke
  stroke(0, 85, 95, 0.85);
  strokeWeight(6);
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

  // small belt hint
  line(-28, 38, 28, 38);
}

// ---------------------------
// Gifts (tap targets)
// ---------------------------
function makeGift() {
  const s = random(34, 70);
  const hue = random([0, 12, 40, 140, 165, 190]); // red/gold/green/ice
  return {
    x: random(s, width - s),
    y: random(s, height - s),
    s,
    vx: random(-0.35, 0.35),
    vy: random(-0.25, 0.25),
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
  g.x += g.vx + sin(t * g.wob) * 0.25 + wind * 0.12;
  g.y += g.vy + cos(t * g.wob) * 0.18;
  if (g.x < g.s || g.x > width - g.s) g.vx *= -1;
  if (g.y < g.s || g.y > height - g.s) g.vy *= -1;
  g.x = constrain(g.x, g.s, width - g.s);
  g.y = constrain(g.y, g.s, height - g.s);

  const x = g.x, y = g.y, s = g.s;

  // sparkle aura (witty “look at me”)
  const halo = 0.05 + 0.03 * sin(t * 2.2 + x * 0.01);
  stroke((g.hue + 40) % 360, 30, 100, halo);
  strokeWeight(1);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    point(x + cos(a) * (s * 0.8), y + sin(a) * (s * 0.8));
  }

  // glow
  rectMode(CENTER);
  for (let k = 4; k >= 1; k--) {
    stroke(g.hue, 85, 100, 0.045);
    strokeWeight(k * 6);
    rect(x, y, s, s, 10);
  }

  // box
  stroke(g.hue, 80, 95, 0.55);
  strokeWeight(2);
  rect(x, y, s, s, 10);

  // ribbon
  stroke((g.hue + 180) % 360, 40, 100, 0.55);
  strokeWeight(3);
  line(x - s * 0.22, y - s * 0.48, x - s * 0.22, y + s * 0.48);
  line(x + s * 0.22, y - s * 0.48, x + s * 0.22, y + s * 0.48);
  line(x - s * 0.48, y, x + s * 0.48, y);

  // bow
  strokeWeight(2);
  noFill();
  arc(x - s * 0.12, y - s * 0.36, s * 0.28, s * 0.22, PI, TWO_PI);
  arc(x + s * 0.12, y - s * 0.36, s * 0.28, s * 0.22, PI, TWO_PI);
  noFill();
}

function hitGift(px, py) {
  for (let i = gifts.length - 1; i >= 0; i--) {
    const g = gifts[i];
    if (!g.alive) continue;
    const half = g.s * 0.55;
    if (px >= g.x - half && px <= g.x + half && py >= g.y - half && py <= g.y + half) {
      return i;
    }
  }
  return -1;
}

// ---------------------------
// Fireworks
// ---------------------------
function popGiftToFirework(g, mega) {
  fireworks.push(makeRocket(g.x, g.y, mega ? 1.7 : 1.0, false, g.hue));
}

function makeRocket(x, y, power = 1.0, sparkleOnly = false, hueOverride = null) {
  const h = hueOverride != null ? hueOverride : festivePalette(x + y);
  return {
    x, y,
    vx: random(-0.4, 0.4) + wind * 0.08,
    vy: sparkleOnly ? random(-4.5, -6.5) : random(-7.5, -10.5) * power,
    hue: h,
    life: 0,
    explodeAt: sparkleOnly ? floor(random(12, 18)) : floor(random(18, 34)),
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
      // rocket trail
      stroke(r.hue, 70, 100, 0.22);
      strokeWeight(2);
      point(r.x, r.y);
      strokeWeight(1);
      line(r.x, r.y + 12, r.x - r.vx * 6, r.y + 18);

      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.12; // gravity
      r.vx += wind * 0.003; // wind

      if (r.life >= r.explodeAt || r.vy > -1.0) {
        r.exploded = true;

        const parts = [];
        const baseN = random(40, 90) * (r.power * 0.95);
        const n = floor(baseN);

        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          const sp = random(1.2, 6.8) * (0.7 + noise(k * 0.2) * 0.8) * r.power;
          parts.push({
            x: r.x, y: r.y,
            vx: cos(a) * sp + wind * 0.18,
            vy: sin(a) * sp,
            hue: (r.hue + random(-18, 18) + 360) % 360,
            a: 0.24,
            w: random(1.0, 2.6) * (0.9 + r.power * 0.2),
            ttl: floor(random(32, 78) * (0.9 + r.power * 0.25))
          });
        }
        // add a few “comet” streaks for wit
        const comets = floor(3 * r.power);
        for (let c = 0; c < comets; c++) {
          parts.push({
            x: r.x, y: r.y,
            vx: random(-2, 2) + wind * 0.25,
            vy: random(-2, 2),
            hue: (r.hue + random(120, 200)) % 360,
            a: 0.18,
            w: random(2.2, 3.6),
            ttl: floor(random(40, 85))
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
        s.vy += 0.08;
        s.vx *= 0.986;
        s.vy *= 0.986;
        s.vx += wind * 0.0015;

        s.a *= 0.972;

        stroke(s.hue, 70, 100, s.a);
        strokeWeight(s.w);
        point(s.x, s.y);

        if (s.ttl % 9 === 0) {
          stroke(s.hue, 40, 100, s.a * 0.55);
          strokeWeight(1);
          line(s.x - 3, s.y, s.x + 3, s.y);
          line(s.x, s.y - 3, s.x, s.y + 3);
        }

        if (s.ttl <= 0 || s.a < 0.01) parts.splice(p, 1);
      }
      if (parts.length === 0) fireworks.splice(i, 1);
    }
  }
}

// ---------------------------
// HUD
// ---------------------------
function drawHUD() {
  const names = {1: "Cellular Lights", 2: "Tessellated Ribbons", 3: "Festive Garden"};
  const fps = nf(frameRate(), 2, 0);
  const el = document.getElementById("meta");
  if (el) {
    el.textContent =
      `mode: ${mode} (${names[mode]})  ·  seed: ${seed}  ·  fps: ${fps}` +
      `  ·  wind: ${wind.toFixed(1)}` +
      (paused ? "  ·  paused" : "");
  }
}
