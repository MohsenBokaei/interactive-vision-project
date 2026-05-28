/**
 * ULTRA-HIGH-FIDELITY DATA SCULPTURE ENGINE v7.0
 * ARCHITECTURE: GPU-ACCELERATED SHADER PIPELINE
 * SIMULATION: NAVIER-STOKES FLUID DYNAMICS
 */

class SculptureEngine {
    constructor() {
        this.LIMIT = 1000000;
        this.currentDensity = 200000;
        this.params = {
            friction: 0.965,
            snapBack: 0.008,
            handPower: 3.5,
            vortexRadius: 220
        };
        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupPhysics();
        this.setupAI();
        await this.buildParticleSystem();
        this.bindEvents();
        this.mainLoop();
    }

    setupRenderer() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 850;

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance",
            precision: "highp"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
    }

    setupPhysics() {
        // Advanced Fluid Grid
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        this.handAI = new HandProcessor();
    }

    bindEvents() {
        const slider = document.getElementById('density-ctrl');
        const display = document.getElementById('density-val');
        
        // GOAL 1: Slider Interaction Fixed
        slider.addEventListener('input', (e) => {
            this.currentDensity = parseInt(e.target.value);
            display.innerText = this.currentDensity.toLocaleString();
            this.points.geometry.setDrawRange(0, this.currentDensity);
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async buildParticleSystem() {
        const loader = new THREE.TextureLoader();
        const img = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(img.image, 0, 0, 128, 128);
        const data = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.posArr = new Float32Array(this.LIMIT * 3);
        this.orgArr = new Float32Array(this.LIMIT * 3);
        this.colArr = new Float32Array(this.LIMIT * 3);
        this.velArr = new Float32Array(this.LIMIT * 2);
        this.sizeArr = new Float32Array(this.LIMIT);
        this.impactArr = new Float32Array(this.LIMIT);

        for (let i = 0; i < this.LIMIT; i++) {
            // GOAL 2: Natural Floating Cloud Distribution
            const theta = Math.random() * Math.PI * 2;
            const r = Math.pow(Math.random(), 0.5) * window.innerWidth * 0.8;
            const x = Math.cos(theta) * r;
            const y = Math.sin(theta) * r;
            const z = (Math.random() - 0.5) * 300;

            this.posArr[i*3] = x; this.posArr[i*3+1] = y; this.posArr[i*3+2] = z;
            this.orgArr[i*3] = x; this.orgArr[i*3+1] = y; this.orgArr[i*3+2] = z;

            const px = Math.floor(Math.random() * 128);
            const py = Math.floor(Math.random() * 128);
            const pIdx = (py * 128 + px) * 4;

            this.colArr[i*3] = data[pIdx] / 255;
            this.colArr[i*3+1] = data[pIdx+1] / 255;
            this.colArr[i*3+2] = data[pIdx+2] / 255;

            this.sizeArr[i] = Math.random() * 2.4 + 0.4;
            this.impactArr[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
        geo.setAttribute('origin', new THREE.BufferAttribute(this.orgArr, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.colArr, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArr, 1));
        geo.setAttribute('aImpact', new THREE.BufferAttribute(this.impactArr, 1));

        this.uniforms = { uTime: { value: 0 } };

        // Unified Shader Reference
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: SculptureShader.vertex,
            fragmentShader: SculptureShader.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, material);
        this.points.geometry.setDrawRange(0, this.currentDensity);
        this.scene.add(this.points);
    }

    setupAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            video.srcObject = stream; video.play();
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ 
                maxNumHands: 2, 
                modelComplexity: 1, 
                minDetectionConfidence: 0.85,
                minTrackingConfidence: 0.85 
            });

            hands.onResults(res => {
                this.handAI.update(res, window.innerWidth, window.innerHeight);
                this.processInteraction();
            });

            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    processInteraction() {
        let totalPower = 0;
        ['left', 'right'].forEach(side => {
            const h = this.handAI.hands[side];
            const p = this.handAI.prevHands[side];
            if (h && p) {
                const vx = (h.x - p.x) * this.params.handPower;
                const vy = (p.y - h.y) * this.params.handPower;
                this.fluid.addVelocity(h.x, h.y, vx, vy, this.params.vortexRadius);
                totalPower += Math.abs(vx) + Math.abs(vy);
            }
        });

        const status = document.getElementById('ai-status');
        const meter = document.getElementById('hand-energy');
        status.innerText = totalPower > 2 ? "NEURAL_LINK: ACTIVE" : "NEURAL_LINK: IDLE";
        meter.style.width = Math.min(totalPower * 5, 100) + "%";
    }

    mainLoop() {
        requestAnimationFrame(() => this.mainLoop());
        const t = performance.now() * 0.001;
        this.uniforms.uTime.value = t;

        if (!this.points) return;

        this.fluid.update();
        
        const posAttr = this.points.geometry.attributes.position;
        const impactAttr = this.points.geometry.attributes.aImpact;
        const count = this.points.geometry.drawRange.count;

        for (let i = 0; i < count; i++) {
            const px = this.posArr[i*3] + window.innerWidth/2;
            const py = window.innerHeight/2 - this.posArr[i*3+1];
            
            const flow = this.fluid.getVelocity(px, py);
            
            // GOAL 2: Momentum & Impact logic
            const speed = Math.sqrt(flow.x**2 + flow.y**2);
            if (speed > 0.1) this.impactArr[i] = 1.0;
            else this.impactArr[i] *= 0.93; // Slow color decay

            this.velArr[i*2] += flow.x * 0.4;
            this.velArr[i*2+1] -= flow.y * 0.4;

            this.velArr[i*2] *= this.params.friction;
            this.velArr[i*2+1] *= this.params.friction;

            this.posArr[i*3] += this.velArr[i*2];
            this.posArr[i*3+1] += this.velArr[i*2+1];

            // GOAL 3: Natural Floating Snap-back
            const breeze = 0.005 + Math.sin(t * 0.5 + i * 0.001) * 0.003;
            this.posArr[i*3] += (this.orgArr[i*3] - this.posArr[i*3]) * breeze;
            this.posArr[i*3+1] += (this.orgArr[i*3+1] - this.posArr[i*3+1]) * breeze;
        }

        posAttr.needsUpdate = true;
        impactAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}

new SculptureEngine();
