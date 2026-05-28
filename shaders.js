const SimulationShader = {
    vertex: `
        attribute vec3 origin;
        attribute vec3 customColor;
        varying vec3 vColor;
        varying float vDist;
        uniform float uTime;
        uniform float uPointScale;

        void main() {
            vColor = customColor;
            vec3 pos = position;
            
            // Subtle Z-breathing
            float noise = sin(pos.x * 0.01 + uTime) * cos(pos.y * 0.01 + uTime);
            pos.z += noise * 20.0;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = uPointScale * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;
            float glow = pow(0.5 - d, 2.0);
            gl_FragColor = vec4(vColor + glow, 1.0);
        }
    `
};
