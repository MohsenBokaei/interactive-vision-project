const DustShader = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aInfluence; // Hand influence factor
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vInfluence;
        
        uniform float uTime;
        uniform float uHandImpact;

        void main() {
            vInfluence = aInfluence;
            
            // Goal 3: Smooth breathing Z-motion & distance oscillation
            vec3 pos = position;
            float breathing = sin(uTime * 0.5 + pos.x * 0.01 + pos.y * 0.01) * 40.0;
            pos.z += breathing;
            
            // Small harmonic jitter
            pos.x += cos(uTime * 0.3 + pos.y) * 2.0;
            pos.y += sin(uTime * 0.3 + pos.x) * 2.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Goal 2: Shiny color interpolation when touched
            // Interpolate original color to a cinematic white/cyan glow
            vec3 shinyColor = vec3(0.8, 0.95, 1.0); 
            vColor = mix(aColor, shinyColor, aInfluence * 0.8);
            
            // Goal 3: Atmospheric fading
            vAlpha = clamp(1.5 - (abs(mvPosition.z) / 1000.0), 0.1, 1.0);
            
            float sizeBoost = 1.0 + (aInfluence * 2.5);
            gl_PointSize = aSize * sizeBoost * (1500.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vInfluence;
        
        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;
            
            // Goal 2: High-bloom cinematic glow
            float glow = pow(1.0 - d * 2.0, 4.0);
            float inner = pow(1.0 - d * 2.0, 10.0);
            
            vec3 finalColor = vColor + (vInfluence * vec3(0.2, 0.4, 0.5));
            gl_FragColor = vec4(finalColor, (glow + inner) * vAlpha);
        }
    `
};
