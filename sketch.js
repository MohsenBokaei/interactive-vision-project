class SculptureEngine {
    constructor() {
        this.LIMIT = 1000000;
        this.density = 250000;
        this.initialized = false;
        this.init();
    }

    async init() {
        this.setupGraphics();
        this.setupSimulation();
        await this.loadAndCreateParticles();
        this.setupInteractions();
        this.startAI();
        this.run();
    }

    setupGraphics() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 800;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
    }

    setupSimulation() {
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        this.handAI = new HandProcessor();
    }

    async loadAndCreateParticles() {
        const loader = new THREE.TextureLoader();
        // Fallback to solid color if image fails to prevent NaN
        const img = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg').catch(() => null);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        if(img) ctx.drawImage(img.image, 0, 0, 128, 128);
        const pixels = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.LIMIT * 3);
        this.org = new Float32Array(this.LIMIT * 3);
        this.col = new Float32Array(this.LIMIT * 3);
        this.vel = new Float32Array(this.LIMIT * 2);
        this.life = new Float32Array(this.LIMIT);

        for (let i = 0; i < this.LIMIT; i++) {
            // CLUSTERED GAUSSIAN DISTRIBUTION (The "Sand Cloud" look)
            const angle = Math.random() * Math.PI * 2;
            const mag = Math.pow(Math.random(), 2) * window.innerWidth * 0.8;
            const x = Math.cos(angle) * mag;
            const y = Math.sin(angle) * mag;
            const z = (Math.random() - 0.5) * 200;

            this.pos[i*3]=x; this.pos[i*3+1]=y; this.pos[i*3+2]=z;
            this.org[i*3]=x; this.org[i*3+1]=y; this.org[i*3+2]=z;

            const px = Math.floor(Math.random() * 128);
            const py = Math.floor(Math.random() * 128);
            const pIdx = (py * 128 + px) * 4;

            this.col[i*3] = pixels[pIdx]/255;
            this.col[i*3+1] = pixels[pIdx+1]/255;
            this.col[i*3+2] = pixels[pIdx+2]/255;
            this.life[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.LIMIT).map(() => Math.random() * 2 + 0.5), 1));

        this.uniforms = { uTime: { value: 0 } };
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: PROJECT_SHADERS.vertex,
            fragmentShader: PROJECT_SHADERS.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, material);
        this.points.geometry.setDrawRange(0, this.density);
        this.scene.add(this.points);
        this.initialized = true;
    }

    setupInteractions() {
        const slider = document.getElementById('density-input');
        const readout = document.getElementById('density-readout');
        slider.oninput = (e) => {
            this.density = parseInt(e.target.value);
            readout.innerText = this.density.toLocaleString();
            this.points.geometry.setDrawRange(0, this.density);
        };
    }

    startAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            video.srcObject = s; video.play();
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.88 });
            hands.onResults(res => {
                this.handAI.update(res, window.innerWidth, window.innerHeight);
                this.handleHandForces();
            });
            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    handleHandForces() {
        let power = 0;
        ['left', 'right'].forEach(side => {
            const h = this.handAI.hands[side];
            const p = this.handAI.prevHands[side];
            if (h && p) {
                const vx = (h.x - p.x) * 4.0;
                const vy = (p.y - h.y) * 4.0;
                this.fluid.addVelocity(h.x, h.y, vx, vy, 200);
                power += Math.abs(vx) + Math.abs(vy);
            }
        });
        document.getElementById('neural-meter').style.width = Math.min(power * 8, 100) + "%";
        document.getElementById('ai-label').innerText = power > 2 ? "NEURAL_LINK: ACTIVE" : "NEURAL_LINK: IDLE";
    }

    run() {
        requestAnimationFrame(() => this.run());
        if (!this.initialized) return;

        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;
        this.fluid.update();

        const posAttr = this.points.geometry.attributes.position;
        const lifeAttr = this.points.geometry.attributes.aLife;

        for (let i = 0; i < this.density; i++) {
            const sx = this.pos[i*3] + window.innerWidth/2;
            const sy = window.innerHeight/2 - this.pos[i*3+1];
            const flow = this.fluid.getVelocity(sx, sy);

            // Cinematic "Shine" logic
            if (Math.abs(flow.x) + Math.abs(flow.y) > 0.1) this.life[i] = 1.0;
            else this.life[i] *= 0.92;

            this.vel[i*2] += flow.x * 0.45;
            this.vel[i*2+1] -= flow.y * 0.45;
            this.vel[i*2] *= 0.94;
            this.vel[i*2+1] *= 0.94;

            this.pos[i*3] += this.vel[i*2];
            this.pos[i*3+1] += this.vel[i*2+1];

            // Harmonic Snap-back (Organic breathing)
            const snap = 0.008 + Math.sin(time * 0.2 + i * 0.001) * 0.003;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * snap;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * snap;
        }

        posAttr.needsUpdate = true;
        lifeAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
new SculptureEngine();
