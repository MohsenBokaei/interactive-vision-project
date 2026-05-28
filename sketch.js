let cam;
let greenCenter = null;
let blueCenter = null;
let imageParticles = [];
let motionRange = 0;
let maxMotion = 10;
let revealRadius = 50;
let influenceRadius = 150;
let influenceStartTime = 0;
let bluePath = [];
let trackBluePath = false;
let pathVisibilityDuration = 3000;
let showCamera = false;
let bgImg;

function preload() {
  // Ensure this filename matches exactly what you upload to GitHub
  bgImg = loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
}

function setup() {
  createCanvas(1600, 900);
  
  bgImg.resize(width, height);
  bgImg.loadPixels();
  
  // Initialize Particle System (Step 10 matches your density)
  for (let y = 0; y < bgImg.height; y += 10) {
    for (let x = 0; x < bgImg.width; x += 10) {
      let index = (x + y * bgImg.width) * 4;
      let r = bgImg.pixels[index];
      let g = bgImg.pixels[index + 1];
      let b = bgImg.pixels[index + 2];
      let a = bgImg.pixels[index + 3];
      imageParticles.push(new ImageParticle(x, y, color(r, g, b, a)));
    }
  }

  // Camera Setup
  cam = createCapture(VIDEO);
  cam.size(640, 480); // Standard capture size for better performance
  cam.hide(); 
}

function draw() {
  if (showCamera) {
    // Mirror the camera feed for the toggle view
    push();
    translate(width, 0);
    scale(-1, 1);
    image(cam, 0, 0, width, height);
    pop();
  } else {
    background(0);

    let mirroredGreenCenter = null;
    let mirroredBlueCenter = null;

    cam.loadPixels();
    if (cam.pixels.length > 0) {
      // 1. Find Green Center
      let detectedGreen = findSpecificGreenCenter(cam);
      if (detectedGreen != null) {
        if (greenCenter == null) {
          greenCenter = detectedGreen.copy();
        } else {
          greenCenter = p5.Vector.lerp(greenCenter, detectedGreen, 0.1);
        }
      }

      // 2. Find Blue Center
      let detectedBlue = findSpecificBlueCenter(cam);
      if (detectedBlue != null) {
        if (blueCenter == null) {
          blueCenter = detectedBlue.copy();
        } else {
          blueCenter = p5.Vector.lerp(blueCenter, detectedBlue, 0.1);
          influenceStartTime = millis();
          trackBluePath = true;
        }
      }

      // Handle Mirrored Logic (Green)
      if (greenCenter != null) {
        mirroredGreenCenter = createVector(width - greenCenter.x, greenCenter.y);
        // Draw the white dot logic from original code
        fill(255);
        noStroke();
        ellipse(width - greenCenter.x, greenCenter.y, 10, 10);
      }

      // Handle Mirrored Logic (Blue)
      if (blueCenter != null) {
        mirroredBlueCenter = createVector(width - blueCenter.x, blueCenter.y);
        bluePath.push(new BluePathPoint(mirroredBlueCenter.copy(), millis()));
        
        fill(0, 150, 255);
        noStroke();
        ellipse(width - blueCenter.x, blueCenter.y, 10, 10);
      }
    }

    // Remove old path points (3 seconds)
    while (bluePath.length > 0 && millis() - bluePath[0].timestamp > pathVisibilityDuration) {
      bluePath.shift();
    }

    // Draw Blue Path
    for (let i = 1; i < bluePath.length; i++) {
      let alpha = map(millis() - bluePath[i].timestamp, 0, pathVisibilityDuration, 255, 0);
      stroke(0, 150, 255, alpha);
      strokeWeight(2);
      line(bluePath[i-1].position.x, bluePath[i-1].position.y, bluePath[i].position.x, bluePath[i].position.y);
    }

    // Calculate Motion
    let motionAmount = calculateMotion(cam);
    motionRange = map(motionAmount, 0, 10, 0, 10);

    // Render Particles
    for (let p of imageParticles) {
      if (mirroredGreenCenter != null) {
        p.revealIfNear(mirroredGreenCenter, revealRadius);
      }
      if (mirroredBlueCenter != null && p.isNear(mirroredBlueCenter, influenceRadius)) {
        if (millis() - influenceStartTime <= 10000) {
          p.applyVortexEffect(mirroredBlueCenter);
        } else {
          p.resetInfluence();
        }
      }
      p.update(motionRange);
      p.show();
    }
  }
}

