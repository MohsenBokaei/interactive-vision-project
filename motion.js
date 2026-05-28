class FluidSimulation {
    constructor(width, height) {
        this.res = 25;
        this.cols = Math.floor(width / this.res);
        this.rows = Math.floor(height / this.res);
        this.numCells = this.cols * this.rows;

        this.velocityGrid = new Float32Array(this.numCells * 2); 
        this.prevVelocityGrid = new Float32Array(this.numCells * 2);

        this.viscosity = 0.0001;
        this.diffusion = 0.0001;
        this.friction = 0.94;
    }

    addForce(x, y, vx, vy, radius) {
        const gridX = Math.floor(x / this.res);
        const gridY = Math.floor(y / this.res);
        const gridR = Math.floor(radius / this.res);

        for (let i = -gridR; i <= gridR; i++) {
            for (let j = -gridR; j <= gridR; j++) {
                const col = gridX + i;
                const row = gridY + j;

                if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                    const index = (col + row * this.cols) * 2;
                    const dx = col - gridX;
                    const dy = row - gridY;
                    const distSq = dx * dx + dy * dy;
                    const rSq = gridR * gridR;

                    if (distSq < rSq) {
                        const strength = 1.0 - Math.sqrt(distSq) / gridR;
                        this.velocityGrid[index] += vx * strength * 0.8;
                        this.velocityGrid[index + 1] += vy * strength * 0.8;
                    }
                }
            }
        }
    }

    update() {
        for (let i = 0; i < this.numCells * 2; i++) {
            this.velocityGrid[i] *= this.friction;
            
            const cellIndex = Math.floor(i / 2);
            const cx = cellIndex % this.cols;
            const cy = Math.floor(cellIndex / this.cols);
            
            const time = Date.now() * 0.0005;
            const noiseX = Math.sin(cx * 0.1 + time) * 0.02;
            const noiseY = Math.cos(cy * 0.1 + time) * 0.02;
            
            this.velocityGrid[i] += (i % 2 === 0) ? noiseX : noiseY;
        }
    }

    getVelocity(x, y) {
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);

        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            const index = (gx + gy * this.cols) * 2;
            return {
                x: this.velocityGrid[index],
                y: this.velocityGrid[index + 1]
            };
        }
        return { x: 0, y: 0 };
    }
}
