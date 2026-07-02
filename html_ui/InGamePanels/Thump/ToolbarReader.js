(function() {
    function poll() {
        try {
            window.ThumpData = {
                tMs: Date.now(),
                onGround: SimVar.GetSimVarValue("SIM ON GROUND", "Bool") >= 0.5,
                altAglFt: SimVar.GetSimVarValue("PLANE ALT ABOVE GROUND", "Feet"),
                vsFpm: SimVar.GetSimVarValue("VERTICAL SPEED", "Feet per minute"),
                gForce: SimVar.GetSimVarValue("G FORCE", "GFORCE"),
                iasKt: SimVar.GetSimVarValue("AIRSPEED INDICATED", "Knots"),
                gsKt: SimVar.GetSimVarValue("GROUND VELOCITY", "Knots"),
            };
        } catch (e) {
            console.error("Thump Telemetry error:", e.message, e.stack);
        }
    }
    setInterval(poll, 50);
})();