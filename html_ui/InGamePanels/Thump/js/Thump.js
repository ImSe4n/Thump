//ThumpReader class
// Reads SimVars and calculates landing report data
// Emits events: "updateUi" (report, updateUiFlag), "bounce", "stopped"
class ThumpReader {
    constructor(storage) {
        this.storage = storage;
        this.eventListeners = {};

        this.params = [
            { name: "TITLE", unit: "string" },
            { name: "SIM ON GROUND", unit: "bool" },
            { name: "AIRCRAFT WIND X", unit: "knots" },
            { name: "AIRCRAFT WIND Z", unit: "knots" },
            { name: "AIRSPEED INDICATED", unit: "knots" },
            { name: "GROUND VELOCITY", unit: "knots" },
            { name: "VELOCITY BODY X", unit: "feet per second" },
            { name: "VELOCITY BODY Z", unit: "feet per second" },
            { name: "G FORCE", unit: "gforce" },
            { name: "PLANE TOUCHDOWN NORMAL VELOCITY", unit: "feet per second" },
            { name: "PLANE ALT ABOVE GROUND", unit: "feet" },
            { name: "SURFACE TYPE", unit: "enum" },
            { name: "VELOCITY BODY Y", unit: "feet per second" },
            { name: "PLANE BANK DEGREES", unit: "degrees" },
            { name: "PLANE TOUCHDOWN PITCH DEGREES", unit: "degrees" }
        ];

        this.inAir = [];
        this.onGround = [];
        this.showLanding = false;
        this.bounces = 0;
        this.updateUiFlag = true;
        this.lastLanding = null;

        this.BUFFER_SIZE = 5;
        this.SAMPLE_RATE = 20; // ms
        this.readTimer = null;
        this.stopped = false;
    }

    on(evt, cb) {
        if (!this.eventListeners[evt]) this.eventListeners[evt] = [];
        this.eventListeners[evt].push(cb);
    }

    trigger(evt, ...args) {
        if (this.eventListeners[evt]) {
            this.eventListeners[evt].forEach((cb) => cb(...args));
        }
    }

    startReading() {
        if (this.readTimer) return;
        this.initVars();
        this.readTimer = setInterval(() => this._tick(), this.SAMPLE_RATE);
    }

    stopReading() {
        if (!this.readTimer) return;
        this.stopped = true;
        clearInterval(this.readTimer);
        this.readTimer = null;
        this.trigger("stopped");
    }

    initVars() {
        this.inAir = [];
        this.onGround = [];
        this.showLanding = false;
        this.bounces = 0;
        this.updateUiFlag = true;
        this.lastLanding = null;
    }

    _tick() {
        const raw = this.params.map((p) => {
            let value;
            try {
                value = SimVar.GetSimVarValue(p.name, p.unit);
            } catch (e) {
                value = null;
            }
            return { name: p.name, unit: p.unit, value: value };
        });
        this._process(raw);
    }

    _process(raw) {
        const frame = {
            title: raw[0].value,
            onGround: raw[1].value,
            windX: raw[2].value,
            windZ: raw[3].value,
            airspeed: raw[4].value,
            groundVel: raw[5].value,
            velX: raw[6].value,
            velZ: raw[7].value,
            gforce: raw[8].value,
            fps: raw[9].value,
            altAgl: raw[10].value,
            surfaceType: raw[11].value,
            velY: raw[12].value,
            bank: raw[13].value,
            pitch: raw[14].value,
            timestamp: Date.now()
        };

        if (frame.altAgl === null || frame.altAgl === undefined) return;

        if (this.showLanding) {
            this._calculateLanding();
            this.bounces++;
            this.updateUiFlag = false;
            this.trigger("bounce");
            return;
        }

        // Ignore parked / menu / very-low-speed frames (GEES: <4kt forward speed)
        if (frame.groundVel < 4) return;

        if (frame.onGround) {
            this.onGround.push(frame);
            if (this.onGround.length > this.BUFFER_SIZE) {
                this.onGround.shift();
                if (this.inAir.length === this.BUFFER_SIZE) {
                    this.showLanding = true;
                }
            }
        } else {
            this.inAir.push(frame);
            if (this.inAir.length > this.BUFFER_SIZE) this.inAir.shift();
            this.onGround = [];
        }
    }

