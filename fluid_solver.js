class FluidSolver {
    constructor(w, h, res) {
        this.res = res;
        this.cols = Math.ceil(w / res);
        this.rows = Math.ceil(h / res);
        this.size = this.cols * this.rows;

        this.velocity = new Float32Array(this.size * 2);
        this.pressure = new Float32Array(this.size);
        this.vorticity = new Float32Array(this.size);
        
        this.friction = 0.98; // High friction for "Dust" feel
        this.viscosity = 0.1;
    }

    addVelocity(x, y, vx, vy, radius) {
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);
        const gr = Math.floor(radius / this.res);

        for (let i = -gr; i <= gr; i++) {
            for (let j = -gr; j <= gr; j++) {
                const c = gx + i;
                const r = gy + j;
                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                    const idx = (c + r * this.cols) * 2;
                    const d = Math.sqrt(i * i + j * j);
                    if (d < gr) {
                        const weight = Math.pow(1.0 - d / gr, 2);
                        this.velocity[idx] += vx * weight;
                        this.velocity[idx + 1] += vy * weight;
                    }
                }
            }
        }
    }

    update() {
        const time = Date.now() * 0.0005;
        for (let i = 0; i < this.size; i++) {
            // Apply Liquid Friction
            this.velocity[i * 2] *= this.friction;
            this.velocity[i * 2 + 1] *= this.friction;

            // Natural Dust Floating (Perlin Drift)
            const x = i % this.cols;
            const y = Math.floor(i / this.cols);
            this.velocity[i * 2] += Math.sin(y * 0.05 + time) * 0.005;
            this.velocity[i * 2 + 1] += Math.cos(x * 0.05 + time) * 0.005;
        }
        
        // Simulating Vorticity (Small eddies)
        this.confinement();
    }

    confinement() {
        // Simplified Vorticity Confinement for realistic swirls
        for (let j = 1; j < this.rows - 1; j++) {
            for (let i = 1; i < this.cols - 1; i++) {
                const idx = i + j * this.cols;
                // Curl calculation
                const curl = (this.velocity[(idx + 1) * 2 + 1] - this.velocity[(idx - 1) * 2 + 1]) - 
                             (this.velocity[(idx + this.cols) * 2] - this.velocity[(idx - this.cols) * 2]);
                this.vorticity[idx] = curl * 0.01;
            }
        }
    }

    getVelocity(x, y) {
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            const idx = (gx + gy * this.cols) * 2;
            return { x: this.velocity[idx], y: this.velocity[idx + 1] };
        }
        return { x: 0, y: 0 };
    }
}
