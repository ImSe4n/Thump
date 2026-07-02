// Telemetry.js
//this file is used to read the raw simvars for one tick into an object
//it is loaded before analyzer.js and thump.js so it exposes everything on the shared window.Thump namespace

window.Thump = window.Thump || {};

window.Thump.Telemetry = {
    readFrame() {
        const data = window.ThumpData;
        if (!data) return null;
        if (data.altAglFt === undefined || data.altAglFt === null || Number.isNaN(data.altAglFt)) return null;
        return data;
    }
};