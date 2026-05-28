let cam;
let hands;
let predictions = [];

// Interaction Centers
let greenCenter = null;
let blueCenter = null;

// Particle System Variables
let imageParticles = [];
let revealRadius = 60;
let influenceRadius = 150;
let bluePath = [];
let influenceStartTime = 0;
let bgImg;
let showCamera = false;

function preload() {
  bgImg = loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
}

function setup() {
  createCanvas(1600, 900);
  bgImg.resize(width, height);
  
  // Create Particles (Density Step 12 for performance)
  bgImg.loadPixels();
  for (let y = 0; y < bgImg.height; y += 12) {
    for (let x = 0; x < bgImg.width; x += 12) {
      let index = (x + y * bgImg.width) * 4;
      let c = color(bgImg.pixels[index], bgImg.pixels[index+1], bgImg.pixels[index+2]);
      imageParticles.push(new ImageParticle(x, y, c));
    }
  }

  // Setup Camera
  cam = createCapture(VIDEO);
  cam.size(640, 480);
  cam.hide();

  // Initialize MediaPipe Hands
  hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  hands.onResults(onResults);

  // Start the AI tracking loop
  function predict() {
    hands.send({image: cam.elt});
    requestAnimationFrame(predict);
  }
  predict();
}

function onResults(results) {
  predictions = results.multiHandLandmarks;
}

function draw() {
  background(0);

  if (showCamera) {
    push();
    translate(width, 0); scale(-1, 1);
    image(cam, 0, 0, width, height);
    pop();
  }

  // Process Hand Data
  if (predictions && predictions.length > 0) {
    let hand = predictions[0];
    
    // Landmark 8 = Index Tip, Landmark 12 = Middle Tip
    let indexTip = { x: (1 - hand[8].x) * width, y: hand[8].y * height };
    let middleTip = { x: (1 - hand[12].x) * width, y: hand[12].y * height };
    
    // Calculate distance between fingers
    let fingerDist = dist(indexTip.x, indexTip.y, middleTip.x, middleTip.y);

    // GESTURE 1: TWO FINGERS STICKED (Green)
    if (fingerDist < 40) { 
        greenCenter = createVector(indexTip.x, indexTip.y);
        blueCenter = null; // Turn off blue when fingers together
    } 
    // GESTURE 2: ONE FINGER POINTING (Blue)
    else {
        blueCenter = createVector(indexTip.x, indexTip.y);
        greenCenter = null;
        influenceStartTime = millis();
        bluePath.push({pos: blueCenter.copy(), time: millis()});
    }
  } else {
    greenCenter = null;
    blueCenter = null;
  }

  // Particle Logic
  bluePath = bluePath.filter(p => millis() - p.time < 3000);

  for (let p of imageParticles) {
    if (greenCenter) p.revealIfNear(greenCenter, revealRadius);
    if (blueCenter && p.isNear(blueCenter, influenceRadius)) {
        p.applyVortexEffect(blueCenter);
    } else {
        p.resetInfluence();
    }
    p.update();
    p.show();
  }

  // Draw UI Indicators
  if (greenCenter) { fill(255); noStroke(); ellipse(greenCenter.x, greenCenter.y, 15); }
  if (blueCenter) { fill(0, 150, 255); noStroke(); ellipse(blueCenter.x, blueCenter.y, 15); }
}

function mousePressed() { showCamera = !showCamera; }

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
    let dir = p5.Vector.sub(this.pos, center).rotate(HALF_PI).limit(4);
    this.vel = dir;
    this.influenced = true;
  }
  resetInfluence() { this.influenced = false; }
  update() {
    if (this.influenced) {
      this.pos.add(this.vel);
    } else {
      this.pos.lerp(this.origin, 0.1); // Smoothly snap back
    }
    // Subtle jitter
    this.pos.add(random(-0.2, 0.2), random(-0.2, 0.2));
  }
  show() {
    if (this.visible) {
      noStroke(); fill(this.c);
      ellipse(this.pos.x, this.pos.y, 5, 5);
    }
  }
}
