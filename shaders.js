const PROJECT_SHADERS = {
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

            // GOAL 3: Slow Winds & Atmospheric Breathing
            float windFactor = uTime * 0.4;
            pos.x += sin(windFactor + pos.y * 0.02) * 12.0;
            pos.y += cos(windFactor + pos.x * 0.02) * 12.0;
            
            // Z-Axis Depth Oscillation (Closer/Further)
            pos.z += sin(uTime * 0.25 + (pos.x * 0.005)) * 50.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // GOAL 2: Cinematic Shine spectrum
            // Interpolate base color with high-intensity cyan-white
            vec3 shine = vec3(0.6, 0.95, 1.0);
            vColor = mix(aColor, shine, aImpact * 0.85);

            // Atmospheric perspective: fade particles by distance
            vAlpha = (0.2 + aImpact * 0.8) * clamp(1.2 - (abs(mvPosition.z) / 1300.0), 0.0, 1.0);
            
            float sizeCore = 1.0 + (aImpact * 3.5);
            gl_PointSize = aSize * sizeCore * (1200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vImpact;

        void main() {
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;

            // GOAL 2: Cinematic Glow/Bloom
            float glow = pow(1.0 - r * 2.0, 3.5);
            float sparkle = pow(1.0 - r * 2.0, 20.0);
            
            vec3 finalTone = vColor + (vImpact * vec3(0.3, 0.5, 0.7));
            gl_FragColor = vec4(finalTone, (glow + sparkle) * vAlpha);
        }
    `
};
