class HandIntelligence {
    constructor() {
        this.history = { left: [], right: [] };
        this.maxHistory = 8;
        this.minConfidence = 0.85; 
        this.persistence = { left: 0, right: 0 };
        this.maxPersistence = 15;
        this.currentPos = { left: null, right: null };
        this.smoothedPos = { left: null, right: null };
    }

    process(results) {
        let detected = { left: false, right: false };

        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                const score = handedness.score;
                const label = handedness.label === "Left" ? "right" : "left";

                if (score < this.minConfidence) continue;

                if (!this.isValidHand(landmarks)) continue;

                const rawX = (1 - landmarks[8].x) * window.innerWidth - window.innerWidth / 2;
                const rawY = (0.5 - landmarks[8].y) * window.innerHeight;

                this.updateHistory(label, { x: rawX, y: rawY });
                detected[label] = true;
                this.persistence[label] = this.maxPersistence;
            }
        }

        this.handlePersistence("left", detected.left);
        this.handlePersistence("right", detected.right);

        return {
            left: this.getSmoothed("left"),
            right: this.getSmoothed("right")
        };
    }

    isValidHand(landmarks) {
        const wrist = landmarks[0];
        const indexMcp = landmarks[5];
        const pinkyMcp = landmarks[17];
        
        const palmSize = Math.sqrt(
            Math.pow(indexMcp.x - wrist.x, 2) + 
            Math.pow(indexMcp.y - wrist.y, 2)
        );

        return palmSize > 0.05 && palmSize < 0.4;
    }

    updateHistory(label, pos) {
        this.history[label].push(pos);
        if (this.history[label].length > this.maxHistory) {
            this.history[label].shift();
        }
    }

    handlePersistence(label, isDetected) {
        if (!isDetected) {
            this.persistence[label]--;
            if (this.persistence[label] <= 0) {
                this.history[label] = [];
            }
        }
    }

    getSmoothed(label) {
        if (this.history[label].length === 0) return null;
        let avgX = 0, avgY = 0;
        this.history[label].forEach(p => {
            avgX += p.x;
            avgY += p.y;
        });
        return {
            x: avgX / this.history[label].length,
            y: avgY / this.history[label].length
        };
    }
}

class SculptureEngine {
    constructor() {
        this.particleCount = 50000;
        this.initScene();
        this.initFluid();
        this.intelligence = new HandIntelligence();
        this.initParticles();
        this.initAI();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
        this.camera.position.z = 600;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => this.onResize());
    }

    initFluid() {
        this.fluid = new FluidSimulation(window.innerWidth, window.innerHeight);
    }

    async initParticles() {
        const loader = new THREE.TextureLoader();
        const img = await new Promise(resolve => {
            const i = new Image();
            i.src = 'AdobeStock_421043104_Editorial_Use_Only.jpeg';
            i.crossOrigin = "anonymous";
            i.onload = () => resolve(i);
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(img, 0, 0, 128, 128);
        const data = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.posArray = new Float32Array(this.particleCount * 3);
        this.colArray = new Float32Array(this.particleCount * 3);
        this.originArray = new Float32Array(this.particleCount * 2);
        this.velArray = new Float32Array(this.particleCount * 2);

        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * window.innerWidth * 1.2;
            const y = (Math.random() - 0.5) * window.innerHeight * 1.2;
            
            this.posArray[i*3] = x;
            this.posArray[i*3+1] = y;
            this.posArray[i*3+2] = (Math.random() - 0.5) * 50;

            this.originArray[i*2] = x;
            this.originArray[i*2+1] = y;

            const rx = Math.floor(Math.random() * 128);
            const ry = Math.floor(Math.random() * 128);
            const idx = (ry * 128 + rx) * 4;

            this.colArray[i*3] = data[idx] / 255;
            this.colArray[i*3+1] = data[idx+1] / 255;
            this.colArray[i*3+2] = data[idx+2] / 255;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.colArray, 3));

        const mat = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);
    }

    async initAI() {
        this.video = document.createElement('video');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        this.video.srcObject = stream;
        this.video.play();

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.8,
            minTrackingConfidence: 0.8
        });

        hands.onResults((res) => {
            const data = this.intelligence.process(res);
            this.updateForces(data);
        });

        const camera = new Camera(this.video, {
            onFrame: async () => { await hands.send({ image: this.video }); }
        });
        camera.start();
        document.getElementById('overlay').innerText = "SYSTEM: ONLINE. DATA STREAM ACTIVE.";
    }

    updateForces(data) {
        if (data.right) {
            if (this.lastRight) {
                const vx = data.right.x - this.lastRight.x;
                const vy = data.right.y - this.lastRight.y;
                this.fluid.addForce(data.right.x + window.innerWidth/2, window.innerHeight/2 - data.right.y, vx, vy, 150);
            }
            this.lastRight = { ...data.right };
        } else { this.lastRight = null; }

        if (data.left) {
            if (this.lastLeft) {
                const vx = data.left.x - this.lastLeft.x;
                const vy = data.left.y - this.lastLeft.y;
                this.fluid.addForce(data.left.x + window.innerWidth/2, window.innerHeight/2 - data.left.y, vx, vy, 150);
            }
            this.lastLeft = { ...data.left };
        } else { this.lastLeft = null; }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        if (!this.points) return;

        this.fluid.update();
        const posAttr = this.points.geometry.attributes.position;

        for (let i = 0; i < this.particleCount; i++) {
            const px = this.posArray[i*3];
            const py = this.posArray[i*3+1];

            const flow = this.fluid.getVelocity(px + window.innerWidth/2, window.innerHeight/2 - py);

            this.velArray[i*2] += flow.x * 0.25;
            this.velArray[i*2+1] += flow.y * 0.25;

            this.velArray[i*2] *= 0.93;
            this.velArray[i*2+1] *= 0.93;

            this.posArray[i*3] += this.velArray[i*2];
            this.posArray[i*3+1] += this.velArray[i*2+1];

            const dx = this.originArray[i*2] - this.posArray[i*3];
            const dy = this.originArray[i*2+1] - this.posArray[i*3+1];
            
            this.posArray[i*3] += dx * 0.015;
            this.posArray[i*3+1] += dy * 0.015;
            
            this.posArray[i*3+2] = Math.sin(Date.now() * 0.001 + i) * 10;
        }

        posAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }

    loop() {
        this.render();
        requestAnimationFrame(() => this.loop());
    }
}

const engine = new SculptureEngine();
engine.loop();
