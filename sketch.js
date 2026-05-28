const sketch = (p) => {
    let cam;
    let greenCenter = null; // Right Hand
    let blueCenter = null;  // Left Hand
    let imageParticles = [];
    let motionRange = 0;
    let revealRadius = 80;
    let influenceRadius = 150;
    let influenceStartTime = 0;
    let bluePath = [];
    let pathVisibilityDuration = 3000;
    let showCamera = false;
    let bgImg;
    let hands;
    let predictions = [];
    let handedness = [];

    p.preload = () => {
        bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
    };

    p.setup = () => {
        p.createCanvas(1600, 900);
        bgImg.resize(p.width, p.height);
        bgImg.loadPixels();
        // Particle System
        for (let y = 0; y < bgImg.height; y += 12) {
            for (let x = 0; x < bgImg.width; x += 12) {
                let index = (x + y * bgImg.width) * 4;
                let c = p.color(bgImg.pixels[index], bgImg.pixels[index + 1], bgImg.pixels[index + 2]);
                imageParticles.push(new ImageParticle(p, x, y, c));
            }
        }

        cam = p.createCapture(p.VIDEO);
        cam.size(640, 480);
        cam.hide();

        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2, // DETECT BOTH HANDS
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            predictions = results.multiHandLandmarks;
            handedness = results.multiHandedness; // Get Left/Right labels
        });

        const camera = new Camera(cam.elt, {
            onFrame: async () => {
                await hands.send({ image: cam.elt });
            },
            width: 640,
            height: 480
        });
        camera.start();
    };

    p.draw = () => {
        if (showCamera) {
            p.push();
            p.translate(p.width, 0); p.scale(-1, 1);
            p.image(cam, 0, 0, p.width, p.height);
            p.pop();
        } else {
            p.background(0);

            // Logic to track Left vs Right independently
            let foundRight = false;
            let foundLeft = false;

            if (predictions && predictions.length > 0) {
                for (let i = 0; i < predictions.length; i++) {
                    let hand = predictions[i];
                    let label = handedness[i].label; // "Left" or "Right"
                    
                    // Landmark 8 is Index Tip
                    let tipX = (1 - hand[8].x) * p.width;
                    let tipY = hand[8].y * p.height;
                    let currentPos = p.createVector(tipX, tipY);

                    // Note: MediaPipe labels are mirrored. 
                    // Usually "Left" label in code = Right Hand on screen.
                    if (label === "Left") { 
                        // RIGHT HAND (Green Center)
                        if (!greenCenter) greenCenter = currentPos;
                        else greenCenter = p5.Vector.lerp(greenCenter, currentPos, 0.2);
                        foundRight = true;
                    } else {
                        // LEFT HAND (Blue Center)
                        if (!blueCenter) blueCenter = currentPos;
                        else blueCenter = p5.Vector.lerp(blueCenter, currentPos, 0.2);
                        foundLeft = true;
                        
                        // Add to Blue Trail
                        influenceStartTime = p.millis();
                        bluePath.push({ pos: blueCenter.copy(), time: p.millis() });
                    }
                }
            }

            // Reset centers if hands are removed from camera
            if (!foundRight) greenCenter = null;
            if (!foundLeft) blueCenter = null;

            // Blue Trail Logic
            bluePath = bluePath.filter(pt => p.millis() - pt.time < pathVisibilityDuration);
            for (let i = 1; i < bluePath.length; i++) {
                let alpha = p.map(p.millis() - bluePath[i].time, 0, pathVisibilityDuration, 255, 0);
                p.stroke(0, 150, 255, alpha); p.strokeWeight(2);
                p.line(bluePath[i-1].pos.x, bluePath[i-1].pos.y, bluePath[i].pos.x, bluePath[i].pos.y);
            }

            // Motion and Particle rendering
            let motion = calculateMotion(cam);
            let motionRange = p.map(motion, 0, 255, 0, 10);

            for (let part of imageParticles) {
                if (greenCenter) part.revealIfNear(greenCenter, revealRadius);
                if (blueCenter && part.isNear(blueCenter, influenceRadius)) {
                    part.applyVortexEffect(blueCenter);
                } else {
                    part.resetInfluence();
                }
                part.update(motionRange);
                part.show();
            }

            // Visual Indicators
            if (greenCenter) { p.fill(0, 255, 0); p.noStroke(); p.ellipse(greenCenter.x, greenCenter.y, 15); }
            if (blueCenter) { p.fill(0, 150, 255); p.noStroke(); p.ellipse(blueCenter.x, blueCenter.y, 15); }
        }
    };

    function calculateMotion(img) {
        img.loadPixels();
        let total = 0;
        if (img.pixels.length > 0) {
            for (let i = 0; i < img.pixels.length; i += 800) { total += img.pixels[i]; }
            return total / (img.pixels.length / 800);
        }
        return 0;
    }
    
    p.mousePressed = () => { showCamera = !showCamera; };
};

// --- PARTICLE CLASS (Keeping your requested original logic) ---
class ImageParticle {
    constructor(p, x, y, c) {
        this.p = p; this.x = x; this.y = y; this.ox = x; this.oy = y;
        this.vx = p.random(-1, 1); this.vy = p.random(-1, 1);
        this.c = c; this.visible = false; this.influenced = false;
    }
    revealIfNear(center, r) { if (this.p.dist(this.x, this.y, center.x, center.y) < r) this.visible = true; }
    isNear(center, r) { return this.p.dist(this.x, this.y, center.x, center.y) < r; }
    applyVortexEffect(center) {
        let dir = p5.Vector.sub(this.p.createVector(this.x, this.y), center).rotate(this.p.HALF_PI);
        this.vx = dir.normalize().x * 4; this.vy = dir.y * 4;
        this.influenced = true;
    }
    resetInfluence() { this.influenced = false; }
    update(range) {
        let jitter = range > 0 ? 0.6 : 0.1;
        this.x += this.p.random(-jitter, jitter);
        this.y += this.p.random(-jitter, jitter);
        if (this.influenced) { this.x += this.vx; this.y += this.vy; } 
        else {
            let attr = this.p.map(range, 0, 10, 0.15, 0.05);
            this.x += (this.ox - this.x) * attr;
            this.y += (this.oy - this.y) * attr;
        }
    }
    show() { if (this.visible) { this.p.fill(this.c); this.p.noStroke(); this.p.ellipse(this.x, this.y, 4, 4); } }
}

new p5(sketch);
