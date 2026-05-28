// --- ORIGINAL VARIABLES PRESERVED ---
let cam;
let greenCenter = null;
let blueCenter = null;
let imageParticles = [];
let motionRange = 0;
let maxMotion = 10;
let revealRadius = 50;
let influenceRadius = 150;
let influenceStartTime = 0;
let bluePath = []; // List of BluePathPoint objects
let trackBluePath = false;
let pathVisibilityDuration = 3000;
let showCamera = false;
let bgImg;

// --- AI HAND TRACKING VARIABLES ---
let hands;
let handDetected = false;

function preload() {
    // Ensure this file is uploaded to your GitHub repo
    bgImg = loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
}

function setup() {
    createCanvas(1600, 900);

    // Initialize the background and particle system (Identical to your setup)
    bgImg.resize(width, height);
    imageParticles = [];
    bgImg.loadPixels();
    for (let y = 0; y < bgImg.height; y += 10) { // Density step 10
        for (let x = 0; x < bgImg.width; x += 10) {
            let index = (x + y * bgImg.width) * 4;
            let r = bgImg.pixels[index];
            let g = bgImg.pixels[index + 1];
            let b = bgImg.pixels[index + 2];
            let c = color(r, g, b);
            imageParticles.push(new ImageParticle(x, y, c));
        }
    }

    // Initialize Camera
    cam = createCapture(VIDEO);
    cam.size(640, 480);
    cam.hide();

    // Setup AI Hand Tracking
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(gotHands);

    const camera = new Camera(cam.elt, {
        onFrame: async () => {
            await hands.send({ image: cam.elt });
        },
        width: 640,
        height: 480
    });
    camera.start();
}

function gotHands(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        let hand = results.multiHandLandmarks[0];

        // Landmarks for tips: 8 = Index, 12 = Middle
        let indexTip = { x: (1 - hand[8].x) * width, y: hand[8].y * height };
        let middleTip = { x: (1 - hand[12].x) * width, y: hand[12].y * height };

        let d = dist(indexTip.x, indexTip.y, middleTip.x, middleTip.y);

        // LOGIC: TWO FINGERS TOGETHER = GREEN (Reveal)
        if (d < 50) {
            let detectedGreen = createVector(indexTip.x, indexTip.y);
            if (greenCenter == null) greenCenter = detectedGreen.copy();
            else greenCenter = p5.Vector.lerp(greenCenter, detectedGreen, 0.1);
            blueCenter = null; 
        } 
        // LOGIC: INDEX POINTING (Fingers apart) = BLUE (Vortex)
        else {
            let detectedBlue = createVector(indexTip.x, indexTip.y);
            if (blueCenter == null) blueCenter = detectedBlue.copy();
            else {
                blueCenter = p5.Vector.lerp(blueCenter, detectedBlue, 0.1);
                influenceStartTime = millis();
                trackBluePath = true;
            }
            greenCenter = null;
        }
    } else {
        handDetected = false;
        greenCenter = null;
        blueCenter = null;
    }
}

function draw() {
    if (showCamera) {
        push();
        translate(width, 0);
        scale(-1, 1);
        image(cam, 0, 0, width, height);
        pop();
    } else {
        background(0);

        // Path Tracking (Mirroring logic is handled in the AI block above)
        if (blueCenter != null) {
            bluePath.push(new BluePathPoint(blueCenter.copy(), millis()));
        }

        // Remove old points (3 seconds duration)
        while (bluePath.length > 0 && millis() - bluePath[0].timestamp > pathVisibilityDuration) {
            bluePath.shift();
        }

        // Draw Blue Trail (Identical to your line drawing logic)
        for (let i = 1; i < bluePath.length; i++) {
            let prev = bluePath[i - 1];
            let curr = bluePath[i];
            let alpha = map(millis() - curr.timestamp, 0, pathVisibilityDuration, 255, 0);
            stroke(0, 150, 255, alpha);
            strokeWeight(2);
            line(prev.position.x, prev.position.y, curr.position.x, curr.position.y);
        }

        // Calculate Motion (Identical to your original brightness-based sum)
        let motionAmount = calculateMotion(cam);
        motionRange = map(motionAmount, 0, 10, 0, 10);

        // Render Particle System
        for (let p of imageParticles) {
            if (greenCenter != null) {
                p.revealIfNear(greenCenter, revealRadius);
            }
            if (blueCenter != null && p.isNear(blueCenter, influenceRadius)) {
                if (millis() - influenceStartTime <= 10000) {
                    p.applyVortexEffect(blueCenter);
                } else {
                    p.resetInfluence();
                }
            }
            p.update(motionRange);
            p.show();
        }

        // Draw HUD Dots
        if (greenCenter) { fill(255); noStroke(); ellipse(greenCenter.x, greenCenter.y, 10, 10); }
        if (blueCenter) { fill(0, 150, 255); noStroke(); ellipse(blueCenter.x, blueCenter.y, 10, 10); }
    }
}

function mousePressed() {
    showCamera = !showCamera;
}

// --- ORIGINAL MOTION CALCULATION LOGIC ---
function calculateMotion(img) {
    img.loadPixels();
    if (img.pixels.length === 0) return 0;
    let motionSum = 0;
    let count = 0;
    for (let i = 0; i < img.pixels.length; i += 40) { // Optimized sampling
        let r = img.pixels[i];
        let g = img.pixels[i+1];
        let b = img.pixels[i+2];
        let bright = (r + g + b) / 3;
        motionSum += bright;
        count++;
    }
    return map(motionSum / count, 0, 255, 0, 10);
}

// --- ORIGINAL CLASSES PRESERVED ---
class BluePathPoint {
    constructor(position, timestamp) {
        this.position = position;
        this.timestamp = timestamp;
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
        // Original jitter logic
        let jitter = (range > 0) ? 0.5 : 0.1;
        this.x += random(-jitter, jitter);
        this.y += random(-jitter, jitter);

        if (range > 0.1) {
            this.x += this.vx * range;
            this.y += this.vy * range;
        }

        // Original attraction back to home
        let attractionStrength = map(range, 0, 10, 0.2, 0);
        this.x += (this.originalX - this.x) * attractionStrength;
        this.y += (this.originalY - this.y) * attractionStrength;

        // Original bounce logic
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
