//Analyzer.js
//thie file is the touchdown detection state machine
//works by feeding one frame at a time and returns a report object the instant a landing finishes
//otherwise, null

window.Thump = window.Thump || {};

window.Thump.LandingAnalyzer = class LandingAnalyzer {
    constructor(opts = {}) {
        this.ARM_ALTITUDE_FT = opts.armAltitudeFt ?? 50;
        this.BOUNCE_ALT_FT = opts.bounceAltFt ?? 1;
        this.ROLLOUT_SETTLE_S = opts.rolloutSettleS ?? 3;
        this.ROLLOUT_SPEED_KT = opts.rolloutSpeedKt ?? 35;
        this.G_WINDOW_S = opts.gWindowS ?? 2;

        this._reset();
    }

    _reset() {
        this._state = "Airborne";
        this._armed = false;
        this._maxAlt = 0;

        this._touch = null;
        this._peakG = 1;
        this._bounces = 0;
        this._impactTimeMs = 0;
        this._settleTimeS = 0;
    }

    update(frame, dt) {
        this._maxAlt = Math.max(this._maxAlt, frame.altAglFt);
        if (this._maxAlt > this.ARM_ALTITUDE_FT) this._armed = true;

        if (this._state === "Airborne") {
            this._maybeTouchdown(frame);
            return null;
        }
        if (this._state === "Landing") {
            return this._trackLanding(frame, dt);
        }
        if (this._state === "Bouncing") {
            this._trackBounce(frame);
            return null;
        }
        return null;
    }

    get currentState() {
        return this._state;
    }

    _maybeTouchdown(frame) {
        if (!(this._armed && frame.onGround)) return;

        this._touch = frame;
        this._impactTimeMs = frame.tMs;
        this._peakG = frame.gForce;
        this._bounces = 0;
        this._settleTimeS = 0;
        this._state = "Landing";
    }

    _trackLanding(frame, dt) {
        if ((frame.tMs - this._impactTimeMs) / 1000 <= this.G_WINDOW_S) {
            this._peakG = Math.max(this._peakG, frame.gForce);
        }

        if (!frame.onGround && frame.altAglFt > this.BOUNCE_ALT_FT) {
            this._state = "Bouncing";
            return null;
        }

        if (frame.onGround && frame.gsKt < this.ROLLOUT_SPEED_KT) {
            this._settleTimeS += dt;
        } else {
            this._settleTimeS = 0;
        }

        if (this._settleTimeS >= this.ROLLOUT_SETTLE_S) {
            return this._finalize();
        }
        return null;
    }

    _trackBounce(frame) {
        this._peakG = Math.max(this._peakG, frame.gForce);
        if (frame.onGround) {
            this._bounces++;
            this._impactTimeMs = frame.tMs;
            this._state = "Landing";
        }
    }

    _finalize() {
        const touch = this._touch;
        const report = {
            landingRateFpm: Math.round(touch.vsFpm),
            peakG: Math.round(this._peakG * 100) / 100,
            iasKt: Math.round(touch.iasKt),
            gsKt: Math.round(touch.gsKt),
            bounces: this._bounces,
        };

        this._state = "Airborne";
        this._armed = false;
        this._maxAlt = 0;
        this._touch = null;

        return report;
    }

};