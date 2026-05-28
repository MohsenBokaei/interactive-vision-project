class HandProcessor {
    constructor() {
        this.hands = { left: null, right: null };
        this.prevHands = { left: null, right: null };
        this.lostCounter = { left: 0, right: 0 };
        this.maxLostFrames = 30; // Hand "Memory" to stop flickering
    }

    isAnatomicallyCorrect(landmarks) {
        const wrist = landmarks[0];
        const mcpMiddle = landmarks[9];
        const tipIndex = landmarks[8];
        const tipPinky = landmarks[20];

        // 1. Size Check: Heads are 3-4x larger than hands relative to distance
        const handScale = Math.sqrt(Math.pow(wrist.x - mcpMiddle.x, 2) + Math.pow(wrist.y - mcpMiddle.y, 2));
        if (handScale > 0.35 || handScale < 0.05) return false;

        // 2. Aspect Ratio Check: Hand is long, heads are round
        const handBreadth = Math.sqrt(Math.pow(tipIndex.x - tipPinky.x, 2) + Math.pow(tipIndex.y - tipPinky.y, 2));
        const ratio = handScale / handBreadth;
        return (ratio > 0.5 && ratio < 3.0);
    }

    update(res, w, h) {
        let detected = { left: false, right: false };

        if (res.multiHandLandmarks) {
            res.multiHandLandmarks.forEach((lm, i) => {
                const handedness = res.multiHandedness[i];
                if (handedness.score < 0.92) return;
                if (!this.isAnatomicallyCorrect(lm)) return;

                const label = handedness.label === "Left" ? "right" : "left";
                const pos = { x: (1 - lm[8].x) * w, y: lm[8].y * h };

                if (this.hands[label]) {
                    this.prevHands[label] = { ...this.hands[label] };
                    // Smooth Interpolation
                    this.hands[label].x += (pos.x - this.hands[label].x) * 0.35;
                    this.hands[label].y += (pos.y - this.hands[label].y) * 0.35;
                } else {
                    this.hands[label] = pos;
                    this.prevHands[label] = pos;
                }
                this.lostCounter[label] = this.maxLostFrames;
                detected[label] = true;
            });
        }

        ['left', 'right'].forEach(side => {
            if (!detected[side]) {
                this.lostCounter[side]--;
                if (this.lostCounter[side] <= 0) {
                    this.hands[side] = null;
                    this.prevHands[side] = null;
                }
            }
        });
    }
}
