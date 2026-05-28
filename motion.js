// motion.js - Fluid Dynamics and Flow Field Engine
class FluidSimulation {
    constructor(p, width, height) {
        this.p = p;
        this.res = 20; // Grid resolution
        this.cols = p.floor(width / this.res);
        this.rows = p.floor(height / this.res);
        
        // Velocity Grid: Stores the direction of flow at every point
        this.grid = new Array(this.cols * this.rows);
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = p.createVector(0, 0);
        }
        
        this.friction = 0.95; 
    }

    addForce(x, y, vx, vy, radius) {
        let centerX = this.p.floor(x / this.res);
        let centerY = this.p.floor(y / this.res);
        let r = this.p.floor(radius / this.res);

        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                let col = centerX + i;
                let row = centerY + j;

                if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                    let index = col + row * this.cols;
                    let d = this.p.dist(centerX, centerY, col, row);
                    let strength = this.p.map(d, 0, r, 1, 0);
                    if (strength > 0) {
                        this.grid[index].add(vx * strength, vy * strength);
                    }
                }
            }
        }
    }

    update() {
        let t = this.p.millis() * 0.001;
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i].mult(this.friction);
            
            // Subtle "Breathing" movement
            let x = i % this.cols;
            let y = this.p.floor(i / this.cols);
            let n = this.p.noise(x * 0.1, y * 0.1, t);
            let angle = n * this.p.TWO_PI;
            this.grid[i].add(this.p.Vector.fromAngle(angle).mult(0.1));
        }
    }

    getVelocity(x, y) {
        let col = this.p.floor(x / this.res);
        let row = this.p.floor(y / this.res);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.grid[col + row * this.cols];
        }
        return this.p.createVector(0, 0);
    }
}
