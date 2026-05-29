/**
 * ULTRA-FIDELITY DATA SCULPTURE // CORE_ENGINE v9.0
 * IMMERSIVE MODE - NO UI
 */

class SculptureEngine {
    constructor() {
        // High density fixed for realistic cinematic look
        this.COUNT = 300000; 
        this.initialized = false;
        
        this.config = {
            vortexRadius: 220,
            revealRadius: 180,
            handPower: 4.5,
            friction: 0.95,
            snapBackBase: 0.007
        };

        this.init();
    }

    async init() {
        this.setupGraphics();
        this.setupSimulation();
        await this.loadAndCreateParticles();
        this.startAI();
        this.run();
    }

    setupGraphics() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 800;

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    setupSimulation() {
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        this.handAI = new HandProcessor();
    }

    async loadAndCreateParticles() {
        const loader = new THREE.TextureLoader();
        const img = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg').catch(() => null);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        if(img) ctx.drawImage(img.image, 0, 0, 128, 128);
        const pixelData = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        
        this.pos = new Float32Array(this.COUNT * 3);
        this.org = new Float32Array(this.COUNT * 3);
        this.col = new Float32Array(this.COUNT * 3);
        this.vel = new Float32Array(this.COUNT * 2);
        this.life = new Float32Array(this.COUNT);

        for (let i = 0; i < this.COUNT; i++) {
            // GAUSSIAN DISTRIBUTION: For the wispy "Sand Cloud" from your image
            const angle = Math.random() * Math.PI * 2;
            const mag = Math.pow(Math.random(), 1.8) * window.innerWidth * 0.8;
            const x = Math.cos(angle) * mag;
            const y = Math.sin(angle) * mag;
            const z = (Math.random() - 0.5) * 250;

            this.pos[i*3] = x; this.pos[i*3+1] = y; this.pos[i*3+2] = z;
            this.org[i*3] = x; this.org[i*3+1] = y; this.org[i*3+2] = z;

            const px = Math.floor(Math.random() * 128);
            const py = Math.floor(Math.random() * 128);
            const pIdx = (py * 128 + px) * 4;

            this.col[i*3] = pixelData[pIdx] / 255;
            this.col[i*3+1] = pixelData[pIdx+1] / 255;
            this.col[i*3+2] = pixelData[pIdx+2] / 255;
            this.life[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aReveal', new THREE.BufferAttribute(this.life, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.COUNT).map(() => Math.random() * 2.5 + 0.5), 1));

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
        this.scene.add(this.points);
        this.initialized = true;
    }

    startAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            video.srcObject = s; video.play();
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ 
                maxNumHands: 2, 
                modelComplexity: 1, 
                minDetectionConfidence: 0.9, 
                minTrackingConfidence: 0.9 
            });

            hands.onResults(res => {
                this.handAI.update(res, window.innerWidth, window.innerHeight);
                this.handleInteraction();
            });

            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    handleInteraction() {
        ['left', 'right'].forEach(side => {
            const h = this.handAI.hands[side];
            const p = this.handAI.prevHands[side];
            
            if (h) {
                // Velocity Injection (Movement)
                if (p) {
                    const vx = (h.x - p.x) * this.config.handPower;
                    const vy = (p.y - h.y) * this.config.handPower;
                    this.fluid.addVelocity(h.x, h.y, vx, vy, this.config.vortexRadius);
                }

                // Heat Reveal Logic (3-Second Stillness)
                const stillness = this.handAI.stillnessFactor[side];
                if (stillness > 0) {
                    this.fluid.addReveal(h.x, h.y, this.config.revealRadius, stillness);
                }
            }
        });
    }

    run() {
        requestAnimationFrame(() => this.run());
        if (!this.initialized) return;

        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;
        this.fluid.update();

        const posAttr = this.points.geometry.attributes.position;
        const revealAttr = this.points.geometry.attributes.aReveal;

        for (let i = 0; i < this.COUNT; i++) {
            const sx = this.pos[i*3] + window.innerWidth / 2;
            const sy = window.innerHeight / 2 - this.pos[i*3+1];
            
            // 1. Get Physics from Fluid Grid
            const flow = this.fluid.getVelocity(sx, sy);
            const revealVal = this.fluid.getReveal(sx, sy);
            
            this.life[i] = revealVal; 

            // 2. Physics Calculation
            this.vel[i*2] += flow.x * 0.45;
            this.vel[i*2+1] -= flow.y * 0.45;

            this.vel[i*2] *= this.config.friction;
            this.vel[i*2+1] *= this.config.friction;

            this.pos[i*3] += this.vel[i*2];
            this.pos[i*3+1] += this.vel[i*2+1];

            // 3. Cinematic Atmospheric Breeze (Natural floating)
            const airDrift = this.config.snapBackBase + Math.sin(time * 0.3 + i * 0.001) * 0.004;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * airDrift;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * airDrift;
        }

        posAttr.needsUpdate = true;
        revealAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}

new SculptureEngine();
