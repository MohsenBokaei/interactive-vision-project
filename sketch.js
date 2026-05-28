class HandSensor {
    constructor() {
        this.history = { left: [], right: [] };
        this.isTracking = false;
        this.smoothing = 0.8;
        this.threshold = 0.85;
        this.palmSize = 0;
    }

    validateAnatomy(landmarks) {
        // Anatomical filter to prevent head/shoulder misrecognition
        const wrist = landmarks[0];
        const mcpIndex = landmarks[5];
        const mcpPinky = landmarks[17];
        const tipMiddle = landmarks[12];

        const palmWidth = Math.hypot(mcpIndex.x - mcpPinky.x, mcpIndex.y - mcpPinky.y);
        const handLength = Math.hypot(wrist.x - tipMiddle.x, wrist.y - tipMiddle.y);
        
        this.palmSize = palmWidth;
        
        // Human hands have a specific length-to-width ratio (approx 1.5 - 2.5)
        const ratio = handLength / palmWidth;
        return ratio > 1.2 && ratio < 3.5;
    }

    update(results) {
        let active = { left: null, right: null };
        if (results.multiHandLandmarks) {
            this.isTracking = true;
            results.multiHandLandmarks.forEach((landmarks, idx) => {
                const handedness = results.multiHandedness[idx].label;
                const score = results.multiHandedness[idx].score;

                if (score > this.threshold && this.validateAnatomy(landmarks)) {
                    const label = handedness === "Left" ? "right" : "left"; 
                    const pos = {
                        x: (1 - landmarks[8].x) * window.innerWidth,
                        y: landmarks[8].y * window.innerHeight
                    };
                    active[label] = this.smooth(label, pos);
                }
            });
        } else {
            this.isTracking = false;
        }
        return active;
    }

    smooth(label, pos) {
        let hist = this.history[label];
        if (hist.length === 0) {
            this.history[label].push(pos);
            return pos;
        }
        const last = hist[hist.length - 1];
        const smoothed = {
            x: last.x * this.smoothing + pos.x * (1 - this.smoothing),
            y: last.y * this.smoothing + pos.y * (1 - this.smoothing)
        };
        this.history[label].push(smoothed);
        if (this.history[label].length > 10) this.history[label].shift();
        return smoothed;
    }
}

class SculptureApp {
    constructor() {
        this.particleCount = 80000;
        this.fluidRes = 25;
        this.initSystems();
    }

    async initSystems() {
        this.updateLoading(10);
        this.setupRenderer();
        this.updateLoading(30);
        this.setupFluid();
        this.updateLoading(50);
        await this.setupAssets();
        this.updateLoading(80);
        this.setupAI();
        this.updateLoading(100);
        
        document.getElementById('loading-screen').style.display = 'none';
        this.animate();
    }

    updateLoading(p) {
        document.getElementById('progress').style.width = p + '%';
    }

    setupRenderer() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.z = 1000;

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => this.handleResize());
    }

    setupFluid() {
        this.fluid = new FluidEngine(window.innerWidth, window.innerHeight);
        this.sensor = new HandSensor();
    }

    async setupAssets() {
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
        
        // Sampling image for color distribution
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(texture.image, 0, 0, 128, 128);
        const imgData = ctx.getImageData(0, 0, 128, 128).data;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const origins = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);

        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * window.innerWidth * 1.5;
            const y = (Math.random() - 0.5) * window.innerHeight * 1.5;
            const z = (Math.random() - 0.5) * 100;

            positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;
            origins[i*3] = x; origins[i*3+1] = y; origins[i*3+2] = z;

            const ix = Math.floor(Math.random() * 128);
            const iy = Math.floor(Math.random() * 128);
            const idx = (iy * 128 + ix) * 4;

            colors[i*3] = imgData[idx] / 255;
            colors[i*3+1] = imgData[idx+1] / 255;
            colors[i*3+2] = imgData[idx+2] / 255;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('origin', new THREE.BufferAttribute(origins, 3));

        this.uniforms = {
            uTime: { value: 0 },
            uPointScale: { value: 2.5 }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: SimulationShader.vertex,
            fragmentShader: SimulationShader.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
        this.particleData = { positions, origins, velocities };
    }

    setupAI() {
        this.video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
            .then(stream => {
                this.video.srcObject = stream;
                this.video.play();
                
                const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
                hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });
                hands.onResults((res) => this.handleAIResults(res));
                
                const camera = new Camera(this.video, {
                    onFrame: async () => { await hands.send({ image: this.video }); }
                });
                camera.start();
            });
    }

    handleAIResults(results) {
        const hands = this.sensor.update(results);
        document.getElementById('hand-status').innerText = this.sensor.isTracking ? 'H_TRACK: ACTIVE' : 'H_TRACK: SEARCHING...';
        
        if (hands.left) {
            this.applyInteraction(hands.left, 'left');
        }
        if (hands.right) {
            this.applyInteraction(hands.right, 'right');
        }
    }

    applyInteraction(pos, label) {
        const last = this.sensor.history[label].length > 1 ? this.sensor.history[label][this.sensor.history[label].length - 2] : pos;
        const vx = pos.x - last.x;
        const vy = last.y - pos.y;
        this.fluid.addVelocity(pos.x, pos.y, vx, vy, 150);
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;
        this.fluid.step();

        const posAttr = this.points.geometry.attributes.position;
        const positions = posAttr.array;
        const origins = this.points.geometry.attributes.origin.array;
        const vels = this.particleData.velocities;

        for (let i = 0; i < this.particleCount; i++) {
            const px = positions[i*3] + window.innerWidth / 2;
            const py = window.innerHeight / 2 - positions[i*3+1];
            
            const cellX = Math.floor(px / this.fluid.res);
            const cellY = Math.floor(py / this.fluid.res);

            if (cellX >= 0 && cellX < this.fluid.cols && cellY >= 0 && cellY < this.fluid.rows) {
                const idx = cellX + cellY * this.fluid.cols;
                vels[i*3] += this.fluid.u[idx] * 0.2;
                vels[i*3+1] -= this.fluid.v[idx] * 0.2;
            }

            // Return to origin force
            vels[i*3] += (origins[i*3] - positions[i*3]) * 0.005;
            vels[i*3+1] += (origins[i*3+1] - positions[i*3+1]) * 0.005;

            // Apply friction
            vels[i*3] *= 0.95;
            vels[i*3+1] *= 0.95;

            positions[i*3] += vels[i*3];
            positions[i*3+1] += vels[i*3+1];
        }

        posAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
        
        if (Math.random() > 0.9) {
            document.getElementById('fps-counter').innerText = 'FPS: ' + Math.floor(1000/16);
        }
    }
}

const app = new SculptureApp();
