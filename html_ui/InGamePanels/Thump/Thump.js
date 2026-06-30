class IngamePanelThump extends HTMLElement {
    constructor() {
        super();
        this._timer = null;
        this._ready = false;
        this._lastTickMs = null;
        this._lastReport = null;

        this._analyzer = new window.Thump.LandingAnalyzer();
    }

    //use to catch the exact touchdown frame of the aircraft
    connectedCallback() {
        this._timer = setInterval(() => this._tick(), 50);
    }

    disconnectedCallback() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    _tick() {
        const frame = window.Thump.Telemetry.readFrame();
        if (!frame) return;

        if (!this._ready) {
            this._ready = true;
            this._setStatus("Live");
        }

        this.renderLiveVs(frame.vsFpm);

        const dt = this._lastTickMs ? (frame.tMs - this._lastTickMs) / 1000 : 0.05;
        this._lastTickMs = frame.tMs;

        const prevState = this._analyzer.currentState;
        const report = this._analyzer.update(frame, dt);

        if (prevState === "Airborne" && this._analyzer.currentState === "Landing") {
            this._setStatus("Touchdown...");
        }

        if (report) {
            this._lastReport = report;
            this._renderReport(report);
            this._setStatus("Live");
        }
    }

    _setStatus(text) {
        const el = document.getElementById("thump-status");
        if (el) el.textContent = text;
    }

    _renderLiveVs(vsFpm) {
        const el = document.getElementById("thump-vs");
        if (el) el.textContent = Math.round(vsFpm);
    }

    _renderReport(report) {
        const label = document.getElementById("thump-label");
        if (label) {
            label.textContent = 
            `Last Landing: ${report.landingRateFpm} fpm | ` + `${report.peakG}g | ${report.bounces} bounce(s)`;
        }
    }
}

window.customElements.define("ingamepanel-thump", IngamePanelThump);

checkAutoload();