    _calculateLanding() {
        const gnd0 = this.onGround[0];
        const airLast = this.inAir[this.inAir.length - 1];

        const fpm = Math.round(-60 * gnd0.fps);

        const peakG = this.onGround.reduce(
            (max, f) => (f.gforce > max ? f.gforce : max), 0
        );

        const incAngleRad = Math.atan2(airLast.velX, airLast.velZ);
        const incAngleDeg = incAngleRad * 180 / Math.PI;
        const slipDirection = incAngleDeg > 0 ? "Right Sideslip" : "Left Sideslip";

        const report = {
            landingRate: fpm,
            gforce: peakG.toFixed(2),
            airspeed: airLast.airspeed,
            ground_vel: airLast.groundVel,
            wind_x: airLast.windX,
            wind_z: airLast.windZ,
            incAngle: Math.abs(incAngleDeg),
            slipDirection: slipDirection,
            title: airLast.title,
            bank: gnd0.bank,
            pitch: gnd0.pitch,
            timestamp: airLast.timestamp,
            bounces: this.bounces
        };

        this.inAir = [];
        this.onGround = [];
        this.showLanding = false;
        this.lastLanding = report;

        this.trigger("updateUi", report, this.updateUiFlag);
    }
}

// ThumpScripts class
// Loads Lua scripts from init.json or default.json, and executes them to get landing verdicts.
// If fengari is unavailable, falls back to a JS-only verdict calculation.
class ThumpScripts {
    constructor(storage) {
        this.storage = storage;
        this.luaScripts = "";
        this.luaReady = false;

        try {
            this.lua = fengari.lua;
            this.lualib = fengari.lualib;
            this.lauxlib = fengari.lauxlib;
            this.L = this.lualib.luaL_newstate();
            this.lualib.luaL_openlibs(this.L);
            this.lua.lua_pushjsfunction(this.L, this._jsonParseBridge.bind(this));
            this.lua.lua_setglobal(this.L, "jsonParse");
            this.luaReady = true;
        } catch (e) {
            console.log("Thump: fengari unavailable, using JS-only verdicts.", e);
        }
    }

