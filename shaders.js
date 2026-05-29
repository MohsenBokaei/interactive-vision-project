const PROJECT_SHADERS = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aReveal;
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;
        
        uniform float uTime;

        void main() {
            vReveal = aReveal;
            vec3 pos = position;

            // GPU PHYSICS: Breathing wind drift (Highly optimized)
            float t = uTime * 0.5;
            pos.x += sin(t + pos.y * 0.01) * 20.0;
            pos.y += cos(t + pos.x * 0.01) * 20.0;
            
            // GOAL 3: Z-Axis natural drift (Closing and furthering)
            pos.z += sin(t * 0.4 + (pos.x * 0.01)) * 80.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // GOAL 2: Cinematic Shine
            vec3 shinyColor = vec3(0.8, 0.96, 1.0);
            vColor = mix(aColor * 0.1, shinyColor, aReveal);

            // Visibility Logic
            vAlpha = aReveal * clamp(1.5 - (abs(mvPosition.z) / 1500.0), 0.0, 1.0);
            
            gl_PointSize = aSize * (1.0 + aReveal * 4.0) * (1500.0 / -mvPosition.z);
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

            // Realistic Dust Grain math
            float grain = pow(1.0 - r * 2.0, 2.5);
            float core = pow(1.0 - r * 2.0, 15.0) * vReveal;
            
            gl_FragColor = vec4(vColor + core, grain * vAlpha);
        }
    `
};
