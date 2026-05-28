const sketch = (p) => {
    let cam, bgImg;
    let particles = [];
    let fluid;
    let hands;
    
    let greenCenter = null; 
    let blueCenter = null;  
    let prevGreen = null;
    let prevBlue = null;
    
    let aiLoaded = false;

    p.preload = () => {
        bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
    };

    p.setup = () => {
        p.createCanvas(1600, 900);
        bgImg.resize(p.width, p.height);
        
        fluid = new FluidSimulation(p, p.width, p.height);

        bgImg.loadPixels();
        for (let y = 0; y < bgImg.height; y += 12) {
            for (let x = 0; x < bgImg.width; x += 12) {
                let i = (x + y * bgImg.width) * 4;
                let c = p.color(bgImg.pixels[i], bgImg.pixels[i+1], bgImg.pixels[i+2], 200);
                particles.push(new ImageParticle(p, x, y, c));
            }
        }

        // Setup Camera
        cam = p.createCapture(p.VIDEO);
        cam.size(640, 480);
        cam.hide();

        // Initialize MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // Lite model for better performance
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        // Explicitly start the camera connection
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
        aiLoaded = true; // Confirms AI is actually sending data
        
        // Reset centers before processing
        let foundRight = false;
        let foundLeft = false;

        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                let hand = results.multiHandLandmarks[i];
                let label = results.multiHandedness[i].label; // "Left" or "Right"
                
                // Track Index Finger Tip (Landmark 8)
                let x = (1 - hand[8].x) * p.width; // Flip for mirror
                let y = hand[8].y * p.height;
                let currentPos = p.createVector(x, y);

                if (label === "Left") { // Mirror logic: AI Left = Your Right hand
                    if (prevGreen) {
                        let force = p5.Vector.sub(currentPos, prevGreen);
                        fluid.addForce(currentPos.x, currentPos.y, force.x, force.y, 100);
                    }
                    greenCenter = currentPos;
                    prevGreen = currentPos.copy();
                    foundRight = true;
                } else {
                    if (prevBlue) {
                        let force = p5.Vector.sub(currentPos, prevBlue);
                        fluid.addForce(currentPos.x, currentPos.y, force.x, force.y, 100);
                    }
                    blueCenter = currentPos;
                    prevBlue = currentPos.copy();
                    foundLeft = true;
                }
            }
        }
        
        if (!foundRight) greenCenter = null;
        if (!foundLeft) blueCenter = null;
    }

    p.draw = () => {
        p.background(0, 40); 
        
        fluid.update();

        // Reveal and Move Particles
        for (let part of particles) {
            let flow = fluid.getVelocity(part.x, part.y);
            
            // Reveal if EITHER hand is nearby
            if (greenCenter && p.dist(part.x, part.y, greenCenter.x, greenCenter.y) < 100) part.visible = true;
            if (blueCenter && p.dist(part.x, part.y, blueCenter.x, blueCenter.y) < 100) part.visible = true;
            
            part.applyFlow(flow);
            part.update();
            part.show();
        }

        // --- DEBUG LAYER (Remove this once it works) ---
        if (!aiLoaded) {
            p.fill(255);
            p.textAlign(p.CENTER);
            p.text("AI LOADING... STAND IN VIEW", p.width/2, p.height/2);
        }

        // Draw visual dots so you know where the AI is tracking
        p.noStroke();
        if (greenCenter) {
            p.fill(0, 255, 100);
            p.ellipse(greenCenter.x, greenCenter.y, 20, 20);
        }
        if (blueCenter) {
            p.fill(0, 150, 255);
            p.ellipse(blueCenter.x, blueCenter.y, 20, 20);
        }
    };
};

// --- IMAGE PARTICLE CLASS ---
class ImageParticle {
    constructor(p, x, y, c) {
        this.p = p; this.x = x; this.y = y; this.ox = x; this.oy = y;
        this.c = c; this.visible = false;
        this.vx = 0; this.vy = 0;
    }
    applyFlow(f) { 
        this.vx += f.x * 0.12; 
        this.vy += f.y * 0.12; 
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.94; // Friction
        this.vy *= 0.94;
        this.x += (this.ox - this.x) * 0.02; // Snap back
        this.y += (this.oy - this.y) * 0.02;
    }
    show() {
        if (this.visible) {
            this.p.fill(this.c); this.p.noStroke();
            this.p.rect(this.x, this.y, 4, 4);
        }
    }
}

new p5(sketch);
