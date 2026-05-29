class HandProcessor {
    constructor() {
        this.hands = { left: null, right: null };
        this.prevHands = { left: null, right: null };
        this.anchorPoint = { left: null, right: null };
        this.stillnessStartTime = { left: 0, right: 0 };
        this.isStill = { left: false, right: false };
        this.stillnessFactor = { left: 0, right: 0 }; 
        this.wobbleThreshold = 35; // Pixels
    }

    update(res, w, h) {
        let detected = { left: false, right: false };
        if (res.multiHandLandmarks) {
            res.multiHandLandmarks.forEach((lm, i) => {
                const handedness = res.multiHandedness[i];
                if (handedness.score < 0.9) return;
                
                const label = handedness.label === "Left" ? "right" : "left";
                const pos = { x: (1 - lm[8].x) * w, y: lm[8].y * h };

                // Stillness Logic
                if (!this.anchorPoint[label]) {
                    this.anchorPoint[label] = pos;
                    this.stillnessStartTime[label] = Date.now();
                }

                let distFromAnchor = Math.sqrt(
                    Math.pow(pos.x - this.anchorPoint[label].x, 2) + 
                    Math.pow(pos.y - this.anchorPoint[label].y, 2)
                );

                if (distFromAnchor > this.wobbleThreshold) {
                    this.anchorPoint[label] = pos;
                    this.stillnessStartTime[label] = Date.now();
                    this.isStill[label] = false;
                    this.stillnessFactor[label] = 0;
                } else {
                    let duration = Date.now() - this.stillnessStartTime[label];
                    if (duration > 3000) { 
                        this.isStill[label] = true;
                        this.stillnessFactor[label] = Math.min(1.0, (duration - 3000) / 2000); 
                    }
                }

                if (this.hands[label]) {
                    this.prevHands[label] = { ...this.hands[label] };
                    this.hands[label].x += (pos.x - this.hands[label].x) * 0.25;
                    this.hands[label].y += (pos.y - this.hands[label].y) * 0.25;
                } else {
                    this.hands[label] = pos;
                }
                detected[label] = true;
            });
        }
        ['left', 'right'].forEach(side => {
            if (!detected[side]) {
                this.hands[side] = null;
                this.stillnessFactor[side] = 0;
            }
        });
    }
}
