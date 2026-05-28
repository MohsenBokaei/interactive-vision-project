let scene, camera, renderer, points;
let particles = [];
let fluid;
let hands, video;
let prevRight = null, prevLeft = null;
let bgImg;

const PARTICLE_COUNT = 30000; // Three.js handles this easily!

async function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    fluid = new FluidSimulation(window.innerWidth, window.innerHeight);

    // 2. Load Image Data
    const loader = new THREE.TextureLoader();
    bgImg = await loader.loadAsync('AdobeStock_421043104_Editorial_Use_Only.jpeg');
    
    // Create Particle Data
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const originals = new Float32Array(PARTICLE_COUNT * 2);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x = (Math.random() - 0.5) * window.innerWidth;
        let y = (Math.random() - 0.5) * window.innerHeight;
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;

        originals[i * 2] = x;
        originals[i * 2 + 1] = y;

        // Set colors to white/blue for that data look
        colors[i * 3] = 0.5;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending // Anadol style glow
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
    particles = { positions, originals, velocities: new Float32Array(PARTICLE_COUNT * 2) };

    // 3. MediaPipe Setup
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

    animate();
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const hand = results.multiHandLandmarks[i];
            const label = results.multiHandedness[i].label;
            
            // Map camera to screen
            const x = (1 - hand[8].x) * window.innerWidth - window.innerWidth/2;
            const y = (0.5 - hand[8].y) * window.innerHeight;
            const currentPos = { x, y };

            if (label === "Left") { // Right hand
                if (prevRight) {
                    fluid.addForce(x + window.innerWidth/2, window.innerHeight/2 - y, (x - prevRight.x), (y - prevRight.y), 150);
                }
                prevRight = currentPos;
            } else { // Left hand
                if (prevLeft) {
                    fluid.addForce(x + window.innerWidth/2, window.innerHeight/2 - y, (x - prevLeft.x), (y - prevLeft.y), 150);
                }
                prevLeft = currentPos;
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    fluid.update();

    const posAttr = points.geometry.attributes.position;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x = particles.positions[i * 3];
        let y = particles.positions[i * 3 + 1];

        // Apply Fluid Flow
        const flow = fluid.getVelocity(x + window.innerWidth/2, window.innerHeight/2 - y);
        
        particles.velocities[i * 2] += flow.x * 0.1;
        particles.velocities[i * 2 + 1] += flow.y * 0.1;

        // Friction
        particles.velocities[i * 2] *= 0.95;
        particles.velocities[i * 2 + 1] *= 0.95;

        // Apply Velocity
        particles.positions[i * 3] += particles.velocities[i * 2];
        particles.positions[i * 3 + 1] += particles.velocities[i * 2 + 1];

        // Pull back to original
        particles.positions[i * 3] += (particles.originals[i * 2] - particles.positions[i * 3]) * 0.02;
        particles.positions[i * 3 + 1] += (particles.originals[i * 2 + 1] - particles.positions[i * 3 + 1]) * 0.02;
    }

    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}

init();
