const PROJECT_SHADERS = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aReveal;
        attribute float aType; // 0 = Dust, 1 = Nerve Fiber
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;
        
        uniform float uTime;

        void main() {
            vReveal = aReveal;
            vec3 pos = position;

            // Goal: Organic fibrous movement
            float t = uTime * 0.6;
            float noise = sin(t + pos.y * 0.02) * cos(t + pos.x * 0.02);
            pos.x += noise * (15.0 + aReveal * 10.0);
            pos.y += noise * (15.0 + aReveal * 10.0);
            pos.z += sin(t * 0.5 + pos.x * 0.01) * 100.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // COLOR LOGIC: Reference Image Palette
            // Base = Deep Red, Revealed = Glowing White/Pink
            vec3 fiberRed = vec3(0.6, 0.05, 0.1); 
            vec3 nerveWhite = vec3(1.0, 0.95, 1.0);
            
            vColor = mix(fiberRed, nerveWhite, pow(aReveal, 2.0));

            // Atmospheric Fading
            vAlpha = aReveal * clamp(1.6 - (abs(mvPosition.z) / 1400.0), 0.0, 1.0);
            
            // Wires should be sharp, dust should be soft
            float finalSize = aSize * (1.0 + aReveal * 3.0);
            gl_PointSize = finalSize * (1200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;

        void main() {
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;

            // Wire/Nerve look: High density core
            float neuralGlow = pow(1.0 - r * 2.0, 2.0);
            float core = pow(1.0 - r * 2.0, 12.0) * vReveal;
            
            gl_FragColor = vec4(vColor + core, neuralGlow * vAlpha);
        }
    `
};
