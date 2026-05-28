const CustomShaders = {
    vertex: `
        attribute vec3 customColor;
        attribute float size;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;

        void main() {
            vColor = customColor;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            // Particles get larger/brighter when they move
            float dist = length(position.xyz - vec3(0.0));
            vAlpha = clamp(1.0 - (dist / 1000.0), 0.2, 1.0);
            
            gl_PointSize = size * (400.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragment: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            float strength = pow(1.0 - r * 2.0, 2.0);
            gl_FragColor = vec4(vColor, strength * vAlpha);
        }
    `
};
