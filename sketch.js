let seed = 0;
let mode = 1;
let paused = false;

let cells = [];
let glitter = [];
let t0 = 0;

function reseed() {
  seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  randomSeed(seed);
  noiseSeed(seed);
  t0 = random(1000);

  cells = [];
  glitter = [];

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
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  // avoid killing CPUs on high-DPI
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

function draw() {
  if (paused) {
    drawHUD();
    return;
  }

  // subtle trail for glow build-up
  background(230, 25, 3.5, 0.18);

  const t = t0 + frameCount * 0.008;

  if (mode === 1) drawCellularLights(t);
  if (mode === 2) drawTessellatedRibbons(t);
  if (mode === 3) drawFestiveGarden(t);

  drawGlitter(t);
  vignette();
  drawHUD();
}

function festivePalette(h) {
  // festive neon spectrum: reds/greens/golds/icy cyans
  const pick = (h + noise(h * 0.02, seed * 0.00001) * 140) % 360;
  // bias around christmas-ish ranges
  const bands = [8, 30, 55, 140, 165, 190, 210, 320, 340];
  const target = bands[floor(map(noise(h * 0.03), 0, 1, 0, bands.length))];
  const out = lerp(pick, target, 0.55);
  return (out + 360) % 360;
}

function drawCellularLights(t) {
  // luminous “cells” + soft flow displacement
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

    // layered glow rings
    for (let k = 0; k < 5; k++) {
      const rr = c.r * (1 + k * 0.22);
      const a = c.a * (1 - k * 0.18);
      stroke(h, sat, bri, a);
      strokeWeight(1.2 + k * 0.9);
      circle(x, y, rr * 2);
    }

    // inner highlight
    stroke(h, sat, 95, 0.12);
    strokeWeight(1.1);
    circle(x, y, c.r * 0.7);
  }
}

function drawTessellatedRibbons(t) {
  // moving lattice + flowing ribbons
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
      const sat = 85;
      const bri = 90;
      stroke(h, sat, bri, 0.12);
      curveVertex(xx, yy);

      // glow accents (sparks)
      if (n > 0.86) {
        stroke(h, 95, 100, 0.18);
        strokeWeight(2.2);
        point(xx, yy);
        strokeWeight(1.1);
      }
    }
    endShape();
  }

  // overlay a few brighter ribbon streams
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
  // “digital garden”: swirling stems + bloom-like particles
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
        // “bloom”
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
  // snow / glitter constellation
  for (const g of glitter) {
    g.p += g.tw;
    g.y += g.v;
    g.x += sin(g.p + t) * 0.35;
    if (g.y > height + 20) {
      g.y = -20;
      g.x = random(width);
    }

    const n = noise(g.x * 0.004, g.y * 0.004, t * 0.8);
    const h = festivePalette(180 + n * 240);
    const a = 0.06 + n * 0.10;

    strokeWeight(g.s);
    stroke(h, 30, 100, a);
    point(g.x, g.y);

    // occasional star hint
    if (n > 0.88) {
      strokeWeight(1.2);
      stroke(h, 45, 100, 0.09);
      line(g.x - 6, g.y, g.x + 6, g.y);
      line(g.x, g.y - 6, g.x, g.y + 6);
    }
  }
}

function vignette() {
  // lightweight vignette using a few translucent rects (fast)
  noStroke();
  for (let i = 0; i < 10; i++) {
    const a = 0.04 * (i / 10);
    fill(230, 30, 2, a);
    rect(-i * 12, -i * 12, width + i * 24, height + i * 24);
  }
  noFill();
}

function drawHUD() {
  const names = {1: "Cellular Lights", 2: "Tessellated Ribbons", 3: "Festive Garden"};
  const fps = nf(frameRate(), 2, 0);
  const el = document.getElementById("meta");
  if (!el) return;
  el.textContent = `mode: ${mode} (${names[mode]})  ·  seed: ${seed}  ·  fps: ${fps}${paused ? "  ·  paused" : ""}`;
}
