class IngamePanelThump extends HTMLElement {
    constructor() {
        super();
        this._timer = null;
        this._ready = false;
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
        let verticalSpeed;
        try {
            verticalSpeed = SimVar.GetSimVarValue("VERTICAL SPEED", "Feet per minute");
        } catch (e) {
            return;
        }

        if (verticalSpeed == undefined || verticalSpeed == null || Number.isNaN(verticalSpeed)) {
            return;
        }

        if (!this._ready) {
            this._ready = true;
            const thumpStatus = document.getElementById("thump-status");
            if (thumpStatus) {
                thumpStatus.textContent = "Live";
            }
        }

        const thumpVerticalSpeed = document.getElementById("thump-vs");
        if (thumpVerticalSpeed) {
            thumpVerticalSpeed.textContent = Math.round(verticalSpeed);
        }
    }
}

window.customElements.define("ingamepanel-thump", IngamePanelThump);

checkAutoload();