class MathUtils {
    // Advanced Linear Interpolation
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // High-performance 2D Noise for atmospheric drifting
    static noise(x, y, z = 0) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        return (Math.sin(X * 12.9898 + Y * 78.233 + Z * 4.1414) * 43758.5453123) % 1;
    }

    // Vector magnitude helper
    static mag(x, y) {
        return Math.sqrt(x * x + y * y);
    }

    // Distance between two points
    static dist(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    // Constraint helper
    static clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
}
