const CloudShader = {
    vertex: `
        attribute float aBrightness;
        attribute float aLife;
        varying float vLife;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;

        void main() {
            vLife = aLife;
            vec3 pos = position;
            
            // Atmospheric Drift
            pos.z += sin(uTime * 0.2 + pos.x * 0.01) * 25.0;
            
            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            
            // Sand Grain Size Scaling
            float pSize = (2.0 + aLife * 4.0) * (1000.0 / -mvPos.z);
            gl_PointSize = pSize;
            
            vColor = vec3(0.9, 0.95, 1.0) * (0.8 + aLife * 0.4);
            vAlpha = (0.2 + aLife * 0.8) * clamp(1.0 - (abs(mvPos.z)/1500.0), 0.0, 1.0);
            
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;
            // Sharp center with soft falloff (Dust Grain)
            float grain = pow(1.0 - d * 2.0, 3.0);
            gl_FragColor = vec4(vColor, grain * vAlpha);
        }
    `
};
