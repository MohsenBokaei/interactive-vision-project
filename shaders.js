const PROJECT_SHADERS = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aReveal; // New Attribute: 0 to 1
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;
        
        uniform float uTime;

        void main() {
            vReveal = aReveal;
            vec3 pos = position;

            // GOAL: Hand presence makes the "Dust" more excited
            float excitement = aReveal * 15.0;
            pos.x += sin(uTime * 2.0 + pos.y) * excitement;
            pos.y += cos(uTime * 2.0 + pos.x) * excitement;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Brighten based on reveal
            vColor = mix(aColor * 0.2, aColor * 1.5, aReveal);
            
            // Opacity controls the dissolve
            vAlpha = aReveal * clamp(1.2 - (abs(mvPosition.z) / 1200.0), 0.0, 1.0);
            
            gl_PointSize = aSize * (1.0 + aReveal * 2.0) * (1000.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;

        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;

            // Sand grain with "glow" when fully revealed
            float grain = pow(1.0 - d * 2.0, 3.0);
            float glow = vReveal * pow(1.0 - d * 2.0, 10.0);
            
            gl_FragColor = vec4(vColor + glow, grain * vAlpha);
        }
    `
};
