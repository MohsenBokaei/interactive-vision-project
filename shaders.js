const DustShader = {
    vertex: `
        attribute float aSize;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;

        void main() {
            vColor = aColor;
            
            // Adding Brownian oscillation to the Z axis
            vec3 pos = position;
            pos.z += sin(uTime * 2.0 + position.x * 0.01) * 5.0;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Atmospheric perspective (Dust fades in distance)
            vAlpha = clamp(1.0 - (abs(mvPosition.z) / 1500.0), 0.0, 1.0);
            
            gl_PointSize = aSize * (1200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;
            
            // Soft-edged dust particle
            float soft = pow(1.0 - dist * 2.0, 3.0);
            gl_FragColor = vec4(vColor, soft * vAlpha * 0.8);
        }
    `
};
