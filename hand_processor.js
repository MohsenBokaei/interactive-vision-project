class HandProcessor {
    constructor() {
        this.hands = { left: null, right: null };
        this.rawLandmarks = { left: [], right: [] }; // All 21 joints
        this.anchor = { left: null, right: null };
        this.stillStartTime = { left: 0, right: 0 };
        this.stillFactor = { left: 0, right: 0 }; 
        this.wobbleLimit = 22; 
        this.revealDelay = 3000; 
    }

    update(res, w, h) {
        let detected = { left: false, right: false };
        if (res.multiHandLandmarks) {
            res.multiHandLandmarks.forEach((lm, i) => {
                const handedness = res.multiHandedness[i];
                if (handedness.score < 0.94) return;
                
                const label = handedness.label === "Left" ? "right" : "left";
                const tip = lm[8]; // Index tip for positioning
                const pos = { x: (1 - tip.x) * w, y: tip.y * h };

                // Store all 21 joints for the "Wiry" look
                this.rawLandmarks[label] = lm.map(p => ({
                    x: (1 - p.x) * w,
                    y: p.y * h,
                    z: p.z * w // Z-depth for 3D fibers
                }));

                if (!this.anchor[label]) {
                    this.anchor[label] = pos;
                    this.stillStartTime[label] = Date.now();
                }

                let d = Math.sqrt(Math.pow(pos.x - this.anchor[label].x, 2) + Math.pow(pos.y - this.anchor[label].y, 2));

                if (d > this.wobbleLimit) {
                    this.anchor[label] = pos;
                    this.stillStartTime[label] = Date.now();
                    this.stillFactor[label] = 0;
                } else {
                    let elapsed = Date.now() - this.stillStartTime[label];
                    if (elapsed > this.revealDelay) {
                        this.stillFactor[label] = Math.min(1.0, (elapsed - this.revealDelay) / 2500);
                    }
                }

                if (!this.hands[label]) this.hands[label] = pos;
                else {
                    this.hands[label].x += (pos.x - this.hands[label].x) * 0.35;
                    this.hands[label].y += (pos.y - this.hands[label].y) * 0.35;
                }
                detected[label] = true;
            });
        }
        ['left', 'right'].forEach(s => {
            if (!detected[s]) {
                this.hands[s] = null;
                this.stillFactor[s] = 0;
                this.rawLandmarks[s] = [];
            }
        });
    }
}
