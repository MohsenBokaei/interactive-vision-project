class CinematicEngine {
    constructor() {
        this.baseCount = 100000;
        this.maxParticles = 300000;
        this.influenceDecay = 0.92;
        this.init();
    }

    async init() {
        this.setupScene();
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight, 22);
        this.hands = new HandProcessor();
        
        await this.prepareAssets();
        this.setupAI();
        this.setupUI();
        this.render();
        
        document.getElementById('app-loader').style.display = 'none';
    }

    setupUI() {
        const slider = document.getElementById('density-slider');
        const display = document.getElementById('p-count-display');
        
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            display.innerText = val.toLocaleString();
            this.updateParticleCount(val);
        });
    }

    updateParticleCount(count) {
        // Advanced feature: Visible/Invisible toggling for performance
        this.points.geometry.setDrawRange(0, count);
    }

    async prepareAssets() {
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(texture.image, 0, 0, 128, 128);
        const imgData = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.maxParticles * 3);
        this.col = new Float32Array(this.maxParticles * 3);
        this.org = new Float32Array(this.maxParticles * 3);
        this.vel = new Float32Array(this.maxParticles * 3);
        this.size = new Float32Array(this.maxParticles);
        this.infl = new Float32Array(this.maxParticles); // Goal 2 attribute

        for (let i = 0; i < this.maxParticles; i++) {
            const x = (Math.random() - 0.5) * window.innerWidth * 1.6;
            const y = (Math.random() - 0.5) * window.innerHeight * 1.6;
            const z = (Math.random() - 0.5) * 200;

            this.pos[i*3]=x; this.pos[i*3+1]=y; this.pos[i*3+2]=z;
            this.org[i*3]=x; this.org[i*3+1]=y; this.org[i*3+2]=z;

            const sx = Math.floor(Math.random() * 128);
            const sy = Math.floor(Math.random() * 128);
            const idx = (sy * 128 + sx) * 4;

            this.col[i*3] = imgData[idx]/255;
            this.col[i*3+1] = imgData[idx+1]/255;
            this.col[i*3+2] = imgData[idx+2]/255;
            
            this.size[i] = Math.random() * 2.0 + 0.5;
            this.infl[i] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        geo.setAttribute('aInfluence', new THREE.BufferAttribute(this.infl, 1));

        this.uniforms = { uTime: { value: 0 }, uHandImpact: { value: 0 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: DustShader.vertex,
            fragmentShader: DustShader.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, mat);
        this.updateParticleCount(this.baseCount);
        this.scene.add(this.points);
    }

    render() {
        requestAnimationFrame(() => this.render());
        const time = performance.now() * 0.001;
        this.uniforms.uTime.value = time;
        this.fluid.update();
        
        // Update UI Clock
        document.getElementById('clock-display').innerText = new Date().toTimeString().split(' ')[0];

        const posAttr = this.points.geometry.attributes.position;
        const inflAttr = this.points.geometry.attributes.aInfluence;
        const count = this.points.geometry.drawRange.count;

        for (let i = 0; i < count; i++) {
            const screenX = this.pos[i*3] + window.innerWidth / 2;
            const screenY = window.innerHeight / 2 - this.pos[i*3+1];
            
            const flow = this.fluid.getVelocity(screenX, screenY);
            
            // Goal 2 & 3: Movement Logic
            this.vel[i*3] += flow.x * 0.4;
            this.vel[i*3+1] -= flow.y * 0.4;

            // Hand Influence (Color Shine) logic
            const handInteraction = Math.abs(flow.x) + Math.abs(flow.y);
            if (handInteraction > 0.1) {
                this.infl[i] = 1.0; 
            } else {
                this.infl[i] *= this.influenceDecay; // Gradual fade back to original
            }

            this.vel[i*3] *= 0.94;
            this.vel[i*3+1] *= 0.94;

            this.pos[i*3] += this.vel[i*3];
            this.pos[i*3+1] += this.vel[i*3+1];

            // Goal 3: Cinematic breathing snap-back
            const snap = 0.006 + Math.sin(time + i*0.0001) * 0.002;
            this.pos[i*3] += (this.org[i*3] - this.pos[i*3]) * snap;
            this.pos[i*3+1] += (this.org[i*3+1] - this.pos[i*3+1]) * snap;
        }

        posAttr.needsUpdate = true;
        inflAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 4000);
        this.camera.position.z = 900;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    setupAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            video.srcObject = s; video.play();
            const ai = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            ai.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.8 });
            ai.onResults(res => {
                this.hands.update(res, window.innerWidth, window.innerHeight);
                this.handleForces();
            });
            new Camera(video, { onFrame: async () => await ai.send({ image: video }) }).start();
        });
    }

    handleForces() {
        ['left', 'right'].forEach(s => {
            const h = this.hands.data[s];
            const p = this.hands.prevData[s];
            const div = document.getElementById(`signal-${s[0]}`);
            if (h && p) {
                const vx = (h.x - p.x) * 2.2;
                const vy = (p.y - h.y) * 2.2;
                this.fluid.addVelocity(h.x, h.y, vx, vy, 190);
                div.style.width = '100%';
            } else { div.style.width = '0%'; }
        });
    }
}
new CinematicEngine();