function mousePressed() {
  showCamera = !showCamera;
}

// EXACT GREEN THRESHOLDS FROM YOUR CODE
function findSpecificGreenCenter(img) {
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let i = (x + y * img.width) * 4;
      let r = img.pixels[i], g = img.pixels[i+1], b = img.pixels[i+2];
      if (g > 200 && g < 255 && r < 100 && b < 100) {
        sumX += x; sumY += y; count++;
      }
    }
  }
  if (count > 0) {
    return createVector(map(sumX/count, 0, img.width, 0, width), map(sumY/count, 0, img.height, 0, height));
  }
  return null;
}

// EXACT BLUE THRESHOLDS FROM YOUR CODE
function findSpecificBlueCenter(img) {
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let i = (x + y * img.width) * 4;
      let r = img.pixels[i], g = img.pixels[i+1], b = img.pixels[i+2];
      if (b > 180 && b < 255 && r < 120 && g < 200) {
        sumX += x; sumY += y; count++;
      }
    }
  }
  if (count > 0) {
    return createVector(map(sumX/count, 0, img.width, 0, width), map(sumY/count, 0, img.height, 0, height));
  }
  return null;
}

function calculateMotion(img) {
  let motionSum = 0;
  for (let i = 0; i < img.pixels.length; i += 4) {
    let bright = (img.pixels[i] + img.pixels[i+1] + img.pixels[i+2]) / 3;
    motionSum += bright;
  }
  let avgBrightness = motionSum / (img.width * img.height);
  return map(avgBrightness, 0, 255, 0, 10);
}

class BluePathPoint {
  constructor(pos, ts) {
    this.position = pos;
    this.timestamp = ts;
  }
}

class ImageParticle {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    this.originalX = x;
    this.originalY = y;
    this.latestX = x;
    this.latestY = y;
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.c = c;
    this.visible = false;
    this.influenced = false;
  }

  revealIfNear(center, radius) {
    if (dist(this.x, this.y, center.x, center.y) <= radius) {
      this.visible = true;
    }
  }

  applyVortexEffect(center) {
    let d = dist(this.x, this.y, center.x, center.y);
    let dir = createVector(this.x - center.x, this.y - center.y);
    dir.rotate(HALF_PI);
    let speed = map(d, 0, influenceRadius, 4, 0.5);
    this.vx = dir.normalize().x * speed + random(-0.5, 0.5);
    this.vy = dir.y * speed + random(-0.5, 0.5);
    this.influenced = true;
  }

  resetInfluence() {
    if (this.influenced) {
      this.x = this.latestX;
      this.y = this.latestY;
      this.vx = random(-1, 1);
      this.vy = random(-1, 1);
      this.influenced = false;
    }
  }

  isNear(center, radius) {
    return dist(this.x, this.y, center.x, center.y) <= radius;
  }

  update(range) {
    let jitter = (range > 0) ? 0.5 : 0.1;
    this.x += random(-jitter, jitter);
    this.y += random(-jitter, jitter);

    if (range > 0.1) {
      this.x += this.vx * range;
      this.y += this.vy * range;
    }

    let attractionStrength = map(range, 0, 10, 0.2, 0);
    this.x += (this.originalX - this.x) * attractionStrength;
    this.y += (this.originalY - this.y) * attractionStrength;

    if (dist(this.x, this.y, this.originalX, this.originalY) > range * 10) {
      this.vx *= -1;
      this.vy *= -1;
    }
  }

  show() {
    if (this.visible) {
      fill(this.c);
      noStroke();
      ellipse(this.x, this.y, 4, 4);
    }
  }
}
