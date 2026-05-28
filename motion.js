// motion.js
class FluidSimulation {
    constructor(width, height) {
        this.res = 30;
        this.cols = Math.floor(width / this.res);
        this.rows = Math.floor(height / this.res);

        this.grid = new Array(this.cols * this.rows);
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i] = { x: 0, y: 0 };
        }
        this.friction = 0.96;
    }

    addForce(x, y, vx, vy, radius) {
        let centerX = Math.floor(x / this.res);
        let centerY = Math.floor(y / this.res);
        let r = Math.floor(radius / this.res);

        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                let col = centerX + i;
                let row = centerY + j;
                if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                    let index = col + row * this.cols;
                    let dx = col - centerX;
                    let dy = row - centerY;
                    let d = Math.sqrt(dx*dx + dy*dy);
                    let strength = Math.max(0, 1 - d / r);
                    this.grid[index].x += vx * strength * 0.5;
                    this.grid[index].y += vy * strength * 0.5;
                }
            }
        }
    }

    update() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i].x *= this.friction;
            this.grid[i].y *= this.friction;
        }
    }

    getVelocity(x, y) {
        let col = Math.floor(x / this.res);
        let row = Math.floor(y / this.res);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.grid[col + row * this.cols];
        }
        return { x: 0, y: 0 };
    }
}
