let scene, camera, renderer, points;
let particles = { positions: null, originals: null, velocities: null, colors: null };
let fluid;
let hands, video;
let prevRight = null, prevLeft = null;
const PARTICLE_COUNT = 40000;

async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    fluid = new FluidSimulation(window.innerWidth, window.innerHeight);

    const img = new Image();
    img.src = 'AdobeStock_421043104_Editorial_Use_Only.jpeg';
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        ctx.drawImage(img, 0, 0, 128, 128);
        const imgData = ctx.getImageData(0, 0, 128, 128).data;

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

            let sx = Math.floor(Math.random() * 128);
            let sy = Math.floor(Math.random() * 128);
            let idx = (sy * 128 + sx) * 4;
            
            colors[i * 3] = imgData[idx] / 255;
            colors[i * 3 + 1] = imgData[idx + 1] / 255;
            colors[i * 3 + 2] = imgData[idx + 2] / 255;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
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
    
    hands.setOptions({ 
        maxNumHands: 2, 
        modelComplexity: 1,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8 
    });

    hands.onResults(onResults);

    const mpCamera = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }); },
        width: 640, height: 480
    });
    mpCamera.start();
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandedness) {
        let activeRight = false;
        let activeLeft = false;

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const hand = results.multiHandLandmarks[i];
            const label = results.multiHandedness[i].label;
            const score = results.multiHandedness[i].score;

            if (score < 0.85) continue;

            const x = (1 - hand[8].x) * window.innerWidth - window.innerWidth / 2;
            const y = (0.5 - hand[8].y) * window.innerHeight;

            if (label === "Left") {
                if (prevRight) {
                    fluid.addForce(x + window.innerWidth / 2, window.innerHeight / 2 - y, x - prevRight.x, y - prevRight.y, 160);
                }
                prevRight = { x, y };
                activeRight = true;
            } else {
                if (prevLeft) {
                    fluid.addForce(x + window.innerWidth / 2, window.innerHeight / 2 - y, x - prevLeft.x, y - prevLeft.y, 160);
                }
                prevLeft = { x, y };
                activeLeft = true;
            }
        }

        if (!activeRight) prevRight = null;
        if (!activeLeft) prevLeft = null;
    } else {
        prevRight = null;
        prevLeft = null;
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
        const flow = fluid.getVelocity(px + window.innerWidth / 2, window.innerHeight / 2 - py);
        
        particles.velocities[i * 2] += flow.x * 0.2;
        particles.velocities[i * 2 + 1] += flow.y * 0.2;
        particles.velocities[i * 2] *= 0.94;
        particles.velocities[i * 2 + 1] *= 0.94;

        particles.positions[i * 3] += particles.velocities[i * 2];
        particles.positions[i * 3 + 1] += particles.velocities[i * 2 + 1];
        particles.positions[i * 3] += (particles.originals[i * 2] - particles.positions[i * 3]) * 0.01;
        particles.positions[i * 3 + 1] += (particles.originals[i * 2 + 1] - particles.positions[i * 3 + 1]) * 0.01;
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
