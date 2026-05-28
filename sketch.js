const sketch = (p) => {
    let cam;
    let greenCenter = null; 
    let blueCenter = null;  
    let imageParticles = [];
    let revealRadius = 80;
    let influenceRadius = 150;
    let bluePath = [];
    let pathVisibilityDuration = 3000;
    let showCamera = false;
    let bgImg;
    
    // AI Tracking variables
    let hands;
    
    // --- PERSISTENCE VARIABLES (The Fix for Glitching) ---
    let rightHandTimer = 0;
    let leftHandTimer = 0;
    const MAX_LOST_FRAMES = 15; // How many frames to "remember" the hand after it's lost

    p.preload = () => {
        bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
    };

    p.setup = () => {
        p.createCanvas(1600, 900);
        bgImg.resize(p.width, p.height);
        bgImg.loadPixels();
        
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

        // Optimized Hands Settings
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // 0 is much faster for movement than 1
            minDetectionConfidence: 0.4, // Lowered slightly so it doesn't "drop" fast hands
            minTrackingConfidence: 0.4
        });

        hands.onResults(onResults);

        const camera = new Camera(cam.elt, {
            onFrame: async () => {
                await hands.send({ image: cam.elt });
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
                let hand = results.multiHandLandmarks[i];
                let label = results.multiHandedness[i].label; // "Left" or "Right"
                
                let tipX = (1 - hand[8].x) * p.width;
                let tipY = hand[8].y * p.height;
                let currentPos = p.createVector(tipX, tipY);

                if (label === "Left") { // Mirror logic: AI Left = User Right
                    if (!greenCenter) greenCenter = currentPos;
                    else greenCenter = p5.Vector.lerp(greenCenter, currentPos, 0.4); // Faster lerp for speed
                    foundRight = true;
                    rightHandTimer = MAX_LOST_FRAMES; // Reset the "memory" timer
                } else {
                    if (!blueCenter) blueCenter = currentPos;
                    else blueCenter = p5.Vector.lerp(blueCenter, currentPos, 0.4);
                    foundLeft = true;
                    leftHandTimer = MAX_LOST_FRAMES;
                    bluePath.push({ pos: blueCenter.copy(), time: p.millis() });
                }
            }
        }

        // Only set to null if we haven't seen the hand for X frames
        if (!foundRight) {
            rightHandTimer--;
            if (rightHandTimer <= 0) greenCenter = null;
        }
        if (!foundLeft) {
            leftHandTimer--;
            if (leftHandTimer <= 0) blueCenter = null;
        }
    }

    p.draw = () => {
        if (showCamera) {
            p.push();
            p.translate(p.width, 0); p.scale(-1, 1);
            p.image(cam, 0, 0, p.width, p.height);
            p.pop();
        } else {
            p.background(0);

            bluePath = bluePath.filter(pt => p.millis() - pt.time < pathVisibilityDuration);
            for (let i = 1; i < bluePath.length; i++) {
                let alpha = p.map(p.millis() - bluePath[i].time, 0, pathVisibilityDuration, 255, 0);
                p.stroke(0, 150, 255, alpha); p.strokeWeight(2);
                p.line(bluePath[i-1].pos.x, bluePath[i-1].pos.y, bluePath[i].pos.x, bluePath[i].pos.y);
            }

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

            if (greenCenter) { p.fill(0, 255, 0); p.noStroke(); p.ellipse(greenCenter.x, greenCenter.y, 15); }
            if (blueCenter) { p.fill(0, 150, 255); p.noStroke(); p.ellipse(blueCenter.x, blueCenter.y, 15); }
        }
    };

    function calculateMotion(img) {
        img.loadPixels();
        let total = 0;
        if (img.pixels.length > 0) {
            for (let i = 0; i < img.pixels.length; i += 1000) { total += img.pixels[i]; }
            return total / (img.pixels.length / 1000);
        }
        return 0;
    }
    
    p.mousePressed = () => { showCamera = !showCamera; };
};

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
        this.vx = dir.normalize().x * 6; this.vy = dir.y * 6;
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
