const sketch = (p) => {
    let cam, bgImg;
    let particles = [];
    let fluid;
    let hands;
    let greenCenter = null; 
    let blueCenter = null;  
    let prevGreen = null;
    let prevBlue = null;

    p.preload = () => {
        bgImg = p.loadImage("AdobeStock_421043104_Editorial_Use_Only.jpeg");
    };

    p.setup = () => {
        p.createCanvas(1600, 900);
        bgImg.resize(p.width, p.height);
        
        fluid = new FluidSimulation(p, p.width, p.height);

        bgImg.loadPixels();
        // Slightly higher density for Anadol look
        for (let y = 0; y < bgImg.height; y += 10) {
            for (let x = 0; x < bgImg.width; x += 10) {
                let i = (x + y * bgImg.width) * 4;
                let c = p.color(bgImg.pixels[i], bgImg.pixels[i+1], bgImg.pixels[i+2], 180);
                particles.push(new ImageParticle(p, x, y, c));
            }
        }

        cam = p.createCapture(p.VIDEO);
        cam.size(640, 480); cam.hide();
        
        hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
        hands.setOptions({maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5});
        hands.onResults(onResults);
        
        new Camera(cam.elt, {
            onFrame: async () => { await hands.send({image: cam.elt}) },
            width: 640, height: 480
        }).start();
    };

    function onResults(res) {
        greenCenter = null;
        blueCenter = null;
        if (res.multiHandLandmarks && res.multiHandedness) {
            for (let i = 0; i < res.multiHandLandmarks.length; i++) {
                let label = res.multiHandedness[i].label;
                let pos = p.createVector((1 - res.multiHandLandmarks[i][8].x) * p.width, res.multiHandLandmarks[i][8].y * p.height);
                
                if (label === "Left") { // Right Hand
                    if (prevGreen) {
                        let force = p5.Vector.sub(pos, prevGreen);
                        fluid.addForce(pos.x, pos.y, force.x, force.y, 120);
                    }
                    greenCenter = pos;
                    prevGreen = pos.copy();
                } else { // Left Hand
                    if (prevBlue) {
                        let force = p5.Vector.sub(pos, prevBlue);
                        fluid.addForce(pos.x, pos.y, force.x, force.y, 120);
                    }
                    blueCenter = pos;
                    prevBlue = pos.copy();
                }
            }
        }
    }

    p.draw = () => {
        // This transparency creates the "trailing/melting" Anadol effect
        p.background(0, 30); 
        
        fluid.update();

        for (let part of particles) {
            let flow = fluid.getVelocity(part.x, part.y);
            if (greenCenter || blueCenter) {
                // If either hand is near, reveal
                if (greenCenter && p.dist(part.x, part.y, greenCenter.x, greenCenter.y) < 80) part.visible = true;
                if (blueCenter && p.dist(part.x, part.y, blueCenter.x, blueCenter.y) < 80) part.visible = true;
            }
            
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
    applyFlow(f) { 
        this.vx += f.x * 0.15; 
        this.vy += f.y * 0.15; 
    }
    update() {
        this.x += this.vx; 
        this.y += this.vy;
        this.vx *= 0.92; // Liquid friction
        this.vy *= 0.92;
        
        // Elastic pull back to original position
        this.x += (this.ox - this.x) * 0.02;
        this.y += (this.oy - this.y) * 0.02;
    }
    show() {
        if (this.visible) {
            this.p.fill(this.c); this.p.noStroke();
            // Squares render faster and look more like digital data
            this.p.rect(this.x, this.y, 3, 3);
        }
    }
}
new p5(sketch);
