/**
 * ULTRA-FIDELITY DATA SCULPTURE // CORE_ENGINE v8.0
 * SIMULATION: NAVIER-STOKES + TEMPORAL ACCUMULATION
 * RENDERING: GPU BUFFER GEOMETRY
 */

class SculptureEngine {
    constructor() {
        this.LIMIT = 1000000;
        this.density = 250000;
        this.initialized = false;
        
        // Simulation Constants
        this.config = {
            vortexRadius: 200,
            revealRadius: 160,
            handPower: 4.0,
            friction: 0.94,
            snapBackBase: 0.008
        };

        this.init();
    }

    async init() {
        this.setupGraphics();
        this.setupSimulation();
        await this.loadAndCreateParticles();
        this.setupUI();
        this.startAI();
        this.run();
    }

    setupGraphics() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 850;

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance",
            stencil: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
    }

    setupSimulation() {
        // From fluid_solver.js
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        // From hand_processor.js
        this.handAI = new HandProcessor();
    }

    setupUI() {
        const slider = document.getElementById('density-input');
        const readout = document.getElementById('density-readout');
        
        // GOAL: UI Interaction fix
        slider.oninput = (e) => {
            this.density = parseInt(e.target.value);
            readout.innerText = this.density.toLocaleString();
            this.points.geometry.setDrawRange(0, this.density);
        };

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
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
        
        // Memory Allocation
        this.pos = new Float32Array(this.LIMIT * 3);
        this.org = new Float32Array(this.LIMIT * 3);
        this.col = new Float32Array(this.LIMIT * 3);
        this.vel = new Float32Array(this.LIMIT * 2);
        this.life = new Float32Array(this.LIMIT); // Maps to aReveal in shader

        for (let i = 0; i < this.LIMIT; i++) {
            // GOAL: Wispy Gaussian Sand Cloud Look
            const angle = Math.random() * Math.PI * 2;
            const mag = Math.pow(Math.random(), 1.8) * window.innerWidth * 0.75;
            const x = Math.cos(angle) * mag;
            const y = Math.sin(angle) * mag;
            const z = (Math.random() - 0.5) * 250;

            this.pos[i*3] = x; this.pos[i*3+1] = y; this.pos[i*3+2] = z;
            this.org[i*3] = x; this.org[i*3+1] = y; this.org[i*3+2] = z;

            // Color Sampling
            const px = Math.floor(Math.random() * 128);
            const py = Math.floor(Math.random() * 128);
            const pIdx = (py * 128 + px) * 4;

            this.col[i*3] = pixelData[pIdx] / 255;
            this.col[i*3+1] = pixelData[pIdx+1] / 255;
            this.col[i*3+2] = pixelData[pIdx+2] / 255;
            
            this.life[i] = 0; // Starts invisible
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aReveal', new THREE.BufferAttribute(this.life, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.LIMIT).map(() => Math.random() * 2.2 + 0.4), 1));

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
                this.handleHandInteraction();
            });

            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    handleHandInteraction() {
        let interactionEnergy = 0;
        ['left', 'right'].forEach(side => {
            const h = this.handAI.hands[side];
            const p = this.handAI.prevHands[side];
            
            if (h) {
                // 1. Move the invisible wind (Velocity)
                if (p) {
                    const vx = (h.x - p.x) * this.config.handPower;
                    const vy = (p.y - h.y) * this.config.handPower;
                    this.fluid.addVelocity(h.x, h.y, vx, vy, this.config.vortexRadius);
                    interactionEnergy += Math.abs(vx) + Math.abs(vy);
                }

                // 2. Painting Reveal Logic (3-Second Stillness)
                const stillness = this.handAI.stillnessFactor[side];
                if (stillness > 0) {
                    this.fluid.addReveal(h.x, h.y, this.config.revealRadius, stillness);
                }
            }
        });

        const label = document.getElementById('ai-label');
        const meter = document.getElementById('neural-meter');
        
        if (this.handAI.isStill.left || this.handAI.isStill.right) {
            label.innerText = "NEURAL_LINK: REVEALING_DATA...";
            meter.style.background = "#00ffcc";
        } else {
            label.innerText = (interactionEnergy > 1) ? "NEURAL_LINK: ESTABLISHED" : "NEURAL_LINK: IDLE";
            meter.style.background = "#fff";
        }
        meter.style.width = Math.min(interactionEnergy * 5 + 10, 100) + "%";
    }

    run() {
        requestAnimationFrame(() => this.run());
        if (!this.initialized) return;

        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;

        this.fluid.update();

        const posAttr = this.points.geometry.attributes.position;
        const revealAttr = this.points.geometry.attributes.aReveal;
        const count = this.points.geometry.drawRange.count;

        for (let i = 0; i < count; i++) {
            // Coordinate Mapping: Canvas (-W/2 to W/2) -> Grid (0 to W)
            const sx = this.pos[i*3] + window.innerWidth / 2;
            const sy = window.innerHeight / 2 - this.pos[i*3+1];
            
            // 1. Get Velocity from Physics Grid
            const flow = this.fluid.getVelocity(sx, sy);
            
            // 2. Get Reveal intensity from Heat Grid
            const revealVal = this.fluid.getReveal(sx, sy);
            this.life[i] = revealVal; 

            // 3. Apply Forces
            this.vel[i*2] += flow.x * 0.4;
            this.vel[i*2+1] -= flow.y * 0.4;

            this.vel[i*2] *= this.config.friction;
            this.vel[i*2+1] *= this.config.friction;

            this.pos[i*3] += this.vel[i*2];
            this.pos[i*3+1] += this.vel[i*2+1];

            // 4. Natural Atmospheric Drift (Breeze)
            const driftIntensity = this.config.snapBackBase + Math.sin(time * 0.4 + i * 0.001) * 0.004;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * driftIntensity;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * driftIntensity;
        }

        posAttr.needsUpdate = true;
        revealAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}

// Global Execution
new SculptureEngine();
