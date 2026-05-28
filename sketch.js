const sketch = (p) => {
    let cam, bgImg;
    let particles = [];
    let fluid;
    let hands;
    let greenCenter = null; // Right
    let blueCenter = null;  // Left
    let prevGreen = null;
    let prevBlue = null;

    p.preload = () => {
        bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
    };

    p.setup = () => {
        p.createCanvas(1600, 900);
        bgImg.resize(p.width, p.height);
        
        // Initialize the New Motion Engine
        fluid = new FluidSimulation(p, p.width, p.height);

        // Create Particles (Density 12)
        bgImg.loadPixels();
        for (let y = 0; y < bgImg.height; y += 12) {
            for (let x = 0; x < bgImg.width; x += 12) {
                let i = (x + y * bgImg.width) * 4;
                let c = p.color(bgImg.pixels[i], bgImg.pixels[i+1], bgImg.pixels[i+2], 200);
                particles.push(new ImageParticle(p, x, y, c));
            }
        }

        // Camera & MediaPipe Setup (Same as your working version)
        cam = p.createCapture(p.VIDEO);
        cam.size(640, 480); cam.hide();
        hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
        hands.setOptions({maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5});
        hands.onResults(onResults);
        new Camera(cam.elt, {onFrame: async () => {await hands.send({image: cam.elt})}, width: 640, height: 480}).start();
    };

    function onResults(res) {
        if (res.multiHandLandmarks && res.multiHandedness) {
            for (let i = 0; i < res.multiHandLandmarks.length; i++) {
                let label = res.multiHandedness[i].label;
                let pos = p.createVector((1 - res.multiHandLandmarks[i][8].x) * p.width, res.multiHandLandmarks[i][8].y * p.height);
                
                if (label === "Left") { // User Right Hand
                    if (prevGreen) {
                        let force = p5.Vector.sub(pos, prevGreen);
                        fluid.addForce(pos.x, pos.y, force.x, force.y, 100);
                    }
                    greenCenter = pos;
                    prevGreen = pos.copy();
                } else { // User Left Hand
                    if (prevBlue) {
                        let force = p5.Vector.sub(pos, prevBlue);
                        fluid.addForce(pos.x, pos.y, force.x, force.y, 150);
                    }
                    blueCenter = pos;
                    prevBlue = pos.copy();
                }
            }
        }
    }

    p.draw = () => {
        p.background(0, 40); // Feedback loop: Background doesn't clear fully (Melting look)
        
        fluid.update();

        for (let part of particles) {
            // Get the "Fluid Current" from the math file
            let flow = fluid.getVelocity(part.x, part.y);
            
            if (greenCenter) part.revealIfNear(greenCenter, 80);
            
            part.applyFlow(flow);
            part.update();
            part.show();
        }
    };
};

class ImageParticle {
    constructor(p, x, y, c) {
        this.p = p; this.x = x; this.y = y; this.ox = x; this.oy = y;
        this.c = c; this.visible = false;
        this.vx = 0; this.vy = 0;
    }
    revealIfNear(c, r) { if (this.p.dist(this.x, this.y, c.x, c.y) < r) this.visible = true; }
    applyFlow(f) { this.vx += f.x * 0.1; this.vy += f.y * 0.1; }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.9; this.vy *= 0.9; // Friction
        
        // Return to origin (The "Dream" elastic effect)
        this.x += (this.ox - this.x) * 0.01;
        this.y += (this.oy - this.y) * 0.01;
    }
    show() {
        if (this.visible) {
            this.p.fill(this.c); this.p.noStroke();
            this.p.rect(this.x, this.y, 4, 4);
        }
    }
}
new p5(sketch);
