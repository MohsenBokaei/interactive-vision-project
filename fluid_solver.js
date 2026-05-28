class FluidSolver {
    constructor(w, h) {
        this.res = 24;
        this.cols = Math.ceil(w / this.res);
        this.rows = Math.ceil(h / this.res);
        this.field = new Float32Array(this.cols * this.rows * 2);
        this.friction = 0.965; // High friction for sand-like behavior
    }

    applyForce(x, y, vx, vy, radius) {
        const gx = x / this.res;
        const gy = y / this.res;
        const gr = radius / this.res;

        for (let j = -gr; j <= gr; j++) {
            for (let i = -gr; i <= gr; i++) {
                const c = Math.floor(gx + i);
                const r = Math.floor(gy + j);
                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                    const idx = (c + r * this.cols) * 2;
                    const d = Math.sqrt(i*i + j*j);
                    const weight = Math.pow(Math.max(0, 1 - d/gr), 2);
                    this.field[idx] += vx * weight * 1.5;
                    this.field[idx+1] += vy * weight * 1.5;
                }
            }
        }
    }

    update(time) {
        for (let i = 0; i < this.field.length; i += 2) {
            this.field[i] *= this.friction;
            this.field[i+1] *= this.friction;
            
            // Add natural atmospheric turbulence (Curl Noise approximation)
            const x = (i/2) % this.cols;
            const y = Math.floor((i/2) / this.cols);
            this.field[i] += Math.sin(y * 0.15 + time * 0.4) * 0.015;
            this.field[i+1] += Math.cos(x * 0.15 + time * 0.4) * 0.015;
        }
    }

    getVelocity(x, y) {
        const c = Math.floor(x / this.res);
        const r = Math.floor(y / this.res);
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
            const idx = (c + r * this.cols) * 2;
            return { x: this.field[idx], y: this.field[idx+1] };
        }
        return { x: 0, y: 0 };
    }
}
