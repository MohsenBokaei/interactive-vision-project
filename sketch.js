/**
 * CINEMATIC_ENGINE_OS // v7.0
 * REFIK ANADOL INSPIRED GEN-ART
 */

class CinematicEngine {
    constructor() {
        this.LIMIT = 1000000; // Max cap for slider
        this.activeDensity = 250000;
        this.config = {
            viscosity: 0.96,
            snapback: 0.012,
            handStrength: 4.2,
            vortexSize: 220
        };
        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupPhysics();
        await this.prepareBufferGeometry();
        this.setupHandAI();
        this.initUI();
        this.renderLoop();
    }

    setupRenderer() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 800;

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance" 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
    }

    setupPhysics() {
        // Advanced Fluid Grid from fluid_solver.js
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        // Hand Processor from hand_processor.js
        this.neuralLink = new HandProcessor();
    }

    initUI() {
        const slider = document.getElementById('density-input');
        const display = document.getElementById('density-readout');
        
        // GOAL 1: Slider Fix (Pointer Events)
        slider.addEventListener('input', (e) => {
            this.activeDensity = parseInt(e.target.value);
            display.innerText = this.activeDensity.toLocaleString();
            this.points.geometry.setDrawRange(0, this.activeDensity);
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async prepareBufferGeometry() {
        const loader = new THREE.TextureLoader();
        const img = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(img.image, 0, 0, 128, 128);
        const pixelData = ctx.getImageData(0, 0, 128, 128).data;

        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.LIMIT * 3);
        this.origins = new Float32Array(this.LIMIT * 3);
        this.colors = new Float32Array(this.LIMIT * 3);
        this.velocities = new Float32Array(this.LIMIT * 2);
        this.sizes = new Float32Array(this.LIMIT);
        this.impacts = new Float32Array(this.LIMIT);

        for (let i = 0; i < this.LIMIT; i++) {
            // GOAL 3: Clustered Cloud Distribution (Realistic Dust)
            const theta = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * window.innerWidth * 0.75;
            const x = Math.cos(theta) * radius;
            const y = Math.sin(theta) * radius;
            const z = (Math.random() - 0.5) * 300;

            this.positions[i*3] = x; this.positions[i*3+1] = y; this.positions[i*3+2] = z;
            this.origins[i*3] = x; this.origins[i*3+1] = y; this.origins[i*3+2] = z;

            const px = Math.floor(Math.random() * 128);
            const py = Math.floor(Math.random() * 128);
            const pIdx = (py * 128 + px) * 4;

            this.colors[i*3] = pixelData[pIdx] / 255;
            this.colors[i*3+1] = pixelData[pIdx+1] / 255;
            this.colors[i*3+2] = pixelData[pIdx+2] / 255;

            this.sizes[i] = Math.random() * 2.2 + 0.3;
            this.impacts[i] = 0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('origin', new THREE.BufferAttribute(this.origins, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
        geometry.setAttribute('aImpact', new THREE.BufferAttribute(this.impacts, 1));

        this.uniforms = { uTime: { value: 0 } };

        // SOLVING THE ERROR: PROJECT_SHADERS is now defined globally in shaders.js
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: PROJECT_SHADERS.vertex,
            fragmentShader: PROJECT_SHADERS.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, material);
        this.points.geometry.setDrawRange(0, this.activeDensity);
        this.scene.add(this.points);
    }

    setupHandAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            video.srcObject = stream; video.play();
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ 
                maxNumHands: 2, 
                modelComplexity: 1, 
                minDetectionConfidence: 0.88,
                minTrackingConfidence: 0.88 
            });

            hands.onResults(res => {
                this.neuralLink.update(res, window.innerWidth, window.innerHeight);
                this.calculateNeuralForces();
            });

            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    calculateNeuralForces() {
        let handPresence = 0;
        ['left', 'right'].forEach(side => {
            const h = this.neuralLink.hands[side];
            const p = this.neuralLink.prevHands[side];
            if (h && p) {
                const vx = (h.x - p.x) * this.config.handStrength;
                const vy = (p.y - h.y) * this.config.handStrength;
                this.fluid.addVelocity(h.x, h.y, vx, vy, this.config.vortexSize);
                handPresence += Math.abs(vx) + Math.abs(vy);
            }
        });

        const label = document.getElementById('ai-label');
        const meter = document.getElementById('neural-meter');
        label.innerText = handPresence > 1 ? "NEURAL_LINK: ESTABLISHED" : "NEURAL_LINK: IDLE";
        meter.style.width = Math.min(handPresence * 6, 100) + "%";
    }

    renderLoop() {
        requestAnimationFrame(() => this.renderLoop());
        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;

        if (!this.points) return;

        this.fluid.update();
        
        const posAttr = this.points.geometry.attributes.position;
        const impactAttr = this.points.geometry.attributes.aImpact;
        const count = this.points.geometry.drawRange.count;

        for (let i = 0; i < count; i++) {
            const px = this.positions[i*3] + window.innerWidth/2;
            const py = window.innerHeight/2 - this.positions[i*3+1];
            
            const velocity = this.fluid.getVelocity(px, py);
            
            // GOAL 2: Kinetic Impact (Shininess)
            const kineticPower = Math.sqrt(velocity.x**2 + velocity.y**2);
            if (kineticPower > 0.12) this.impacts[i] = 1.0;
            else this.impacts[i] *= 0.94; // Decay back to original image color

            this.velocities[i*2] += velocity.x * 0.35;
            this.velocities[i*2+1] -= velocity.y * 0.35;

            this.velocities[i*2] *= this.config.viscosity;
            this.velocities[i*2+1] *= this.config.viscosity;

            this.positions[i*3] += this.velocities[i*2];
            this.positions[i*3+1] += this.velocities[i*2+1];

            // GOAL 3: Elastic Return (Natural drifting air)
            const airDrift = this.config.snapback + Math.sin(time * 0.5 + i * 0.001) * 0.004;
            this.positions[i*3] += (this.origins[i*3] - this.positions[i*3]) * airDrift;
            this.positions[i*3+1] += (this.origins[i*3+1] - this.positions[i*3+1]) * airDrift;
        }

        posAttr.needsUpdate = true;
        impactAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}

new CinematicEngine();
