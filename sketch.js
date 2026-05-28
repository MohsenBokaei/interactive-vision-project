class DustSculpture {
    constructor() {
        this.PARTICLE_COUNT = 200000;
        this.init();
    }

    async init() {
        this.setupThree();
        this.fluid = new FluidSolver(window.innerWidth, window.innerHeight, 20);
        this.hands = new HandProcessor();
        
        await this.loadTextureAndCreateParticles();
        this.setupAI();
        this.render();
        
        document.getElementById('app-loader').style.display = 'none';
    }

    setupThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
        this.camera.position.z = 800;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);
    }

    async loadTextureAndCreateParticles() {
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
        
        // Sampling Pixel Colors
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; canvas.height = 128;
        ctx.drawImage(texture.image, 0, 0, 128, 128);
        const pixels = ctx.getImageData(0, 0, 128, 128).data;

        const geo = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.PARTICLE_COUNT * 3);
        this.colors = new Float32Array(this.PARTICLE_COUNT * 3);
        this.origins = new Float32Array(this.PARTICLE_COUNT * 3);
        this.vels = new Float32Array(this.PARTICLE_COUNT * 3);
        this.sizes = new Float32Array(this.PARTICLE_COUNT);

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const x = (Math.random() - 0.5) * window.innerWidth * 1.5;
            const y = (Math.random() - 0.5) * window.innerHeight * 1.5;
            const z = (Math.random() - 0.5) * 100;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;
            this.origins[i * 3] = x;
            this.origins[i * 3 + 1] = y;
            this.origins[i * 3 + 2] = z;

            const sx = Math.floor(Math.random() * 128);
            const sy = Math.floor(Math.random() * 128);
            const idx = (sy * 128 + sx) * 4;

            this.colors[i * 3] = pixels[idx] / 255;
            this.colors[i * 3 + 1] = pixels[idx + 1] / 255;
            this.colors[i * 3 + 2] = pixels[idx + 2] / 255;
            
            // Random dust sizes
            this.sizes[i] = Math.random() * 2.5 + 0.5;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

        this.uniforms = { uTime: { value: 0 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: DustShader.vertex,
            fragmentShader: DustShader.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geo, mat);
        this.scene.add(this.points);
    }

    setupAI() {
        const video = document.createElement('video');
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            video.srcObject = stream;
            video.play();
            
            const ai = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            ai.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.8 });
            ai.onResults(res => {
                this.hands.update(res, window.innerWidth, window.innerHeight);
                this.injectForces();
            });
            
            new Camera(video, { onFrame: async () => await ai.send({ image: video }) }).start();
        });
    }

    injectForces() {
        ['left', 'right'].forEach(side => {
            const h = this.hands.data[side];
            const prev = this.hands.prevData[side];
            const signalDiv = document.getElementById(`signal-${side[0]}`);
            
            if (h && prev) {
                const vx = (h.x - prev.x) * 1.5;
                const vy = (prev.y - h.y) * 1.5;
                this.fluid.addVelocity(h.x, h.y, vx, vy, 180);
                signalDiv.style.width = '100%';
            } else {
                signalDiv.style.width = '0%';
            }
        });
    }

    render() {
        requestAnimationFrame(() => this.render());
        
        this.uniforms.uTime.value = performance.now() * 0.001;
        this.fluid.update();
        
        const posAttr = this.points.geometry.attributes.position;
        const arr = posAttr.array;

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const screenX = arr[i * 3] + window.innerWidth / 2;
            const screenY = window.innerHeight / 2 - arr[i * 3 + 1];

            const flow = this.fluid.getVelocity(screenX, screenY);

            // Realistic Dust Inertia
            this.vels[i * 3] += flow.x * 0.3;
            this.vels[i * 3 + 1] -= flow.y * 0.3;

            this.vels[i * 3] *= 0.95;
            this.vels[i * 3 + 1] *= 0.95;

            arr[i * 3] += this.vels[i * 3];
            arr[i * 3 + 1] += this.vels[i * 3 + 1];

            // Natural Floating Snapback
            arr[i * 3] += (this.origins[i * 3] - arr[i * 3]) * 0.008;
            arr[i * 3 + 1] += (this.origins[i * 3 + 1] - arr[i * 3 + 1]) * 0.008;
        }

        posAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}

new DustSculpture();
