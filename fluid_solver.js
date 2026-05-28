class FluidSolver {
    constructor(w, h) {
        this.res = 22;
        this.cols = Math.ceil(w / this.res);
        this.rows = Math.ceil(h / this.res);
        this.size = this.cols * this.rows;

        this.u = new Float32Array(this.size); // Velocity X
        this.v = new Float32Array(this.size); // Velocity Y
        
        this.friction = 0.96; 
    }

    // This name matches the call in sketch.js exactly
    addVelocity(x, y, vx, vy, radius) {
        const gx = Math.floor(x / this.res);
        const gy = Math.floor(y / this.res);
        const gr = Math.floor(radius / this.res);

        for (let i = -gr; i <= gr; i++) {
            for (let j = -gr; j <= gr; j++) {
                const c = gx + i;
                const r = gy + j;

                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                    const idx = c + r * this.cols;
                    const d = Math.sqrt(i * i + j * j);
                    if (d < gr) {
                        const weight = Math.pow(1.0 - d / gr, 2);
                        this.u[idx] += vx * weight;
                        this.v[idx] += vy * weight;
                    }
                }
            }
        }
    }

    update() {
        const t = Date.now() * 0.001;
        for (let i = 0; i < this.size; i++) {
            this.u[i] *= this.friction;
            this.v[i] *= this.friction;
            
            // Add background turbulence
            const x = i % this.cols;
            const y = Math.floor(i / this.cols);
            this.u[i] += Math.sin(y * 0.1 + t) * 0.02;
            this.v[i] += Math.cos(x * 0.1 + t) * 0.02;
        }
    }

    getVelocity(x, y) {
        const c = Math.floor(x / this.res);
        const r = Math.floor(y / this.res);
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
            const idx = c + r * this.cols;
            return { x: this.u[idx], y: this.v[idx] };
        }
        return { x: 0, y: 0 };
    }
}
