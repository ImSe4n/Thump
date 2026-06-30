// Telemetry.js
//this file is used to read the raw simvars for one tick into an object
//it is loaded before analyzer.js and thump.js so it exposes everything on the shared window.Thump namespace

window.Thump = window.Thump || {};

window.Thump.Telemetry = {
    readFrame() {
        try {
            const simFrame = {
                tMs: Date.now(),
                onGround: SimVar.GetSimVarValue("SIM ON GROUND", "Bool") > 0.5,
                altAglFt: SimVar.GetSimVarValue("PLANE ALT ABOVE GROUND", "Feet"),
                vsFpm: SimVar.GetSimVarValue("VERTICAL SPEED", "Feet per minute"),
                gForce: SimVar.GetSimVarValue("G FORCE", "GFORCE"),
                iasKt: SimVar.GetSimVarValue("AIRSPEED INDICATED", "Knots"),
                gsKt: SimVar.GetSimVarValue("GROUND VELOCITY", "Knots"),
            };
            if (simFrame.altAglFt == undefined || simFrame.altAglFt == null || Number.isNaN(simFrame.altAglFt)) {
                return null;
            }
            return simFrame;
        } catch (e) {
            //simvar layer not initialized yet, just return null and wait for the next tick
            return null;
        }
    }
}