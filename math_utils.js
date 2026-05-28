class MathUtils {
    static lerp(a, b, t) { return a + (b - a) * t; }
    
    // Perlin-like noise for natural floating
    static noise(x, y, z) {
        return Math.sin(x * 0.12 + z) * Math.cos(y * 0.15 + z) * 0.5;
    }

    static clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

    static getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
}
