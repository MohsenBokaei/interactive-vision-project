const sketch = (p) => {
    let cam;
    let greenCenter = null;
    let blueCenter = null;
    let imageParticles = [];
    let motionRange = 0;
    let revealRadius = 70;
    let influenceRadius = 150;
    let influenceStartTime = 0;
    let bluePath = [];
    let pathVisibilityDuration = 3000;
    let showCamera = false;
    let bgImg;
    let hands;
    let predictions = [];

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

        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        hands.onResults((results) => {
            predictions = results.multiHandLandmarks;
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

            if (predictions && predictions.length > 0) {
                let hand = predictions[0];
                
                // Get Landmarks (0-20)
                // 8 = Index Tip, 12 = Middle Tip, 16 = Ring Tip, 20 = Pinky Tip
                let indexTip = p.createVector((1 - hand[8].x) * p.width, hand[8].y * p.height);
                let middleTip = p.createVector((1 - hand[12].x) * p.width, hand[12].y * p.height);
                let ringTip = p.createVector((1 - hand[16].x) * p.width, hand[16].y * p.height);
                let pinkyTip = p.createVector((1 - hand[20].x) * p.width, hand[20].y * p.height);
                let palm = p.createVector((1 - hand[0].x) * p.width, hand[0].y * p.height);

                // --- GESTURE DETECTION ---
                
                // 1. POSE IN YOUR IMAGE: Index & Middle up and touching
                let fingersTogether = p.dist(indexTip.x, indexTip.y, middleTip.x, middleTip.y) < 50;
                let ringDown = ringTip.y > hand[14].y * p.height; // Is ring finger curled?
                let pinkyDown = pinkyTip.y > hand[18].y * p.height; // Is pinky finger curled?

                if (fingersTogether && ringDown && pinkyDown) {
                    // This is the "Green" Function
                    greenCenter = indexTip.copy();
                    blueCenter = null;
                } 
                // 2. POSE: Only Index finger up (Middle, Ring, Pinky down)
                else if (indexTip.y < hand[6].y * p.height && middleTip.y > hand[10].y * p.height) {
                    // This is the "Blue" Function
                    blueCenter = indexTip.copy();
                    greenCenter = null;
                    influenceStartTime = p.millis();
                    bluePath.push({ pos: blueCenter.copy(), time: p.millis() });
                } else {
                    greenCenter = null;
                    blueCenter = null;
                }
            }

            // --- THE REST OF YOUR ORIGINAL LOGIC ---
            bluePath = bluePath.filter(pt => p.millis() - pt.time < pathVisibilityDuration);
            for (let i = 1; i < bluePath.length; i++) {
                let alpha = p.map(p.millis() - bluePath[i].time, 0, pathVisibilityDuration, 255, 0);
                p.stroke(0, 150, 255, alpha); p.strokeWeight(2);
                p.line(bluePath[i-1].pos.x, bluePath[i-1].pos.y, bluePath[i].pos.x, bluePath[i].pos.y);
            }

            let motion = calculateMotion(cam);
            motionRange = p.map(motion, 0, 255, 0, 10);

            for (let part of imageParticles) {
                if (greenCenter) part.revealIfNear(greenCenter, revealRadius);
                if (blueCenter && part.isNear(blueCenter, influenceRadius)) {
                    if (p.millis() - influenceStartTime < 10000) part.applyVortexEffect(blueCenter);
                    else part.resetInfluence();
                }
                part.update(motionRange);
                part.show();
            }

            if (greenCenter) { p.fill(255); p.noStroke(); p.ellipse(greenCenter.x, greenCenter.y, 15); }
            if (blueCenter) { p.fill(0, 150, 255); p.noStroke(); p.ellipse(blueCenter.x, blueCenter.y, 15); }
        }
    };

    p.mousePressed = () => { showCamera = !showCamera; };

    function calculateMotion(img) {
        img.loadPixels();
        let total = 0;
        if (img.pixels.length > 0) {
            for (let i = 0; i < img.pixels.length; i += 800) { total += img.pixels[i]; }
            return total / (img.pixels.length / 800);
        }
        return 0;
    }
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
