var NEURAL_SHADERS = {
    vertex: `
        attribute float aSize;
        attribute float aReveal;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vReveal;
        uniform float uTime;

        void main() {
            vReveal = aReveal;
            vec3 pos = position;
            float t = uTime * 0.6;
            pos.x += sin(t + pos.y * 0.02) * (15.0 + aReveal * 15.0);
            pos.y += cos(t + pos.x * 0.02) * (15.0 + aReveal * 15.0);
            pos.z += sin(t * 0.5 + pos.x * 0.01) * 80.0;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            vec3 fiberRed = vec3(0.7, 0.05, 0.1); 
            vec3 nerveWhite = vec3(1.0, 0.95, 1.0);
            vColor = mix(fiberRed, nerveWhite, pow(aReveal, 2.5));
            vAlpha = aReveal * clamp(1.6 - (abs(mvPos.z) / 1400.0), 0.0, 1.0);
            gl_PointSize = aSize * (1.0 + aReveal * 4.0) * (1200.0 / -mvPos.z);
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
            float glow = pow(1.0 - d * 2.0, 3.0);
            float core = pow(1.0 - d * 2.0, 15.0) * vReveal;
            gl_FragColor = vec4(vColor + core, glow * vAlpha);
        }
    `
};
