class NeuralSculpture {
    constructor() {
        this.COUNT = 250000; // Optimized for 60FPS browser performance
        this.initialized = false;
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

        await this.createFiberSystem();
        this.setupAI();
        this.render();
    }

    async createFiberSystem() {
        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.COUNT * 3);
        this.org = new Float32Array(this.COUNT * 3);
        this.vel = new Float32Array(this.COUNT * 2);
        this.revealAttr = new Float32Array(this.COUNT);

        for (let i = 0; i < this.COUNT; i++) {
            // Clustered Gaussian distribution for the "Cloud" look
            const a = Math.random() * Math.PI * 2;
            const r = Math.pow(Math.random(), 1.5) * window.innerWidth * 0.8;
            this.pos[i*3] = Math.cos(a) * r;
            this.pos[i*3+1] = Math.sin(a) * r;
            this.pos[i*3+2] = (Math.random() - 0.5) * 300;
            
            this.org[i*3] = this.pos[i*3];
            this.org[i*3+1] = this.pos[i*3+1];
            this.org[i*3+2] = this.pos[i*3+2];
            this.revealAttr[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aReveal', new THREE.BufferAttribute(this.revealAttr, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.COUNT).map(() => Math.random() * 2.0 + 0.5), 1));
        geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(this.COUNT * 3).fill(1.0), 3));

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
                this.processNeuralForces();
            });
            new Camera(video, { onFrame: async () => await ai.send({ image: video }) }).start();
        });
    }

    processNeuralForces() {
        ['left', 'right'].forEach(side => {
            const h = this.handAI.hands[side];
            const joints = this.handAI.rawLandmarks[side];
            const factor = this.handAI.stillFactor[side];

            if (h) {
                const prev = this.handAI.prevHands[side] || h;
                this.fluid.addVelocity(h.x, h.y, (h.x - prev.x)*5, (prev.y - h.y)*5, 200);
                
                if (factor > 0 && joints.length > 0) {
                    joints.forEach(j => {
                        this.fluid.addReveal(j.x, j.y, 70, factor);
                    });
                }
            }
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
            const r = this.fluid.getReveal(sx, sy);

            this.revealAttr[i] = r;

            // Momentum-based fiber physics
            this.vel[i*2] = (this.vel[i*2] + v.x * 0.6) * 0.95;
            this.vel[i*2+1] = (this.vel[i*2+1] - v.y * 0.6) * 0.95;

            this.pos[i*3] += this.vel[i*2];
            this.pos[i*3+1] += this.vel[i*2+1];

            // Harmonic snap-back (Wind breeze)
            let snap = 0.008 + Math.sin(time*0.4 + i*0.001)*0.003;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * snap;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * snap;
        }

        posAttr.needsUpdate = true;
        revAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
new NeuralSculpture();
