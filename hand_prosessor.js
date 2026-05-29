class HandProcessor {
    constructor() {
        this.hands = { left: null, right: null };
        this.rawLandmarks = { left: [], right: [] };
        this.anchor = { left: null, right: null };
        this.stillStartTime = { left: 0, right: 0 };
        this.stillFactor = { left: 0, right: 0 }; 
        this.wobbleLimit = 35; // Better tolerance for human hands
        this.revealDelay = 3000; 
    }

    update(res, w, h) {
        let detected = { left: false, right: false };
        if (res.multiHandLandmarks) {
            res.multiHandLandmarks.forEach((lm, i) => {
                const handedness = res.multiHandedness[i];
                if (handedness.score < 0.9) return;
                
                const label = handedness.label === "Left" ? "right" : "left";
                const tip = lm[8];
                const pos = { x: (1 - tip.x) * w, y: tip.y * h };

                this.rawLandmarks[label] = lm.map(p => ({
                    x: (1 - p.x) * w,
                    y: p.y * h,
                    z: p.z * w
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
                        this.stillFactor[label] = Math.min(1.0, (elapsed - this.revealDelay) / 2000);
                    }
                }

                if (!this.hands[label]) this.hands[label] = pos;
                else {
                    this.hands[label].x += (pos.x - this.hands[label].x) * 0.3;
                    this.hands[label].y += (pos.y - this.hands[label].y) * 0.3;
                }
                detected[label] = true;
            });
        }
        ['left', 'right'].forEach(s => {
            if (!detected[s]) {
                this.hands[s] = null;
                this.anchor[s] = null;
                this.stillFactor[s] = 0;
                this.rawLandmarks[s] = [];
            }
        });
    }
}