    _jsonParseBridge(L) {
        const jsonStr = fengari.to_jsstring(this.lua.lua_tostring(L, -1));
        const obj = JSON.parse(jsonStr);
        this.lua.lua_newtable(L);
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                this.lua.lua_pushstring(L, fengari.to_luastring(key));
                this.lua.lua_pushstring(L, fengari.to_luastring(obj[key].toString()));
                this.lua.lua_settable(L, -3);
            }
        }
        return 1;
    }

    // Fetch ./init/init.json -> custom_analyser_url (falls back to
    // ./default_analyser/default.json, matching your lua.json format).
    fetchAndUpdateLuaScripts() {
        fetch("./init/init.json")
            .then((r) => r.json())
            .then((init) => {
                const url = init.custom_analyser_url || "./default_analyser/default.json";
                this._loadScriptsFrom(url, init.news_url, init.version);
            })
            .catch((err) => console.log("Thump: failed to load init.json", err));
    }

    _loadScriptsFrom(url, newsUrl, version) {
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                this.storage.set("luaScripts", data.lua);
                this.luaScripts = data.lua;
                console.log("Thump: Lua scripts loaded from " + url);
            })
            .catch(() => {
                fetch("./default_analyser/default.json")
                    .then((r) => r.json())
                    .then((data) => {
                        this.storage.set("luaScripts", data.lua);
                        this.luaScripts = data.lua;
                        console.log("Thump: default Lua scripts loaded.");
                    })
                    .catch((err) => console.log("Thump: failed to load default Lua script", err));
            });

        if (newsUrl) this.checkNews(newsUrl, version);
    }

    checkNews(url, currentVersion) {
        fetch(url)
            .then((r) => r.json())
            .then((news) => {
                const shown = this.storage.get("shownNews") || [];
                if (shown.includes(news.guid)) return;

                let content = news.content;
                if (news.latestversion && news.latestversion !== currentVersion) {
                    content =
                        "<p><strong>Update Available</strong></p><p>Latest Version: " +
                        news.latestversion + "</p><br/><br/><br/>" + news.content;
                }
                this._showNewsPopup(news.guid, content);
            })
            .catch((err) => console.log("Thump: error fetching news", err));
    }

    _showNewsPopup(guid, content) {
        try {
            const popup = new PopUp.NotiticationParams();
            popup.title = "News";
            popup.description = content;
            popup.contentData = popup.title;
            const okBtn = new NotificationButton("TT:MENU.OK", "THUMP_CLOSE_NEWS");
            popup.buttons.push(okBtn);
            const neverBtn = new NotificationButton("Don't Show Again", "THUMP_NEVER_SHOW_NEWS_" + guid);
            popup.buttons.push(neverBtn);
            popup.style = "normal";
            popup.displayGlobalPopup = true;
            PopUp.showPopUp(popup);
            Coherent.on("THUMP_CLOSE_NEWS", () => { });
            Coherent.on("THUMP_NEVER_SHOW_NEWS_" + guid, () => {
                const shown = this.storage.get("shownNews") || [];
                shown.push(guid);
                this.storage.set("shownNews", shown);
            });
        } catch (e) {
            console.log("Thump: could not show news popup", e);
        }
    }

    // Calls the currently loaded Lua script's processParameters(basic, additional)
    // exactly like lua.json expects, and returns {title, content}.
    getVerdict(report) {
        if (!this.luaReady) return this._jsVerdict(report);

        this.luaScripts = this.luaScripts || this.storage.get("luaScripts") || "";
        if (!this.luaScripts) return this._jsVerdict(report);

        try {
            if (this.lauxlib.luaL_loadstring(this.L, fengari.to_luastring(this.luaScripts)) ||
                this.lua.lua_pcall(this.L, 0, this.lua.LUA_MULTRET, 0)) {
                throw new Error(fengari.to_jsstring(this.lua.lua_tostring(this.L, -1)));
            }

            // basicParams: the fields lua.json's processParameters expects
            // (landingRate + title at minimum). additionalParams: filled
            // in from requestParameters() if present; we pass an empty
            // object here since Thump doesn't currently read extra vars.
            this.lua.lua_getglobal(this.L, "processParameters");
            this.lua.lua_pushstring(this.L, fengari.to_luastring(JSON.stringify(report)));
            this.lua.lua_pushstring(this.L, fengari.to_luastring(JSON.stringify({})));
            if (this.lua.lua_pcall(this.L, 2, 1, 0)) {
                throw new Error(fengari.to_jsstring(this.lua.lua_tostring(this.L, -1)));
            }
            const resultStr = fengari.to_jsstring(this.lua.lua_tojsstring(this.L, -1));
            this.lua.lua_pop(this.L, 1);
            return JSON.parse(resultStr);
        } catch (e) {
            console.log("Thump: Lua verdict failed, using JS fallback.", e);
            return this._jsVerdict(report);
        }
    }

    _jsVerdict(report) {
        const fpm = Math.abs(report.landingRate);
        let title;
        if (fpm <= 100) title = "Smooth Landing";
        else if (fpm <= 350) title = "Standard Landing";
        else if (fpm <= 600) title = "Firm Landing";
        else title = "Hard Landing";
        return { title: title, content: "" };
    }
}