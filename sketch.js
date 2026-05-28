const sketch = (p) => {
  let cam;
  let bgImg;
  let particles = [];
  let greenCenter = null; // Right Hand
  let blueCenter = null;  // Left Hand
  let bluePath = [];
  let handsAI;

  p.preload = () => {
    // Ensure the filename is exactly as it is on GitHub
    bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    bgImg.resize(p.width, p.height);

    // Initialize Particle System
    bgImg.loadPixels();
    for (let y = 0; y < bgImg.height; y += 12) {
      for (let x = 0; x < bgImg.width; x += 12) {
        let i = (x + y * bgImg.width) * 4;
        let c = p.color(bgImg.pixels[i], bgImg.pixels[i + 1], bgImg.pixels[i + 2]);
        particles.push(new ImageParticle(p, x, y, c));
      }
    }

    // Camera Setup
    cam = p.createCapture(p.VIDEO);
    cam.size(640, 480);
    cam.hide();

    // Start MediaPipe Hands AI
    handsAI = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsAI.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    handsAI.onResults(onResults);

    const camera = new Camera(cam.elt, {
      onFrame: async () => {
        await handsAI.send({ image: cam.elt });
      },
      width: 640,
      height: 480
    });
    camera.start();
  };

  function onResults(results) {
    let foundRight = false;
    let foundLeft = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        let landmarks = results.multiHandLandmarks[i];
        let label = results.multiHandedness[i].label; // "Left" or "Right"

        // Landmark 8 is Index Finger Tip
        let x = (1 - landmarks[8].x) * p.width; // Mirrored
        let y = landmarks[8].y * p.height;
        let pos = p.createVector(x, y);

        // Note: In mirrored selfie view, MediaPipe "Left" label is your Right Hand
        if (label === "Left") {
          if (!greenCenter) greenCenter = pos;
          else greenCenter = p5.Vector.lerp(greenCenter, pos, 0.2);
          foundRight = true;
        } else {
          if (!blueCenter) blueCenter = pos;
          else blueCenter = p5.Vector.lerp(blueCenter, pos, 0.2);
          bluePath.push({ pos: blueCenter.copy(), time: p.millis() });
          foundLeft = true;
        }
      }
    }
    if (!foundRight) greenCenter = null;
    if (!foundLeft) blueCenter = null;
  }

  p.draw = () => {
    p.background(0);

    // Fade the Blue Trail
    bluePath = bluePath.filter(pt => p.millis() - pt.time < 3000);
    for (let i = 1; i < bluePath.length; i++) {
      let a = p.map(p.millis() - bluePath[i].time, 0, 3000, 255, 0);
      p.stroke(0, 150, 255, a);
      p.strokeWeight(2);
      p.line(bluePath[i - 1].pos.x, bluePath[i - 1].pos.y, bluePath[i].pos.x, bluePath[i].pos.y);
    }

    // Process Particles
    for (let part of particles) {
      if (greenCenter) part.revealIfNear(greenCenter, 80);
      if (blueCenter && part.isNear(blueCenter, 150)) {
        part.applyVortexEffect(blueCenter);
      } else {
        part.resetInfluence();
      }
      part.update();
      part.show();
    }

    // Visual Helpers (Dots on fingers)
    if (greenCenter) { p.fill(0, 255, 0); p.noStroke(); p.ellipse(greenCenter.x, greenCenter.y, 15); }
    if (blueCenter) { p.fill(0, 150, 255); p.noStroke(); p.ellipse(blueCenter.x, blueCenter.y, 15); }
  };
};

class ImageParticle {
  constructor(p, x, y, c) {
    this.p = p;
    this.pos = p.createVector(x, y);
    this.origin = p.createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.c = c;
    this.visible = false;
    this.influenced = false;
  }
  revealIfNear(center, r) {
    if (this.p.dist(this.pos.x, this.pos.y, center.x, center.y) < r) this.visible = true;
  }
  isNear(center, r) {
    return this.p.dist(this.pos.x, this.pos.y, center.x, center.y) < r;
  }
  applyVortexEffect(center) {
    let dir = p5.Vector.sub(this.pos, center).rotate(this.p.HALF_PI).setMag(4);
    this.vel = dir;
    this.influenced = true;
  }
  resetInfluence() { this.influenced = false; }
  update() {
    if (this.influenced) {
      this.pos.add(this.vel);
    } else {
      this.pos.x = this.p.lerp(this.pos.x, this.origin.x, 0.1);
      this.pos.y = this.p.lerp(this.pos.y, this.origin.y, 0.1);
    }
  }
  show() {
    if (this.visible) {
      this.p.fill(this.c);
      this.p.noStroke();
      this.p.rect(this.pos.x, this.pos.y, 4, 4);
    }
  }
}

new p5(sketch);
