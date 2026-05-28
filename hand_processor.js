class HandProcessor {
    constructor() {
        this.data = { left: null, right: null };
        this.prevData = { left: null, right: null };
        this.confidence = 0.9;
        this.smoothing = 0.25;
    }

    // Logic to prevent "Head Tracking"
    isHandValid(landmarks) {
        const wrist = landmarks[0];
        const indexRoot = landmarks[5];
        const pinkyRoot = landmarks[17];
        
        // Measuring the palm aspect ratio
        const width = MathUtils.getDistance(indexRoot, pinkyRoot);
        const length = MathUtils.getDistance(wrist, landmarks[9]);
        
        // Human hands are roughly 2x longer than palm width
        // Heads are roughly 1:1. This filter kills head-tracking.
        const ratio = length / width;
        return (ratio > 1.3 && ratio < 3.5);
    }

    update(results, w, h) {
        const current = { left: null, right: null };
        
        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks, idx) => {
                const handedness = results.multiHandedness[idx];
                if (handedness.score < this.confidence) return;
                if (!this.isHandValid(landmarks)) return;

                const label = handedness.label === "Left" ? "right" : "left";
                const tip = landmarks[8];
                
                const rawX = (1 - tip.x) * w;
                const rawY = tip.y * h;

                if (this.data[label]) {
                    current[label] = {
                        x: MathUtils.lerp(this.data[label].x, rawX, this.smoothing),
                        y: MathUtils.lerp(this.data[label].y, rawY, this.smoothing)
                    };
                } else {
                    current[label] = { x: rawX, y: rawY };
                }
            });
        }
        
        this.prevData = JSON.parse(JSON.stringify(this.data));
        this.data = current;
    }
}
