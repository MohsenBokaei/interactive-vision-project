class SculptureEngine {
    constructor() {
        this.COUNT = 200000; // Optimized density for 60FPS
        this.initialized = false;
        this.config = { friction: 0.95, snap: 0.012 };
        this.init();
    }

    async init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 900;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        this.handAI = new HandProcessor();

        await this.createSystem();
        this.setupAI();
        this.render();
    }

    async createSystem() {
        const loader = new THREE.TextureLoader();
        const img = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg').catch(() => null);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        if(img) ctx.drawImage(img.image, 0, 0, 128, 128);
        const pixels = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.COUNT * 3);
        this.org = new Float32Array(this.COUNT * 3);
        this.col = new Float32Array(this.COUNT * 3);
        this.vel = new Float32Array(this.COUNT * 2);
        this.life = new Float32Array(this.COUNT);

        for (let i = 0; i < this.COUNT; i++) {
            // Gaussian distribution for wispy sand look
            const a = Math.random() * Math.PI * 2;
            const r = Math.pow(Math.random(), 1.5) * window.innerWidth * 0.8;
            this.pos[i*3] = Math.cos(a) * r;
            this.pos[i*3+1] = Math.sin(a) * r;
            this.pos[i*3+2] = (Math.random() - 0.5) * 200;
            this.org[i*3] = this.pos[i*3];
            this.org[i*3+1] = this.pos[i*3+1];
            this.org[i*3+2] = this.pos[i*3+2];

            const pIdx = (Math.floor(Math.random()*128*128)) * 4;
            this.col[i*3] = pixels[pIdx]/255;
            this.col[i*3+1] = pixels[pIdx+1]/255;
            this.col[i*3+2] = pixels[pIdx+2]/255;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aReveal', new THREE.BufferAttribute(this.life, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.COUNT).map(() => Math.random() * 2 + 0.5), 1));

        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: PROJECT_SHADERS.vertex,
            fragmentShader: PROJECT_SHADERS.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));

        this.scene.add(this.points);
        this.initialized = true;
    }

    setupAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            video.srcObject = s; video.play();
            const ai = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            ai.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.9 });
            ai.onResults(res => {
                this.handAI.update(res, window.innerWidth, window.innerHeight);
                ['left', 'right'].forEach(side => {
                    const h = this.handAI.hands[side];
                    if (h) {
                        const p = this.handAI.prevHands[side];
                        if (p) this.fluid.addVelocity(h.x, h.y, (h.x - p.x)*4, (p.y - h.y)*4, 180);
                        if (this.handAI.stillFactor[side] > 0) this.fluid.addReveal(h.x, h.y, 160, this.handAI.stillFactor[side]);
                    }
                });
            });
            new Camera(video, { onFrame: async () => await ai.send({ image: video }) }).start();
        });
    }

    render() {
        requestAnimationFrame(() => this.render());
        if (!this.initialized) return;

        const time = performance.now() * 0.001;
        this.points.material.uniforms.uTime.value = time;
        this.fluid.update();

        const posAttr = this.points.geometry.attributes.position;
        const revAttr = this.points.geometry.attributes.aReveal;

        for (let i = 0; i < this.COUNT; i++) {
            const sx = this.pos[i*3] + window.innerWidth/2;
            const sy = window.innerHeight/2 - this.pos[i*3+1];
            
            const v = this.fluid.getVelocity(sx, sy);
            this.life[i] = this.fluid.getReveal(sx, sy);

            this.vel[i*2] = (this.vel[i*2] + v.x * 0.5) * this.config.friction;
            this.vel[i*2+1] = (this.vel[i*2+1] - v.y * 0.5) * this.config.friction;

            this.pos[i*3] += this.vel[i*2];
            this.pos[i*3+1] += this.vel[i*2+1];

            // Harmonic snap back
            const drift = this.config.snap + Math.sin(time*0.2 + i*0.0001)*0.003;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * drift;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * drift;
        }

        posAttr.needsUpdate = true;
        revAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
new SculptureEngine();
