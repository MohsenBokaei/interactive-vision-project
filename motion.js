class FluidSimulation {
    constructor(w, h) {
        this.p = { w, h };
        this.res = 20; 
        this.cols = Math.ceil(w / this.res);
        this.rows = Math.ceil(h / this.res);
        this.size = this.cols * this.rows;

        // Using Float32Arrays for raw performance
        this.velocity = new Float32Array(this.size * 2);
        this.pressure = new Float32Array(this.size);
        this.divergence = new Float32Array(this.size);
        
        this.viscosity = 0.0001;
        this.diffusion = 0.0001;
        this.friction = 0.96; // Adjust this to keep motion longer
    }

    addForce(x, y, vx, vy, radius) {
        // Convert screen space to grid space
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);
        const gr = Math.floor(radius / this.res);

        for (let i = -gr; i <= gr; i++) {
            for (let j = -gr; j <= gr; j++) {
                const col = gx + i;
                const row = gy + j;

                if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                    const idx = (col + row * this.cols) * 2;
                    const d = Math.sqrt(i * i + j * j);
                    if (d < gr) {
                        const strength = (1.0 - d / gr) * 2.5; // Boosted force
                        this.velocity[idx] += vx * strength;
                        this.velocity[idx + 1] += vy * strength;
                    }
                }
            }
        }
    }

    update() {
        for (let i = 0; i < this.size * 2; i++) {
            this.velocity[i] *= this.friction;
        }

        // Add "Noise Turbulence" to prevent the image from being static
        const time = Date.now() * 0.001;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = (x + y * this.cols) * 2;
                this.velocity[idx] += Math.sin(y * 0.1 + time) * 0.02;
                this.velocity[idx+1] += Math.cos(x * 0.1 + time) * 0.02;
            }
        }
    }

    getVelocityAt(x, y) {
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            const idx = (gx + gy * this.cols) * 2;
            return { x: this.velocity[idx], y: this.velocity[idx + 1] };
        }
        return { x: 0, y: 0 };
    }
}
