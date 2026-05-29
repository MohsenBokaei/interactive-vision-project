class HandProcessor {
    constructor() {
        this.hands = { left: null, right: null };
        this.prevHands = { left: null, right: null };
        
        // Stillness Tracking
        this.anchorPoint = { left: null, right: null };
        this.stillnessStartTime = { left: 0, right: 0 };
        this.isStill = { left: false, right: false };
        this.stillnessFactor = { left: 0, right: 0 }; // 0 to 1
        
        this.wobbleThreshold = 30; // Max pixels allowed to move to count as "still"
    }

    update(res, w, h) {
        let detected = { left: false, right: false };

        if (res.multiHandLandmarks) {
            res.multiHandLandmarks.forEach((lm, i) => {
                const handedness = res.multiHandedness[i];
                const label = handedness.label === "Left" ? "right" : "left";
                const pos = { x: (1 - lm[8].x) * w, y: lm[8].y * h };

                // Handle Stillness Logic
                if (!this.anchorPoint[label]) {
                    this.anchorPoint[label] = pos;
                    this.stillnessStartTime[label] = Date.now();
                }

                let distFromAnchor = Math.sqrt(
                    Math.pow(pos.x - this.anchorPoint[label].x, 2) + 
                    Math.pow(pos.y - this.anchorPoint[label].y, 2)
                );

                if (distFromAnchor > this.wobbleThreshold) {
                    // Hand moved! Reset the 3-second timer
                    this.anchorPoint[label] = pos;
                    this.stillnessStartTime[label] = Date.now();
                    this.isStill[label] = false;
                    this.stillnessFactor[label] = 0;
                } else {
                    // Hand is holding still. Check time.
                    let duration = Date.now() - this.stillnessStartTime[label];
                    if (duration > 3000) { // 3 Second Threshold
                        this.isStill[label] = true;
                        // Gradually increase intensity after 3 seconds
                        this.stillnessFactor[label] = Math.min(1.0, (duration - 3000) / 2000); 
                    }
                }

                if (this.hands[label]) {
                    this.prevHands[label] = { ...this.hands[label] };
                    this.hands[label].x += (pos.x - this.hands[label].x) * 0.2;
                    this.hands[label].y += (pos.y - this.hands[label].y) * 0.2;
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
