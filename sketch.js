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

  const n = floor(map(min(width, height), 400, 1400, 70, 160, true));
  for (let i = 0; i < n; i++) {
    cells.push({
      x: random(width),
      y: random(height),
      r: random(20, 90),
      a: random(0.06, 0.22),
      hue: random(0, 360),
      drift: random(0.2, 1.0)
    });
  }

  const g = floor(map(min(width, height), 400, 1400, 260, 600, true));
  for (let i = 0; i < g; i++) {
    glitter.push({
      x: random(width),
      y: random(height),
      v: random(0.4, 1.6),
      p: random(TAU),
      s: random(0.6, 2.4)
    });
  }
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
  if (key === 's' || key === 'S') saveCanvas(`xmas_${seed}`, 'png');
}

function draw() {
  if (paused) return;

  background(230, 25, 4, 0.2);
  const t = t0 + frameCount * 0.01;

  drawFestiveLights(t);
  drawSanta(t);
  drawSnow(t);
}

function festiveHue(x) {
  const bands = [0, 10, 25, 45, 140, 160, 180];
  const target = bands[floor(map(noise(x * 0.01), 0, 1, 0, bands.length))];
  return (target + random(-12, 12) + 360) % 360;
}

function drawFestiveLights(t) {
  for (const c of cells) {
    const nx = noise(c.x * 0.002, c.y * 0.002, t);
    const ny = noise(c.x * 0.002 + 10, c.y * 0.002 + 10, t);
    const x = (c.x + (nx - 0.5) * 180 + width) % width;
    const y = (c.y + (ny - 0.5) * 180 + height) % height;

    const h = festiveHue(x + y);
    for (let k = 0; k < 4; k++) {
      stroke(h, 85, 95, c.a * (1 - k * 0.2));
      strokeWeight(1.2 + k * 1.1);
      circle(x, y, c.r * (1 + k * 0.25));
    }
  }
}

function drawSnow(t) {
  for (const g of glitter) {
    g.y += g.v;
    g.x += sin(g.p + t) * 0.4;
    if (g.y > height + 20) {
      g.y = -20;
      g.x = random(width);
    }
    stroke(0, 0, 100, 0.12);
    strokeWeight(g.s);
    point(g.x, g.y);
  }
}

function drawSanta(t) {
  push();
  translate(width * 0.5 + sin(t * 0.6) * 120, height * 0.45 + cos(t * 0.4) * 80);
  scale(min(width, height) * 0.0022);
  rotate(sin(t * 0.3) * 0.05);

  // glow
  for (let i = 6; i > 0; i--) {
    stroke(0, 80, 100, 0.03);
    strokeWeight(i * 8);
    santaShape();
  }

  // body
  stroke(0, 85, 95, 0.9);
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
  endShape();

  // body
  beginShape();
  vertex(-35, 10);
  vertex(-45, 70);
  vertex(45, 70);
  vertex(35, 10);
  endShape();
}
