const PROJECT_SHADERS = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aLife; // Matches sketch.js
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vLife;
        
        uniform float uTime;

        void main() {
            vLife = aLife;
            vec3 pos = position;

            // Natural Floating Movement
            float drift = sin(uTime * 0.5 + pos.y * 0.01) * 15.0;
            pos.x += drift * (1.0 - aLife);
            pos.z += cos(uTime * 0.3 + pos.x * 0.01) * 30.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Cinematic Color Mix
            vec3 shinyColor = vec3(0.7, 0.9, 1.0);
            vColor = mix(aColor, shinyColor, aLife * 0.7);

            // Distance Fading
            vAlpha = (0.2 + aLife * 0.8) * clamp(1.2 - (abs(mvPosition.z) / 1200.0), 0.0, 1.0);
            
            gl_PointSize = aSize * (1.0 + aLife * 2.0) * (1000.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vLife;

        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;

            // Sand Grain Shape (High contrast center)
            float grain = pow(1.0 - d * 2.0, 4.0);
            float spark = pow(1.0 - d * 2.0, 20.0);
            
            gl_FragColor = vec4(vColor + spark, grain * vAlpha);
        }
    `
};
