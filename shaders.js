const SculptureShader = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aImpact;
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vImpact;
        
        uniform float uTime;

        void main() {
            vImpact = aImpact;
            vec3 pos = position;

            // GOAL 3: Breathing slow winds (Natural Floating)
            float windX = sin(uTime * 0.4 + pos.y * 0.01) * 15.0;
            float windY = cos(uTime * 0.3 + pos.x * 0.01) * 15.0;
            pos.x += windX;
            pos.y += windY;

            // GOAL 3: Z-Axis drift (Closer and further naturally)
            float drift = sin(uTime * 0.2 + (pos.x + pos.y) * 0.005) * 60.0;
            pos.z += drift;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            
            // GOAL 2: Cinematic color spectrum (Shiny when touched)
            vec3 glowColor = vec3(0.5, 0.9, 1.0); // Electric Cyan
            vColor = mix(aColor, glowColor, aImpact * 0.7);

            vAlpha = (0.3 + aImpact * 0.7) * clamp(1.2 - (abs(mvPos.z) / 1200.0), 0.0, 1.0);
            
            float sizeMod = 1.0 + (aImpact * 3.0);
            gl_PointSize = aSize * sizeMod * (1200.0 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vImpact;

        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;

            // GOAL 2: Shiny Bloom effect
            float bloom = pow(1.0 - d * 2.0, 4.0);
            float core = pow(1.0 - d * 2.0, 15.0);
            
            vec3 finalColor = vColor + (vImpact * vec3(0.2, 0.5, 0.8));
            gl_FragColor = vec4(finalColor, (bloom + core) * vAlpha);
        }
    `
};
