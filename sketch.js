let handpose;
let video;
let hands = [];

// Particle System
let particles = [];
let bgImg;
let revealRadius = 70;
let influenceRadius = 150;

// Smoothed Centers (This stops the glitching/shaking)
let smoothGreen = null;
let smoothBlue = null;
let lerpAmount = 0.2; // Adjust between 0.01 (very smooth) and 0.5 (very fast)

let bluePath = [];
let influenceStartTime = 0;

function preload() {
  bgImg = loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
}

function setup() {
  createCanvas(1600, 900);
  bgImg.resize(width, height);

  // Initialize Particles (Step 12 for high performance)
  bgImg.loadPixels();
  for (let y = 0; y < bgImg.height; y += 12) {
    for (let x = 0; x < bgImg.width; x += 12) {
      let i = (x + y * bgImg.width) * 4;
      let c = color(bgImg.pixels[i], bgImg.pixels[i + 1], bgImg.pixels[i + 2]);
      particles.push(new ImageParticle(x, y, c));
    }
  }

  // Setup Video
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // Initialize ml5 Handpose (Highly Optimized)
  handpose = ml5.handpose(video, { flipped: true }, modelLoaded);
  handpose.on("hand", (results) => {
    hands = results;
  });

  smoothGreen = createVector(width / 2, height / 2);
  smoothBlue = createVector(width / 2, height / 2);
}

function modelLoaded() {
  console.log("Hand Model Ready!");
}

function draw() {
  background(0);

  if (hands.length > 0) {
    let hand = hands[0];
    
    // Landmark 8: Index Tip, 12: Middle Tip
    let indexTip = hand.index_finger_tip;
    let middleTip = hand.middle_finger_tip;

    // Convert normalized coords (0-1) to screen coords
    let targetX = indexTip.x * width;
    let targetY = indexTip.y * height;
    let mTargetX = middleTip.x * width;
    let mTargetY = middleTip.y * height;

    // Calculate distance between Index and Middle finger
    let d = dist(targetX, targetY, mTargetX, mTargetY);

    // --- SMOOTHING LOGIC (The Fix for Glitching) ---
    if (d < 60) {
      // TWO FINGERS TOGETHER: Reveal Mode
      smoothGreen.x = lerp(smoothGreen.x, targetX, lerpAmount);
      smoothGreen.y = lerp(smoothGreen.y, targetY, lerpAmount);
      activeGreen = true;
      activeBlue = false;
    } else {
      // ONE FINGER POINTING: Vortex Mode
      smoothBlue.x = lerp(smoothBlue.x, targetX, lerpAmount);
      smoothBlue.y = lerp(smoothBlue.y, targetY, lerpAmount);
      activeBlue = true;
      activeGreen = false;
      influenceStartTime = millis();
      bluePath.push({ pos: createVector(smoothBlue.x, smoothBlue.y), time: millis() });
    }
  } else {
    activeGreen = false;
    activeBlue = false;
  }

  // Draw Path
  bluePath = bluePath.filter(p => millis() - p.time < 2000);
  for (let i = 1; i < bluePath.length; i++) {
    stroke(0, 150, 255, map(millis() - bluePath[i].time, 0, 2000, 255, 0));
    strokeWeight(3);
    line(bluePath[i-1].pos.x, bluePath[i-1].pos.y, bluePath[i].pos.x, bluePath[i].pos.y);
  }

  // Update Particles
  for (let p of particles) {
    if (activeGreen) p.revealIfNear(smoothGreen, revealRadius);
    if (activeBlue && p.isNear(smoothBlue, influenceRadius)) {
        p.applyVortexEffect(smoothBlue);
    } else {
        p.resetInfluence();
    }
    p.update();
    p.show();
  }

  // Indicators
  noStroke();
  if (activeGreen) { fill(255); ellipse(smoothGreen.x, smoothGreen.y, 15); }
  if (activeBlue) { fill(0, 150, 255); ellipse(smoothBlue.x, smoothBlue.y, 15); }
}

class ImageParticle {
  constructor(x, y, c) {
    this.pos = createVector(x, y);
    this.origin = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.c = c;
    this.visible = false;
    this.influenced = false;
  }
  revealIfNear(center, r) { if (dist(this.pos.x, this.pos.y, center.x, center.y) < r) this.visible = true; }
  isNear(center, r) { return dist(this.pos.x, this.pos.y, center.x, center.y) < r; }
  applyVortexEffect(center) {
    let dir = p5.Vector.sub(this.pos, center).rotate(HALF_PI).setMag(4);
    this.vel = dir;
    this.influenced = true;
  }
  resetInfluence() { this.influenced = false; }
  update() {
    if (this.influenced) {
      this.pos.add(this.vel);
    } else {
      this.pos.x = lerp(this.pos.x, this.origin.x, 0.1);
      this.pos.y = lerp(this.pos.y, this.origin.y, 0.1);
    }
  }
  show() { if (this.visible) { fill(this.c); noStroke(); rect(this.pos.x, this.pos.y, 4, 4); } }
}
