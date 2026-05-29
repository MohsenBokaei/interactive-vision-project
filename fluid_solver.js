class FluidSolver {
    constructor(w, h) {
        this.res = 22;
        this.cols = Math.ceil(w / this.res);
        this.rows = Math.ceil(h / this.res);
        this.size = this.cols * this.rows;

        this.u = new Float32Array(this.size); 
        this.v = new Float32Array(this.size); 
        this.revealField = new Float32Array(this.size); 
        
        this.friction = 0.96; 
        this.dissolveRate = 0.982; 
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

    addReveal(x, y, radius, strength) {
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
                        const weight = (1.0 - d / gr) * strength * 0.045;
                        this.revealField[idx] = Math.min(1.0, this.revealField[idx] + weight);
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
            
            this.revealField[i] *= this.dissolveRate;

            const x = i % this.cols;
            const y = Math.floor(i / this.cols);
            this.u[i] += Math.sin(y * 0.15 + t) * 0.015;
            this.v[i] += Math.cos(x * 0.15 + t) * 0.015;
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

    getReveal(x, y) {
        const c = Math.floor(x / this.res);
        const r = Math.floor(y / this.res);
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
            const idx = c + r * this.cols;
            return this.revealField[idx];
        }
        return 0;
    }
}
