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

            // Goal 3: Cinematic Breathing Winds
            float breath = uTime * 0.5;
            pos.x += sin(breath + pos.y * 0.01) * 15.0;
            pos.y += cos(breath + pos.x * 0.01) * 15.0;
            pos.z += sin(breath * 0.5 + pos.x * 0.005) * 80.0;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            
            // Goal 2: Color Spectrum mix (White nerves to Red fibers)
            vec3 fiberRed = vec3(0.7, 0.02, 0.05);
            vec3 nerveWhite = vec3(1.0, 0.98, 1.0);
            vColor = mix(fiberRed, nerveWhite, pow(aReveal, 3.0));

            // Atmospheric perspective
            vAlpha = aReveal * clamp(1.4 - (abs(mvPos.z) / 1300.0), 0.0, 1.0);
            
            gl_PointSize = aSize * (1.0 + aReveal * 4.0) * (1400.0 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;

        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;

            // Neural look: Sharp core with soft glow
            float glow = pow(1.0 - d * 2.0, 3.0);
            float spike = pow(1.0 - d * 2.0, 25.0) * vReveal;
            
            gl_FragColor = vec4(vColor + spike, glow * vAlpha);
        }
    `
};
