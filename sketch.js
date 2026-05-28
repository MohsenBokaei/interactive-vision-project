class SandSculpture {
    constructor() {
        this.maxParticles = 500000;
        this.activeCount = 150000;
        this.init();
    }

    async init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 4000);
        this.camera.position.z = 800;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight);
        this.processor = new HandProcessor();

        await this.generateParticles();
        this.setupAI();
        this.setupUI();
        this.animate();
    }

    setupUI() {
        const slider = document.getElementById('p-slider');
        const countDisplay = document.getElementById('p-count');
        
        slider.oninput = (e) => {
            this.activeCount = parseInt(e.target.value);
            countDisplay.innerText = this.activeCount.toLocaleString() + " PARTICLES";
            this.points.geometry.setDrawRange(0, this.activeCount);
        };
    }

    async generateParticles() {
        // To get the "Wispy" look, we don't use a grid. 
        // We use a Random Gaussian distribution to create clusters.
        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.maxParticles * 3);
        this.origins = new Float32Array(this.maxParticles * 3);
        this.vels = new Float32Array(this.maxParticles * 2);
        this.life = new Float32Array(this.maxParticles);

        for (let i = 0; i < this.maxParticles; i++) {
            // Clustered distribution like a cloud
            const theta = Math.random() * Math.PI * 2;
            const rad = Math.pow(Math.random(), 2) * window.innerWidth * 0.7;
            
            const x = Math.cos(theta) * rad;
            const y = Math.sin(theta) * rad;
            const z = (Math.random() - 0.5) * 200;

            this.pos[i*3]=x; this.pos[i*3+1]=y; this.pos[i*3+2]=z;
            this.origins[i*3]=x; this.origins[i*3+1]=y; this.origins[i*3+2]=z;
            this.life[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));

        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: CloudShader.vertex,
            fragmentShader: CloudShader.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, this.mat);
        this.points.geometry.setDrawRange(0, this.activeCount);
        this.scene.add(this.points);
    }

    setupAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            video.srcObject = s; video.play();
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.85 });
            hands.onResults(res => {
                this.processor.update(res, window.innerWidth, window.innerHeight);
                this.interact();
            });
            new Camera(video, { onFrame: async () => await hands.send({ image: video }) }).start();
        });
    }

    interact() {
        let totalVel = 0;
        ['left', 'right'].forEach(side => {
            const h = this.processor.hands[side];
            const p = this.processor.prevHands[side];
            if (h && p) {
                const dx = (h.x - p.x) * 2.5;
                const dy = (p.y - h.y) * 2.5;
                this.fluid.applyForce(h.x, h.y, dx, dy, 200);
                totalVel += Math.abs(dx) + Math.abs(dy);
            }
        });
        document.getElementById('h-status').innerText = totalVel > 0 ? "SIGNAL: STREAMING" : "SIGNAL: IDLE";
        document.getElementById('h-meter').style.width = Math.min(totalVel * 10, 100) + "%";
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const t = performance.now() * 0.001;
        this.mat.uniforms.uTime.value = t;
        this.fluid.update(t);

        const posAttr = this.points.geometry.attributes.position;
        const lifeAttr = this.points.geometry.attributes.aLife;

        for (let i = 0; i < this.activeCount; i++) {
            const sx = this.pos[i*3] + window.innerWidth/2;
            const sy = window.innerHeight/2 - this.pos[i*3+1];
            
            const flow = this.fluid.getVelocity(sx, sy);
            
            // Momentum Logic
            this.vels[i*2] += flow.x * 0.25;
            this.vels[i*2+1] -= flow.y * 0.25;

            // Hand life (shine)
            const speed = Math.sqrt(flow.x*flow.x + flow.y*flow.y);
            if (speed > 0.05) this.life[i] = 1.0;
            else this.life[i] *= 0.92;

            this.vels[i*2] *= 0.95;
            this.vels[i*2+1] *= 0.95;

            this.pos[i*3] += this.vels[i*2];
            this.pos[i*3+1] += this.vels[i*2+1];

            // Gentle Wispy Return
            const pull = 0.005 + Math.sin(t + i * 0.001) * 0.002;
            this.pos[i*3] += (this.origins[i*3] - this.pos[i*3]) * pull;
            this.pos[i*3+1] += (this.origins[i*3+1] - this.pos[i*3+1]) * pull;
        }

        posAttr.needsUpdate = true;
        lifeAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
new SandSculpture();
