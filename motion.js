class FluidEngine {
    constructor(width, height) {
        this.res = 20;
        this.cols = Math.floor(width / this.res) + 1;
        this.rows = Math.floor(height / this.res) + 1;
        this.numCells = this.cols * this.rows;

        this.u = new Float32Array(this.numCells);
        this.v = new Float32Array(this.numCells);
        this.uPrev = new Float32Array(this.numCells);
        this.vPrev = new Float32Array(this.numCells);

        this.dt = 0.1;
        this.visc = 0.0001;
        this.friction = 0.985;
    }

    addVelocity(x, y, vx, vy, radius) {
        const gridX = Math.floor(x / this.res);
        const gridY = Math.floor(y / this.res);
        const r = Math.floor(radius / this.res);

        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                const cx = gridX + i;
                const cy = gridY + j;
                if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
                    const idx = cx + cy * this.cols;
                    const dist = Math.sqrt(i * i + j * j);
                    const weight = Math.max(0, 1 - dist / r);
                    this.u[idx] += vx * weight * 0.5;
                    this.v[idx] += vy * weight * 0.5;
                }
            }
        }
    }

    step() {
        this.diffuse(1, this.uPrev, this.u, this.visc);
        this.diffuse(2, this.vPrev, this.v, this.visc);
        this.project(this.uPrev, this.vPrev, this.u, this.v);
        this.advect(1, this.u, this.uPrev, this.uPrev, this.vPrev);
        this.advect(2, this.v, this.vPrev, this.uPrev, this.vPrev);
        this.project(this.u, this.v, this.uPrev, this.vPrev);
        
        for (let i = 0; i < this.numCells; i++) {
            this.u[i] *= this.friction;
            this.v[i] *= this.friction;
        }
    }

    diffuse(b, x, x0, diff) {
        const a = this.dt * diff * (this.cols - 2) * (this.rows - 2);
        for (let k = 0; k < 20; k++) {
            for (let j = 1; j < this.rows - 1; j++) {
                for (let i = 1; i < this.cols - 1; i++) {
                    x[i + j * this.cols] = (x0[i + j * this.cols] + a * (x[i - 1 + j * this.cols] + x[i + 1 + j * this.cols] + x[i + (j - 1) * this.cols] + x[i + (j + 1) * this.cols])) / (1 + 4 * a);
                }
            }
            this.set_bnd(b, x);
        }
    }

    project(velocX, velocY, p, div) {
        for (let j = 1; j < this.rows - 1; j++) {
            for (let i = 1; i < this.cols - 1; i++) {
                div[i + j * this.cols] = -0.5 * (velocX[i + 1 + j * this.cols] - velocX[i - 1 + j * this.cols] + velocY[i + (j + 1) * this.cols] - velocY[i + (j - 1) * this.cols]) / this.cols;
                p[i + j * this.cols] = 0;
            }
        }
        this.set_bnd(0, div);
        this.set_bnd(0, p);
        for (let k = 0; k < 20; k++) {
            for (let j = 1; j < this.rows - 1; j++) {
                for (let i = 1; i < this.cols - 1; i++) {
                    p[i + j * this.cols] = (div[i + j * this.cols] + p[i - 1 + j * this.cols] + p[i + 1 + j * this.cols] + p[i + (j - 1) * this.cols] + p[i + (j + 1) * this.cols]) / 4;
                }
            }
            this.set_bnd(0, p);
        }
        for (let j = 1; j < this.rows - 1; j++) {
            for (let i = 1; i < this.cols - 1; i++) {
                velocX[i + j * this.cols] -= 0.5 * (p[i + 1 + j * this.cols] - p[i - 1 + j * this.cols]) * this.cols;
                velocY[i + j * this.cols] -= 0.5 * (p[i + (j + 1) * this.cols] - p[i + (j - 1) * this.cols]) * this.rows;
            }
        }
        this.set_bnd(1, velocX);
        this.set_bnd(2, velocY);
    }

    advect(b, d, d0, velocX, velocY) {
        let i0, i1, j0, j1;
        let x, y, s0, s1, t0, t1;
        let dtx = this.dt * (this.cols - 2);
        let dty = this.dt * (this.rows - 2);

        for (let j = 1; j < this.rows - 1; j++) {
            for (let i = 1; i < this.cols - 1; i++) {
                x = i - dtx * velocX[i + j * this.cols];
                y = j - dty * velocY[i + j * this.cols];

                if (x < 0.5) x = 0.5; if (x > this.cols - 1.5) x = this.cols - 1.5;
                i0 = Math.floor(x); i1 = i0 + 1;
                if (y < 0.5) y = 0.5; if (y > this.rows - 1.5) y = this.rows - 1.5;
                j0 = Math.floor(y); j1 = j0 + 1;

                s1 = x - i0; s0 = 1 - s1;
                t1 = y - j0; t0 = 1 - t1;

                d[i + j * this.cols] = s0 * (t0 * d0[i0 + j0 * this.cols] + t1 * d0[i0 + j1 * this.cols]) + s1 * (t0 * d0[i1 + j0 * this.cols] + t1 * d0[i1 + j1 * this.cols]);
            }
        }
        this.set_bnd(b, d);
    }

    set_bnd(b, x) {
        for (let i = 1; i < this.cols - 1; i++) {
            x[i + 0 * this.cols] = b === 2 ? -x[i + 1 * this.cols] : x[i + 1 * this.cols];
            x[i + (this.rows - 1) * this.cols] = b === 2 ? -x[i + (this.rows - 2) * this.cols] : x[i + (this.rows - 2) * this.cols];
        }
        for (let j = 1; j < this.rows - 1; j++) {
            x[0 + j * this.cols] = b === 1 ? -x[1 + j * this.cols] : x[1 + j * this.cols];
            x[(this.cols - 1) + j * this.cols] = b === 1 ? -x[(this.cols - 2) + j * this.cols] : x[(this.cols - 2) + j * this.cols];
        }
    }
}
