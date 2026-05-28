let scene, camera, renderer, points;
let particles = { positions: null, originals: null, velocities: null, colors: null };
let fluid;
let hands, video;
let prevRight = null, prevLeft = null;

const PARTICLE_COUNT = 30000; // Refik Anadol style density

async function init() {
    // 1. Three.js Scene Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 600;

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 2. Initialize Fluid Math (from your motion.js)
    fluid = new FluidSimulation(window.innerWidth, window.innerHeight);

    // 3. Load Image & Extract Colors (The "Data" part)
    const img = new Image();
    img.src = 'AdobeStock_421043104_Editorial_Use_Only.jpeg'; 
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100; // Low-res sample for speed
        canvas.height = 100;
        ctx.drawImage(img, 0, 0, 100, 100);
        const imgData = ctx.getImageData(0, 0, 100, 100).data;

        // 4. Create GPU-ready Geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const originals = new Float32Array(PARTICLE_COUNT * 2);
        const velocities = new Float32Array(PARTICLE_COUNT * 2);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            let x = (Math.random() - 0.5) * window.innerWidth;
            let y = (Math.random() - 0.5) * window.innerHeight;
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = 0;
            originals[i * 2] = x;
            originals[i * 2 + 1] = y;

            // Map image colors to particles
            let sampleX = Math.floor(Math.random() * 100);
            let sampleY = Math.floor(Math.random() * 100);
            let pixelIdx = (sampleY * 100 + sampleX) * 4;
            
            colors[i * 3] = imgData[pixelIdx] / 255;     // R
            colors[i * 3 + 1] = imgData[pixelIdx+1] / 255; // G
            colors[i * 3 + 2] = imgData[pixelIdx+2] / 255; // B
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending // Makes overlapping points glow
        });

        points = new THREE.Points(geometry, material);
        scene.add(points);
        particles = { positions, originals, velocities, colors };

        setupAI();
        animate();
    };
}

async function setupAI() {
    video = document.createElement('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();

    hands = new Hands({locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
    hands.setOptions({ maxNumHands: 2, modelComplexity: 0 });
    hands.onResults(onResults);

    const mpCamera = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }); },
        width: 640, height: 480
    });
    mpCamera.start();
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const hand = results.multiHandLandmarks[i];
            const label = results.multiHandedness[i].label; // Left/Right
            
            const x = (1 - hand[8].x) * window.innerWidth - window.innerWidth/2;
            const y = (0.5 - hand[8].y) * window.innerHeight;

            if (label === "Left") { // MediaPipe Left = Physical Right Hand
                if (prevRight) fluid.addForce(x + window.innerWidth/2, window.innerHeight/2 - y, x - prevRight.x, y - prevRight.y, 150);
                prevRight = {x, y};
            } else {
                if (prevLeft) fluid.addForce(x + window.innerWidth/2, window.innerHeight/2 - y, x - prevLeft.x, y - prevLeft.y, 150);
                prevLeft = {x, y};
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (!points) return;

    fluid.update();
    const posAttr = points.geometry.attributes.position;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let px = particles.positions[i * 3];
        let py = particles.positions[i * 3 + 1];

        const flow = fluid.getVelocity(px + window.innerWidth/2, window.innerHeight/2 - py);
        
        // Fluid Force
        particles.velocities[i * 2] += flow.x * 0.15;
        particles.velocities[i * 2 + 1] += flow.y * 0.15;

        // Friction (Liquid feel)
        particles.velocities[i * 2] *= 0.94;
        particles.velocities[i * 2 + 1] *= 0.94;

        // Update Position
        particles.positions[i * 3] += particles.velocities[i * 2];
        particles.positions[i * 3 + 1] += particles.velocities[i * 2 + 1];

        // "Dream" Return: Slowly pull particles back to their original pixel home
        particles.positions[i * 3] += (particles.originals[i * 2] - particles.positions[i * 3]) * 0.015;
        particles.positions[i * 3 + 1] += (particles.originals[i * 2 + 1] - particles.positions[i * 3 + 1]) * 0.015;
    }

    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
