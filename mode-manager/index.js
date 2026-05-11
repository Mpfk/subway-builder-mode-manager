// Mode Manager - All-in-one transit mode selector for Subway Builder
(function () {
    'use strict';

    const api = window.SubwayBuilderAPI;
    if (!api) {
        console.error('[Mode Manager] SubwayBuilderAPI not found!');
        return;
    }

    // Prevent double-initialization when the game evaluates the mod script more
    // than once per page load. Each IIFE execution has its own closure, so a
    // closure-level flag is not sufficient — window persists across all of them.
    if (window.__modeManagerLoaded) {
        console.warn('[Mode Manager] Already initialized — skipping duplicate execution.');
        return;
    }
    window.__modeManagerLoaded = true;

    // Schema version. Bump this in lockstep with manifest.json whenever a
    // change to the on-disk storage layout requires a migration. Cheap
    // dependency-free migrations run inline below; ones that need BUILTINS
    // or the registry run later via runSchemaMigrations().
    var MOD_VERSION = '1.0.9';

    function isVersionBefore(a, b) {
        // Returns true when semver string `a` is older than `b`. Null/empty
        // counts as "older than anything" so first-time migrations fire.
        if (!a) return true;
        var pa = String(a).split('.').map(Number);
        var pb = String(b).split('.').map(Number);
        for (var i = 0; i < 3; i++) {
            if (pa[i] !== pb[i]) return pa[i] < pb[i];
        }
        return false;
    }
    var INSTALLED_VERSION_KEY = 'mode-manager:installed-version';
    var installedVersionAtLoad = null;
    try {
        installedVersionAtLoad = localStorage.getItem(INSTALLED_VERSION_KEY);
        if (installedVersionAtLoad !== MOD_VERSION) {
            // Pre-1.0.1 stored committed modes under a single global key,
            // which leaked the list into every new game. 1.0.1+ keys per
            // save. Safe to run on a fresh install: the legacy key simply
            // won't exist.
            localStorage.removeItem('mode-manager:modes-committed');
        }
    } catch (e) {}

    console.log('[Mode Manager] Loaded!');

    // ─── BUILTINS ────────────────────────────────────────────────────────────────

    const BUILTINS = [
        {
            id: 'tram',
            name: 'Tram',
            description: 'Lightweight tram for short-distance urban transit',
            schemaVersion: '1.0.0',
            revision: 1,
            stats: {
                maxAcceleration: 1.1,
                maxDeceleration: 1.2,
                maxSpeed: 15,
                maxSpeedLocalStation: 8,
                capacityPerCar: 60,
                carLength: 20,
                minCars: 1,
                maxCars: 3,
                carsPerCarSet: 1,
                carCost: 800000,
                trainWidth: 2.4,
                minStationLength: 20,
                maxStationLength: 60,
                baseTrackCost: 10000,
                baseStationCost: 5000000,
                trainOperationalCostPerHour: 100,
                carOperationalCostPerHour: 20,
                scissorsCrossoverCost: 2000000,
                stopTimeSeconds: 20,
                maxLateralAcceleration: 1.5,
                parallelTrackSpacing: 3,
                trackClearance: 2,
                minTurnRadius: 5,
                minStationTurnRadius: 15,
                maxSlopePercentage: 6,
                trackMaintenanceCostPerMeter: 200,
                stationMaintenanceCostPerYear: 10000
            },
            compatibleTrackTypes: ['tram'],
            appearance: { color: '#f59e0b' },
            allowAtGradeRoadCrossing: true,
            elevationMultipliers: { AT_GRADE: 1, ELEVATED: 4, CUT_AND_COVER: 6 },
            tags: []
        },
        {
            id: 'brt',
            name: 'Bus Rapid Transit',
            description: 'High-capacity bus for dedicated rapid transit corridors',
            schemaVersion: '1.0.0',
            revision: 1,
            stats: {
                maxAcceleration: 1.3,
                maxDeceleration: 1.4,
                maxSpeed: 25,
                maxSpeedLocalStation: 8,
                capacityPerCar: 80,
                carLength: 30,
                minCars: 1,
                maxCars: 1,
                carsPerCarSet: 1,
                carCost: 350000,
                trainWidth: 2.6,
                minStationLength: 30,
                maxStationLength: 30,
                baseTrackCost: 5000,
                baseStationCost: 2000000,
                trainOperationalCostPerHour: 60,
                carOperationalCostPerHour: 60,
                scissorsCrossoverCost: 500000,
                stopTimeSeconds: 20,
                maxLateralAcceleration: 1.5,
                parallelTrackSpacing: 3,
                trackClearance: 2,
                minTurnRadius: 8,
                minStationTurnRadius: 20,
                maxSlopePercentage: 8,
                trackMaintenanceCostPerMeter: 100,
                stationMaintenanceCostPerYear: 5000
            },
            compatibleTrackTypes: ['brt'],
            appearance: { color: '#ef4444' },
            allowAtGradeRoadCrossing: true,
            elevationMultipliers: { AT_GRADE: 1, ELEVATED: 8, CUT_AND_COVER: 12 },
            tags: ['bus']
        },
        {
            id: 'monorail',
            name: 'Monorail',
            description: 'Elevated monorail for scenic urban and resort transit',
            schemaVersion: '1.0.0',
            revision: 1,
            stats: {
                maxAcceleration: 1.0,
                maxDeceleration: 1.1,
                maxSpeed: 30,
                maxSpeedLocalStation: 6,
                capacityPerCar: 30,
                carLength: 10,
                minCars: 4,
                maxCars: 6,
                carsPerCarSet: 2,
                carCost: 600000,
                trainWidth: 2.2,
                minStationLength: 40,
                maxStationLength: 60,
                baseTrackCost: 20000,
                baseStationCost: 8000000,
                trainOperationalCostPerHour: 80,
                carOperationalCostPerHour: 15,
                scissorsCrossoverCost: 3000000,
                stopTimeSeconds: 12,
                maxLateralAcceleration: 2,
                parallelTrackSpacing: 4,
                trackClearance: 2,
                minTurnRadius: 15,
                minStationTurnRadius: 25,
                maxSlopePercentage: 5,
                trackMaintenanceCostPerMeter: 500,
                stationMaintenanceCostPerYear: 30000
            },
            compatibleTrackTypes: ['monorail'],
            appearance: { color: '#8b5cf6' },
            allowAtGradeRoadCrossing: false,
            elevationMultipliers: { AT_GRADE: 1, ELEVATED: 4, CUT_AND_COVER: 8 },
            tags: []
        },
        {
            id: 'people-mover',
            name: 'People Mover',
            description: 'Automated people mover for short-distance elevated transit',
            schemaVersion: '1.0.0',
            revision: 1,
            stats: {
                maxAcceleration: 0.9,
                maxDeceleration: 1.0,
                maxSpeed: 12,
                maxSpeedLocalStation: 5,
                capacityPerCar: 40,
                carLength: 12,
                minCars: 2,
                maxCars: 6,
                carsPerCarSet: 2,
                carCost: 500000,
                trainWidth: 2.2,
                minStationLength: 24,
                maxStationLength: 72,
                baseTrackCost: 12000,
                baseStationCost: 4000000,
                trainOperationalCostPerHour: 25,
                carOperationalCostPerHour: 5,
                scissorsCrossoverCost: 1500000,
                stopTimeSeconds: 8,
                maxLateralAcceleration: 2,
                parallelTrackSpacing: 3,
                trackClearance: 2,
                minTurnRadius: 10,
                minStationTurnRadius: 12,
                maxSlopePercentage: 8,
                trackMaintenanceCostPerMeter: 300,
                stationMaintenanceCostPerYear: 15000
            },
            compatibleTrackTypes: ['people-mover'],
            appearance: { color: '#3b82f6' },
            allowAtGradeRoadCrossing: false,
            elevationMultipliers: { AT_GRADE: 1, ELEVATED: 3, CUT_AND_COVER: 5 },
            tags: []
        }
    ];

    // Defaults for stats the host docs don't list but the engine uses for
    // parallel/quad track preview generation, curve fitting, and cost
    // calculations. Without these, parallel mode crashes with "coordinates
    // must contain numbers" because the engine receives undefined as a
    // distance-offset argument. These get merged UNDER any user-provided
    // stats so existing values always win.
    var STAT_DEFAULTS = {
        stopTimeSeconds: 15,
        maxLateralAcceleration: 1.5,
        parallelTrackSpacing: 3,
        trackClearance: 2,
        minTurnRadius: 5,
        minStationTurnRadius: 15,
        maxSlopePercentage: 6,
        trackMaintenanceCostPerMeter: 200,
        stationMaintenanceCostPerYear: 10000
    };

    function withStatDefaults(def) {
        // Merges STAT_DEFAULTS under def.stats so the engine always receives
        // a complete config. Returns a deep copy — never mutates the input.
        // Applied at snapshot time (commit / self-heal) so the snapshot is
        // self-contained, and at registration as a defensive safety net for
        // legacy snapshots written before this version.
        var copy = cloneDefinition(def);
        copy.stats = Object.assign({}, STAT_DEFAULTS, copy.stats || {});
        return copy;
    }

    // Mode-definition schema version. Independent of MOD_VERSION; bumps only
    // when the mode JSON shape changes (e.g. a new required stat, a renamed
    // field). The major component gates import compatibility.
    var SCHEMA_VERSION = '1.0.0';
    var SCHEMA_MAJOR = parseInt(SCHEMA_VERSION.split('.')[0], 10);

    const REQUIRED_STATS = [
        'maxAcceleration', 'maxDeceleration', 'maxSpeed', 'maxSpeedLocalStation',
        'capacityPerCar', 'carLength', 'minCars', 'maxCars', 'carsPerCarSet',
        'carCost', 'trainWidth', 'minStationLength', 'maxStationLength',
        'baseTrackCost', 'baseStationCost',
        'trainOperationalCostPerHour', 'carOperationalCostPerHour',
        'scissorsCrossoverCost'
    ];

    // ─── STORAGE ─────────────────────────────────────────────────────────────────
    // api.storage is context-bound and only works during onGameInit callbacks.
    // React event handlers fire outside that context, so ui-triggered writes are
    // silently dropped. localStorage works from any execution context and is the
    // correct persistence layer for Electron-based mods.

    var storage = (function () {
        var PREFIX = 'mode-manager:';

        function get(key, defaultValue) {
            try {
                var raw = localStorage.getItem(PREFIX + key);
                if (raw === null) return Promise.resolve(defaultValue !== undefined ? defaultValue : null);
                return Promise.resolve(JSON.parse(raw));
            } catch (e) {
                console.warn('[Mode Manager] storage.get failed for "' + key + '":', e);
                return Promise.resolve(defaultValue !== undefined ? defaultValue : null);
            }
        }

        function set(key, value) {
            try {
                localStorage.setItem(PREFIX + key, JSON.stringify(value));
            } catch (e) {
                console.warn('[Mode Manager] storage.set failed for "' + key + '":', e);
            }
            return Promise.resolve();
        }

        function del(key) {
            try { localStorage.removeItem(PREFIX + key); } catch (e) {}
            return Promise.resolve();
        }

        function keys() {
            try {
                var result = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(PREFIX) === 0) result.push(k.slice(PREFIX.length));
                }
                return Promise.resolve(result);
            } catch (e) {
                return Promise.resolve([]);
            }
        }

        return { get: get, set: set, delete: del, keys: keys };
    })();

    // ─── REGISTRY ────────────────────────────────────────────────────────────────
    // Storage keys (all under mode-manager: prefix in localStorage):
    //   modes-imported          → ModeDefinition[]      the user's library. Built-ins
    //                                                   are seeded into this list on
    //                                                   first install via the 1.0.4
    //                                                   migration; after that, every
    //                                                   library entry is treated the
    //                                                   same regardless of origin.
    //   committed:<saveName>    → CommittedEntry[]      modes added to a specific save
    //   committed:__unsaved__   → CommittedEntry[]      modes added in a brand-new game
    //                                                   before its first save; lazily
    //                                                   migrated into committed:<name>
    //                                                   when a save name first appears
    //   installed-version       → string                last MOD_VERSION run on this
    //                                                   machine; drives schema migrations
    //   pending-notification    → { msg, type }         transient toast queued by an
    //                                                   action that triggers a hot
    //                                                   reload; consumed once on the
    //                                                   next onGameInit
    //   reload-in-flight        → string (timestamp)    transient marker set by
    //                                                   reloadMod() so the next
    //                                                   onGameInit can distinguish
    //                                                   self-triggered hot reloads
    //                                                   (skip the __unsaved__ clear)
    //                                                   from genuine session starts
    //
    // CommittedEntry = { id, locked, definition }
    //   .definition is a snapshot of the library entry captured at commit
    //   time. Snapshots are how we promise save stability: future library
    //   edits don't change what an existing save plays with.
    //
    // BUILTINS-in-code is the seed source for first install and the
    // "Available defaults" restore list. It is NOT part of the runtime
    // library composition — getLibrary reads only modes-imported.

    var UNSAVED_KEY = 'committed:__unsaved__';

    function cloneDefinition(def) {
        // JSON round-trip is sufficient: mode definitions are pure data.
        return JSON.parse(JSON.stringify(def));
    }

    function currentBucketKey() {
        var name = null;
        try {
            if (api.gameState && typeof api.gameState.getSaveName === 'function') {
                name = api.gameState.getSaveName();
            }
        } catch (e) { name = null; }
        return name ? 'committed:' + name : UNSAVED_KEY;
    }

    var registry = {
        getLibrary: function () {
            return storage.get('modes-imported', []).then(function (imported) {
                return Array.isArray(imported) ? imported : [];
            });
        },

        addMode: function (def) {
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported : [];
                list.push(cloneDefinition(def));
                return storage.set('modes-imported', list);
            });
        },

        removeMode: function (id) {
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported : [];
                var next = list.filter(function (m) { return m.id !== id; });
                if (next.length === 0) return storage.delete('modes-imported');
                return storage.set('modes-imported', next);
            });
        },

        updateMode: function (def) {
            // Replace the library entry with the same id. The id itself is
            // immutable from the editor (id changes would orphan committed
            // snapshots that reference the old id by name), so callers only
            // ever change other fields. Snapshot-at-commit means existing
            // saves keep playing their pinned definition; only future
            // commits see the edit.
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported : [];
                var idx = list.findIndex(function (m) { return m.id === def.id; });
                if (idx === -1) return Promise.reject(new Error('Mode "' + def.id + '" is not in the library'));
                var next = list.slice();
                next[idx] = cloneDefinition(def);
                return storage.set('modes-imported', next);
            });
        },

        // Add any built-in defaults whose ids are missing from the current
        // library. Existing entries with the same id are preserved — restore
        // is opt-in per mode and never overwrites user data.
        restoreDefaults: function (ids) {
            var wanted = Array.isArray(ids) ? ids : BUILTINS.map(function (b) { return b.id; });
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported.slice() : [];
                var have = {};
                list.forEach(function (m) { have[m.id] = true; });
                BUILTINS.forEach(function (b) {
                    if (wanted.indexOf(b.id) === -1) return;
                    if (have[b.id]) return;
                    list.push(cloneDefinition(b));
                });
                return storage.set('modes-imported', list);
            });
        },

        getCommitted: function () {
            var key = currentBucketKey();
            return storage.get(key, []).then(function (val) {
                var list = Array.isArray(val) ? val : [];
                // Lazy migration: when the player saves a brand-new game for the
                // first time, the next read sees a real save name with an empty
                // bucket — pull in anything they committed pre-save.
                if (list.length === 0 && key !== UNSAVED_KEY) {
                    return storage.get(UNSAVED_KEY, []).then(function (unsaved) {
                        if (!Array.isArray(unsaved) || unsaved.length === 0) return list;
                        return storage.set(key, unsaved)
                            .then(function () { return storage.delete(UNSAVED_KEY); })
                            .then(function () { return unsaved; });
                    });
                }
                return list;
            });
        },

        commitMode: function (id) {
            var key = currentBucketKey();
            return Promise.all([storage.get(key, []), registry.getLibrary()]).then(function (results) {
                var list = Array.isArray(results[0]) ? results[0] : [];
                if (list.find(function (c) { return c.id === id; })) return;
                var def = results[1].find(function (m) { return m.id === id; });
                if (!def) {
                    return Promise.reject(new Error('Mode "' + id + '" is not in the library'));
                }
                // Snapshot-at-commit: the save's bucket holds a deep copy of
                // the library entry as it was at this moment. Future library
                // edits or removals can't change what this save plays with.
                // withStatDefaults fills any geometry stats the user's def
                // omitted so the snapshot is registration-complete on its own.
                list.push({ id: id, locked: false, definition: withStatDefaults(def) });
                return storage.set(key, list);
            });
        },

        removeCommitted: function (id) {
            var key = currentBucketKey();
            return storage.get(key, []).then(function (committed) {
                var list = Array.isArray(committed) ? committed : [];
                var entry = list.find(function (c) { return c.id === id; });
                if (entry && !entry.locked) {
                    var next = list.filter(function (c) { return c.id !== id; });
                    if (next.length === 0) return storage.delete(key);
                    return storage.set(key, next);
                }
            });
        },

        lockUsed: function (usedIds) {
            var key = currentBucketKey();
            return Promise.all([storage.get(key, []), registry.getLibrary()]).then(function (results) {
                var list = Array.isArray(results[0]) ? results[0] : [];
                var library = results[1];
                var seen = {};
                list.forEach(function (c) { seen[c.id] = true; });
                // Self-heal: a route in the save references a mode not in our
                // bucket → re-commit it as locked, snapshotting from the live
                // library so the save is registration-safe on the next load.
                Object.keys(usedIds).forEach(function (id) {
                    if (seen[id]) return;
                    var def = library.find(function (m) { return m.id === id; });
                    if (!def) {
                        console.warn('[Mode Manager] Route uses mode "' + id + '" but no library definition exists — skipping snapshot');
                        return;
                    }
                    list.push({ id: id, locked: true, definition: withStatDefaults(def) });
                });
                return storage.set(key, list.map(function (c) {
                    return Object.assign({}, c, { locked: c.locked || !!usedIds[c.id] });
                }));
            });
        },

        lockMode: function (id) {
            var key = currentBucketKey();
            return storage.get(key, []).then(function (committed) {
                var list = Array.isArray(committed) ? committed : [];
                return storage.set(key, list.map(function (c) {
                    return c.id === id ? Object.assign({}, c, { locked: true }) : c;
                }));
            });
        },

        validateImport: function (jsonText) {
            var def;
            try {
                def = JSON.parse(jsonText);
            } catch (e) {
                return { error: 'Invalid JSON: ' + e.message };
            }

            if (!def || typeof def !== 'object' || Array.isArray(def)) {
                return { error: 'Definition must be a JSON object.' };
            }

            var missingTop = ['id', 'name', 'description', 'stats', 'compatibleTrackTypes', 'appearance']
                .filter(function (f) { return !(f in def); });
            if (missingTop.length) {
                return { error: 'Missing required fields: ' + missingTop.join(', ') + '.' };
            }
            if (typeof def.id !== 'string' || !def.id.trim()) {
                return { error: '"id" must be a non-empty string.' };
            }
            if (!/^[a-z0-9-]+$/.test(def.id)) {
                return { error: '"id" must contain only lowercase letters, numbers, and hyphens.' };
            }
            if (typeof def.name !== 'string' || !def.name.trim()) {
                return { error: '"name" must be a non-empty string.' };
            }
            if (!Array.isArray(def.compatibleTrackTypes) || def.compatibleTrackTypes.length === 0) {
                return { error: '"compatibleTrackTypes" must be a non-empty array of strings.' };
            }
            if (!def.appearance || typeof def.appearance.color !== 'string') {
                return { error: '"appearance.color" must be a hex color string.' };
            }
            if (typeof def.stats !== 'object' || !def.stats) {
                return { error: '"stats" must be an object.' };
            }
            var missingStats = REQUIRED_STATS.filter(function (s) { return typeof def.stats[s] !== 'number'; });
            if (missingStats.length) {
                return { error: 'Missing or non-numeric stats: ' + missingStats.join(', ') + '.' };
            }
            if ('tags' in def && (!Array.isArray(def.tags) || def.tags.some(function (t) { return typeof t !== 'string'; }))) {
                return { error: '"tags" must be an array of strings.' };
            }
            // Optional geometry/cost stats the engine uses for parallel/quad
            // preview, curve fitting, and maintenance costs. Missing keys are
            // filled by STAT_DEFAULTS at snapshot/registration time, so we
            // only validate types when present.
            var optionalStats = ['stopTimeSeconds', 'maxLateralAcceleration', 'parallelTrackSpacing', 'trackClearance', 'minTurnRadius', 'minStationTurnRadius', 'maxSlopePercentage', 'trackMaintenanceCostPerMeter', 'stationMaintenanceCostPerYear'];
            for (var i = 0; i < optionalStats.length; i++) {
                var k = optionalStats[i];
                if (k in def.stats && (typeof def.stats[k] !== 'number' || isNaN(def.stats[k]))) {
                    return { error: '"stats.' + k + '" must be a number when present.' };
                }
            }
            // Optional top-level field — keys map to elevation modes, values
            // are cost multipliers. Game uses its own defaults if absent.
            if ('elevationMultipliers' in def) {
                if (!def.elevationMultipliers || typeof def.elevationMultipliers !== 'object' || Array.isArray(def.elevationMultipliers)) {
                    return { error: '"elevationMultipliers" must be an object.' };
                }
                var emKeys = Object.keys(def.elevationMultipliers);
                for (var j = 0; j < emKeys.length; j++) {
                    var v = def.elevationMultipliers[emKeys[j]];
                    if (typeof v !== 'number' || isNaN(v)) {
                        return { error: '"elevationMultipliers.' + emKeys[j] + '" must be a number.' };
                    }
                }
            }

            // schemaVersion describes the JSON shape, not the mod release.
            // Default to current when missing. Bumps to the major component
            // signal a breaking schema change that this mod build can't read.
            if ('schemaVersion' in def) {
                if (typeof def.schemaVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(def.schemaVersion)) {
                    return { error: '"schemaVersion" must be a string like "1.0.0".' };
                }
                var defMajor = parseInt(def.schemaVersion.split('.')[0], 10);
                if (defMajor > SCHEMA_MAJOR) {
                    return { error: 'Definition schemaVersion ' + def.schemaVersion + ' is newer than this mod supports (max ' + SCHEMA_MAJOR + '.x.x; current: ' + SCHEMA_VERSION + ').' };
                }
            } else {
                def.schemaVersion = SCHEMA_VERSION;
            }
            // revision is a free-form counter the user (or future edit UI)
            // bumps when changing stats. Snapshots carry it so saves can
            // surface "you're playing on rev 2; library has rev 3" later.
            if ('revision' in def) {
                if (typeof def.revision !== 'number' || def.revision < 1 || (def.revision | 0) !== def.revision) {
                    return { error: '"revision" must be a positive integer.' };
                }
            } else {
                def.revision = 1;
            }

            return { def: def };
        }
    };

    // ─── SCHEMA MIGRATIONS ───────────────────────────────────────────────────────
    // Runs after the registry is defined so migrations can use it. Gated by
    // installedVersionAtLoad (captured before any storage writes) so each
    // version transition only fires once per machine. The MOD_VERSION marker
    // is written at the end so a crash mid-migration leaves the marker stale
    // and we retry next launch.

    function runSchemaMigrations() {
        if (installedVersionAtLoad === MOD_VERSION) return Promise.resolve();

        var chain = Promise.resolve();

        // 1.0.1 → 1.0.2: snapshot-at-commit. Walk every committed:* bucket
        // and embed each entry's current library definition. Without this,
        // the next save load sees entries with no .definition and falls
        // back to libraryMap — which works, but defeats the snapshot
        // guarantee for pre-existing commits.
        //
        // Note: this runs against the pre-1.0.4 library composition where
        // BUILTINS were concatenated live with imports. Reading via
        // storage.get('modes-imported') here would miss them, so we walk
        // BUILTINS + imports inline rather than going through getLibrary
        // (which is now imports-only).
        if (isVersionBefore(installedVersionAtLoad, '1.0.2')) {
            chain = chain.then(function () {
                return Promise.all([storage.keys(), storage.get('modes-imported', [])]).then(function (results) {
                    var allKeys = results[0];
                    var imported = Array.isArray(results[1]) ? results[1] : [];
                    var libraryMap = {};
                    BUILTINS.concat(imported).forEach(function (m) { libraryMap[m.id] = m; });

                    var bucketKeys = allKeys.filter(function (k) { return k.indexOf('committed:') === 0; });
                    return Promise.all(bucketKeys.map(function (key) {
                        return storage.get(key, []).then(function (raw) {
                            if (!Array.isArray(raw) || raw.length === 0) return;
                            var changed = false;
                            var next = raw.map(function (entry) {
                                if (entry && entry.definition) return entry;
                                var def = entry && libraryMap[entry.id];
                                if (!def) {
                                    console.warn('[Mode Manager] Migration: bucket "' + key + '" entry "' + (entry && entry.id) + '" has no library definition — leaving without snapshot');
                                    return entry;
                                }
                                changed = true;
                                return Object.assign({}, entry, { definition: cloneDefinition(def) });
                            });
                            if (changed) return storage.set(key, next);
                        });
                    }));
                });
            });
        }

        // 1.0.3 → 1.0.4: collapse the source distinction. Seed BUILTINS
        // into the user's library so every entry is uniform from this point
        // on. Honors any hidden-builtins set from 1.0.3 (if the user had
        // hidden Tram before upgrading, we don't reseed Tram), then drops
        // the now-defunct hidden-builtins key.
        if (isVersionBefore(installedVersionAtLoad, '1.0.4')) {
            chain = chain.then(function () {
                return Promise.all([
                    storage.get('modes-imported', []),
                    storage.get('hidden-builtins', [])
                ]).then(function (results) {
                    var imported = Array.isArray(results[0]) ? results[0].slice() : [];
                    var hidden   = Array.isArray(results[1]) ? results[1] : [];
                    var hiddenSet = {};
                    hidden.forEach(function (id) { hiddenSet[id] = true; });
                    var have = {};
                    imported.forEach(function (m) { have[m.id] = true; });

                    var added = 0;
                    BUILTINS.forEach(function (b) {
                        if (have[b.id] || hiddenSet[b.id]) return;
                        // Strip any legacy source field — seeded entries
                        // should be indistinguishable from user imports.
                        var clone = cloneDefinition(b);
                        delete clone.source;
                        imported.push(clone);
                        added++;
                    });

                    var writes = [storage.set('modes-imported', imported)];
                    // hidden-builtins is no longer read anywhere; drop it.
                    writes.push(storage.delete('hidden-builtins'));

                    if (added > 0) console.log('[Mode Manager] Migration: seeded ' + added + ' built-in mode(s) into library.');
                    return Promise.all(writes);
                });
            });
        }

        return chain
            .then(function () {
                try { localStorage.setItem(INSTALLED_VERSION_KEY, MOD_VERSION); } catch (e) {}
            })
            .catch(function (err) {
                console.error('[Mode Manager] Schema migration failed:', err);
                // Leave the marker stale so we retry next launch.
            });
    }

    // ─── UI ──────────────────────────────────────────────────────────────────────
    // All React access is deferred to render time via api.utils.React so that
    // module-level code never touches the React object before onGameInit fires.

    var STYLES = {
        root:         { padding: '12px 16px', color: '#f9fafb', fontFamily: 'inherit' },
        tabBar:       { display: 'flex', borderBottom: '1px solid #374151', marginBottom: '12px' },
        tab:          { flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' },
        tabActive:    { borderBottom: '2px solid #60a5fa', color: '#60a5fa' },
        tabInactive:  { borderBottom: '2px solid transparent', color: '#6b7280' },
        row:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f2937' },
        modeName:     { color: '#f9fafb', fontSize: '13px', fontWeight: '500' },
        sectionLabel: { color: '#6b7280', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
        divider:      { borderTop: '1px solid #374151', paddingTop: '12px', marginTop: '4px' },
        iconBtn:      { background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
        bannerFlex:   { display: 'flex', alignItems: 'center', gap: '6px' },
        addBtn:       { padding: '4px 10px', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px', background: '#1d4ed8' },
        secondaryBtn: { padding: '4px 10px', border: '1px solid #374151', borderRadius: '4px', color: '#9ca3af', cursor: 'pointer', fontSize: '11px', background: 'transparent' },
        toggleRow:    { display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' },
        editorTitle:  { color: '#f9fafb', fontSize: '13px', fontWeight: '600', marginBottom: '8px' },
        editorBack:   { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '11px', padding: '0 4px 6px 0' },
        formSection:  { marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1f2937' },
        formLabel:    { display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '2px' },
        formInput:    { width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: '4px', color: '#f9fafb', padding: '4px 6px', fontSize: '11px', boxSizing: 'border-box', fontFamily: 'inherit' },
        formInputRO:  { width: '100%', background: '#0b1220', border: '1px solid #374151', borderRadius: '4px', color: '#6b7280', padding: '4px 6px', fontSize: '11px', boxSizing: 'border-box', fontFamily: 'inherit' },
        formGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '8px', rowGap: '6px' },
        formField:    { display: 'flex', flexDirection: 'column' },
        formCheckRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' },
        editorActions:{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #374151' },
        primaryBtn:   { padding: '6px 12px', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '12px', background: '#2563eb' },
        importBtn:    { marginTop: '6px', padding: '6px 12px', border: 'none', borderRadius: '4px', fontSize: '12px' },
        textarea:     { width: '100%', height: '80px', background: '#111827', border: '1px solid #374151', borderRadius: '4px', color: '#f9fafb', padding: '6px', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' },
        errorBox:     { color: '#ef4444', fontSize: '11px', margin: '4px 0' },
        warnBox:      { padding: '8px', background: '#1f2937', borderRadius: '4px', color: '#f59e0b', fontSize: '11px', marginBottom: '8px' },
        notice:       { marginTop: '12px', padding: '8px', background: '#1f2937', borderRadius: '4px', color: '#f59e0b', fontSize: '11px' },
        empty:        { color: '#6b7280', fontSize: '12px', padding: '8px 0' }
    };

    function ModeManagerPanel() {
        var React = api.utils.React;
        var h = React.createElement;

        // Lucide icons exposed by the host. Fall back to text glyphs if the
        // curated set ever drops one of these names.
        var icons = (api.utils && api.utils.icons) || {};
        var Trash2Icon         = icons.Trash2;
        var LockIcon           = icons.Lock;
        var XIcon              = icons.X;
        var AlertTriangleIcon  = icons.AlertTriangle;
        var AlertCircleIcon    = icons.AlertCircle;
        var ClipboardCopyIcon  = icons.ClipboardCopy;
        var PencilRulerIcon    = icons.PencilRuler;
        function icon(Comp, fallback, props) {
            return Comp ? h(Comp, props || { size: 16 }) : fallback;
        }

        // Guard: hooks required
        if (typeof React.useState !== 'function' || typeof React.useEffect !== 'function') {
            return h('div', { style: STYLES.root },
                h('p', { style: STYLES.errorBox }, 'Mode Manager requires React 16.8+. Please update Subway Builder.')
            );
        }

        var useState   = React.useState;
        var useEffect  = React.useEffect;

        var tabState         = useState('save');
        var libraryState     = useState(null);
        var committedState   = useState(null);
        var loadErrorState   = useState(null);
        var importTextState  = useState('');
        var importErrorState = useState('');
        var actionErrorState = useState(null);
        var editModeState    = useState(false);
        var editorTargetState = useState(null);

        var tab         = tabState[0];         var setTab         = tabState[1];
        var library     = libraryState[0];     var setLibrary     = libraryState[1];
        var committed   = committedState[0];   var setCommitted   = committedState[1];
        var loadError   = loadErrorState[0];   var setLoadError   = loadErrorState[1];
        var importText  = importTextState[0];  var setImportText  = importTextState[1];
        var importError = importErrorState[0]; var setImportError = importErrorState[1];
        var actionError = actionErrorState[0]; var setActionError = actionErrorState[1];
        var editMode    = editModeState[0];    var setEditMode    = editModeState[1];
        // editorTarget is { mode: 'create' | 'edit', def } when the editor
        // view is active, otherwise null. The panel renders the editor in
        // place of the tab content while it's set.
        var editorTarget = editorTargetState[0]; var setEditorTarget = editorTargetState[1];

        function reload() {
            setLoadError(null);
            Promise.all([registry.getLibrary(), registry.getCommitted()])
                .then(function (results) {
                    setLibrary(results[0]);
                    setCommitted(results[1]);
                })
                .catch(function (err) {
                    console.error('[Mode Manager] Failed to load panel data:', err);
                    setLibrary(BUILTINS);
                    setCommitted([]);
                    setLoadError('Storage unavailable — showing defaults. Changes will not persist.');
                });
        }

        useEffect(function () { reload(); }, []);

        useEffect(function () {
            function onLockChanged() { reload(); }
            window.addEventListener('mode-manager:lock-changed', onLockChanged);
            return function () { window.removeEventListener('mode-manager:lock-changed', onLockChanged); };
        }, []);

        // Reset transient edit mode if the user removed every saved mode —
        // otherwise a future import/restore would render with trash icons
        // even though the user can no longer see the "Done" toggle.
        useEffect(function () {
            if (library && library.length === 0 && editMode) setEditMode(false);
        }, [library, editMode]);

        // Loading state
        if (!library || !committed) {
            return h('div', { style: Object.assign({}, STYLES.root, { color: '#6b7280' }) }, 'Loading...');
        }

        var committedIds = {};
        committed.forEach(function (c) { committedIds[c.id] = true; });

        function reloadMod(pendingMsg, pendingType) {
            if (pendingMsg) {
                localStorage.setItem('mode-manager:pending-notification', JSON.stringify({ msg: pendingMsg, type: pendingType || 'info' }));
            }
            // Mark this hot-reload as self-triggered so the next onGameInit
            // doesn't wipe __unsaved__: the user is mid-session and just made
            // a commit; the new-game cleanup logic doesn't apply here.
            try { localStorage.setItem('mode-manager:reload-in-flight', String(Date.now())); } catch (e) {}
            window.__modeManagerLoaded = false;
            api.reloadMods().catch(function (err) {
                console.error('[Mode Manager] reloadMods failed:', err);
                // Reload didn't happen — drop the marker so the next genuine
                // session start doesn't skip its cleanup.
                try { localStorage.removeItem('mode-manager:reload-in-flight'); } catch (e) {}
                setActionError('Reload failed — ' + err.message);
            });
        }

        function handleCommit(id) {
            setActionError(null);
            registry.commitMode(id)
                .then(function () { reloadMod('Mode added', 'success'); })
                .catch(function (err) {
                    console.error('[Mode Manager] commitMode failed:', err);
                    setActionError('Failed to save — ' + err.message);
                });
        }

        function handleRemoveCommitted(id) {
            setActionError(null);
            registry.removeCommitted(id)
                .then(function () { reloadMod('Mode removed — reload save to clear from build panel', 'info'); })
                .catch(function (err) {
                    console.error('[Mode Manager] removeCommitted failed:', err);
                    setActionError('Failed to remove — ' + err.message);
                });
        }

        function handleRemoveMode(id) {
            setActionError(null);
            registry.removeMode(id)
                .then(reload)
                .catch(function (err) {
                    console.error('[Mode Manager] removeMode failed:', err);
                    setActionError('Failed to remove — ' + err.message);
                });
        }

        function handleCopyMode(def) {
            setActionError(null);
            var json = JSON.stringify(def, null, 2);
            var nav = (typeof navigator !== 'undefined') ? navigator : null;
            if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') {
                setActionError('Clipboard unavailable in this context.');
                return;
            }
            nav.clipboard.writeText(json).then(function () {
                try { api.ui.showNotification('Copied "' + def.name + '" JSON to clipboard', 'success'); } catch (e) {}
            }).catch(function (err) {
                console.error('[Mode Manager] clipboard write failed:', err);
                setActionError('Failed to copy — ' + err.message);
            });
        }

        function handleRestoreDefault(id) {
            setActionError(null);
            registry.restoreDefaults([id])
                .then(reload)
                .catch(function (err) {
                    console.error('[Mode Manager] restoreDefaults failed:', err);
                    setActionError('Failed to restore — ' + err.message);
                });
        }

        function handleOpenEditor(mode) {
            setActionError(null);
            // Editing an existing mode: deep-clone so form edits don't mutate
            // the live library entry until the user saves.
            setEditorTarget({ mode: 'edit', def: cloneDefinition(mode) });
        }

        function handleOpenCreate() {
            setActionError(null);
            // Empty seed for a new mode. Stats start undefined (validateImport
            // will reject until the user fills in required ones); optional
            // stats can stay undefined and are filled by STAT_DEFAULTS at
            // commit/registration time.
            setEditorTarget({
                mode: 'create',
                def: {
                    schemaVersion: SCHEMA_VERSION,
                    revision: 1,
                    id: '',
                    name: '',
                    description: '',
                    stats: {},
                    compatibleTrackTypes: [],
                    appearance: { color: '#60a5fa' },
                    allowAtGradeRoadCrossing: false,
                    elevationMultipliers: {},
                    tags: []
                }
            });
        }

        function handleEditorSave(def) {
            setActionError(null);
            // Bump revision on every successful edit. New modes start at 1
            // (already set in handleOpenCreate); edits increment from the
            // existing value. Snapshots in saves carry the revision they
            // committed against, so a future "library has rev N" UI hint
            // can compare cleanly.
            var nextDef = Object.assign({}, def);
            if (editorTarget && editorTarget.mode === 'edit') {
                nextDef.revision = (typeof def.revision === 'number' ? def.revision : 0) + 1;
            }
            var op = editorTarget && editorTarget.mode === 'edit'
                ? registry.updateMode(nextDef)
                : registry.addMode(nextDef);
            op.then(function () {
                setEditorTarget(null);
                reload();
            }).catch(function (err) {
                console.error('[Mode Manager] editor save failed:', err);
                setActionError('Failed to save — ' + err.message);
            });
        }

        function handleEditorCancel() {
            setEditorTarget(null);
        }

        function handleImport() {
            var result = registry.validateImport(importText);
            if (result.error) { setImportError(result.error); return; }
            if (library.find(function (m) { return m.id === result.def.id; })) {
                setImportError('A mode with id "' + result.def.id + '" already exists.');
                return;
            }
            setImportError('');
            registry.addMode(result.def)
                .then(function () { reload(); setImportText(''); })
                .catch(function (err) {
                    console.error('[Mode Manager] addMode failed:', err);
                    setImportError('Failed to save import — ' + err.message);
                });
        }

        // ── Mode editor view ─────────────────────────────────────────
        // Renders a full-panel form for create/edit when editorTarget is set.
        // Stays inside the same panel surface (host has no programmatic
        // open/close for separate panels), but visually replaces the tabs
        // for an "in editor" feel until Cancel/Save returns to the library.
        function renderEditor() {
            var isEdit = editorTarget.mode === 'edit';
            // Local mutable working copy. We do NOT use useState for each
            // field — that'd require dozens of hooks. Instead, mutate the
            // working copy directly and force re-render via a tick state
            // when needed. Inputs are uncontrolled (defaultValue) and read
            // their values only on save.
            var working = editorTarget.def;

            function setTopField(field, value) { working[field] = value; }
            function setStatField(field, value) {
                working.stats = working.stats || {};
                if (value === '' || value === null || isNaN(value)) delete working.stats[field];
                else working.stats[field] = value;
            }
            function setElevField(key, value) {
                working.elevationMultipliers = working.elevationMultipliers || {};
                if (value === '' || value === null || isNaN(value)) delete working.elevationMultipliers[key];
                else working.elevationMultipliers[key] = value;
            }

            function makeStatGrid(fields) {
                return h('div', { style: STYLES.formGrid }, fields.map(function (key) {
                    var initial = working.stats && working.stats[key];
                    return h('div', { key: key, style: STYLES.formField },
                        h('label', { style: STYLES.formLabel }, key),
                        h('input', {
                            type: 'number',
                            step: 'any',
                            defaultValue: initial == null ? '' : initial,
                            onChange: function (e) { setStatField(key, parseFloat(e.target.value)); },
                            style: STYLES.formInput
                        })
                    );
                }));
            }

            var perfStats   = ['maxAcceleration', 'maxDeceleration', 'maxSpeed', 'maxSpeedLocalStation', 'maxLateralAcceleration', 'maxSlopePercentage', 'stopTimeSeconds'];
            var capStats    = ['capacityPerCar', 'carLength', 'minCars', 'maxCars', 'carsPerCarSet', 'trainWidth'];
            var stationStats= ['minStationLength', 'maxStationLength', 'minStationTurnRadius'];
            var trackStats  = ['parallelTrackSpacing', 'trackClearance', 'minTurnRadius'];
            var costStats   = ['carCost', 'baseTrackCost', 'baseStationCost', 'scissorsCrossoverCost', 'trainOperationalCostPerHour', 'carOperationalCostPerHour', 'trackMaintenanceCostPerMeter', 'stationMaintenanceCostPerYear'];
            var elevKeys    = ['AT_GRADE', 'ELEVATED', 'CUT_AND_COVER', 'STANDARD_TUNNEL', 'DEEP_BORE'];

            function handleSubmit() {
                // Round-trip through validateImport for consistent rules.
                // Strip empty optional containers so they don't fail type
                // checks on empty objects/arrays.
                var clone = cloneDefinition(working);
                if (clone.elevationMultipliers && Object.keys(clone.elevationMultipliers).length === 0) delete clone.elevationMultipliers;
                if (Array.isArray(clone.tags) && clone.tags.length === 0) delete clone.tags;
                var result = registry.validateImport(JSON.stringify(clone));
                if (result.error) { setActionError(result.error); return; }
                if (!isEdit) {
                    var dup = library.find(function (m) { return m.id === result.def.id; });
                    if (dup) { setActionError('A mode with id "' + result.def.id + '" already exists.'); return; }
                }
                handleEditorSave(result.def);
            }

            return h('div', null,
                h('button', { onClick: handleEditorCancel, style: STYLES.editorBack }, '← Back to Library'),
                h('div', { style: STYLES.editorTitle }, isEdit ? 'Edit: ' + (working.name || working.id) : 'Create Mode'),

                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'General'),
                    h('div', { style: STYLES.formField },
                        h('label', { style: STYLES.formLabel }, 'id (lowercase, hyphens only)'),
                        h('input', {
                            type: 'text',
                            defaultValue: working.id,
                            readOnly: isEdit,
                            onChange: function (e) { setTopField('id', e.target.value); },
                            style: isEdit ? STYLES.formInputRO : STYLES.formInput
                        })
                    ),
                    h('div', { style: { marginTop: '6px' } },
                        h('label', { style: STYLES.formLabel }, 'name'),
                        h('input', {
                            type: 'text',
                            defaultValue: working.name,
                            onChange: function (e) { setTopField('name', e.target.value); },
                            style: STYLES.formInput
                        })
                    ),
                    h('div', { style: { marginTop: '6px' } },
                        h('label', { style: STYLES.formLabel }, 'description'),
                        h('input', {
                            type: 'text',
                            defaultValue: working.description,
                            onChange: function (e) { setTopField('description', e.target.value); },
                            style: STYLES.formInput
                        })
                    )
                ),

                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Track Compatibility'),
                    h('div', { style: STYLES.formField },
                        h('label', { style: STYLES.formLabel }, 'compatibleTrackTypes (comma-separated)'),
                        h('input', {
                            type: 'text',
                            defaultValue: (working.compatibleTrackTypes || []).join(', '),
                            onChange: function (e) {
                                working.compatibleTrackTypes = e.target.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                            },
                            style: STYLES.formInput
                        })
                    ),
                    h('div', { style: { marginTop: '6px' } },
                        h('label', { style: STYLES.formLabel }, 'tags (comma-separated, optional)'),
                        h('input', {
                            type: 'text',
                            defaultValue: (working.tags || []).join(', '),
                            onChange: function (e) {
                                working.tags = e.target.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                            },
                            style: STYLES.formInput
                        })
                    ),
                    h('label', { style: STYLES.formCheckRow },
                        h('input', {
                            type: 'checkbox',
                            defaultChecked: !!working.allowAtGradeRoadCrossing,
                            onChange: function (e) { setTopField('allowAtGradeRoadCrossing', e.target.checked); }
                        }),
                        h('span', { style: { color: '#9ca3af', fontSize: '11px' } }, 'allowAtGradeRoadCrossing')
                    )
                ),

                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Appearance'),
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                        h('input', {
                            type: 'color',
                            defaultValue: (working.appearance && working.appearance.color) || '#60a5fa',
                            onChange: function (e) {
                                working.appearance = working.appearance || {};
                                working.appearance.color = e.target.value;
                            },
                            style: { width: '40px', height: '24px', background: 'transparent', border: '1px solid #374151', borderRadius: '4px', padding: 0 }
                        }),
                        h('input', {
                            type: 'text',
                            defaultValue: (working.appearance && working.appearance.color) || '#60a5fa',
                            onChange: function (e) {
                                working.appearance = working.appearance || {};
                                working.appearance.color = e.target.value;
                            },
                            style: Object.assign({}, STYLES.formInput, { flex: 1 })
                        })
                    )
                ),

                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Performance'),
                    makeStatGrid(perfStats)
                ),
                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Capacity'),
                    makeStatGrid(capStats)
                ),
                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Stations'),
                    makeStatGrid(stationStats)
                ),
                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Track Geometry'),
                    makeStatGrid(trackStats)
                ),
                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Costs'),
                    makeStatGrid(costStats)
                ),

                h('div', { style: STYLES.formSection },
                    h('div', { style: STYLES.sectionLabel }, 'Elevation Cost Multipliers (leave blank to use game default)'),
                    h('div', { style: STYLES.formGrid }, elevKeys.map(function (key) {
                        var initial = working.elevationMultipliers && working.elevationMultipliers[key];
                        return h('div', { key: key, style: STYLES.formField },
                            h('label', { style: STYLES.formLabel }, key),
                            h('input', {
                                type: 'number',
                                step: 'any',
                                defaultValue: initial == null ? '' : initial,
                                onChange: function (e) { setElevField(key, parseFloat(e.target.value)); },
                                style: STYLES.formInput
                            })
                        );
                    }))
                ),

                h('div', { style: STYLES.editorActions },
                    h('button', { onClick: handleEditorCancel, style: STYLES.secondaryBtn }, 'Cancel'),
                    h('button', { onClick: handleSubmit, style: STYLES.primaryBtn }, isEdit ? 'Save Changes' : 'Create Mode')
                )
            );
        }

        // Shared banners
        var loadErrorBanner = loadError
            ? h('div', { style: Object.assign({}, STYLES.warnBox, STYLES.bannerFlex) },
                icon(AlertTriangleIcon, '⚠', { size: 14 }),
                h('span', null, loadError))
            : null;

        var actionErrorBanner = actionError
            ? h('div', { style: Object.assign({}, STYLES.warnBox, STYLES.bannerFlex, { color: '#ef4444' }) },
                icon(AlertCircleIcon, '✕', { size: 14 }),
                h('span', null, actionError))
            : null;

        // Tab bar
        var tabBar = h('div', { style: STYLES.tabBar },
            h('button', {
                onClick: function () { setTab('save'); },
                style: Object.assign({}, STYLES.tab, tab === 'save' ? STYLES.tabActive : STYLES.tabInactive)
            }, 'This Save'),
            h('button', {
                onClick: function () { setTab('library'); },
                style: Object.assign({}, STYLES.tab, tab === 'library' ? STYLES.tabActive : STYLES.tabInactive)
            }, 'Library')
        );

        // ── Library tab ──────────────────────────────────────────────
        // All entries are equal — built-ins seeded into the library at first
        // install are indistinguishable from user-imported modes. Removal
        // is always allowed: snapshot-at-commit means saves keep playing
        // their committed modes regardless of library state, and removed
        // built-ins reappear in "Available defaults" for one-click restore.
        // Per-row action toggles between Copy (default) and Remove (when
        // the user has clicked "Remove Modes") — keeps destructive deletes
        // behind a deliberate gesture without re-introducing a permanent
        // confirmation prompt.
        var libraryRows = library.map(function (mode) {
            var libraryId = mode.id;
            return h('div', { key: libraryId, style: STYLES.row },
                h('div', null,
                    h('div', { style: STYLES.modeName }, mode.name)
                ),
                editMode
                    ? h('button', {
                        title: 'Remove from library',
                        onClick: function () { handleRemoveMode(libraryId); },
                        style: Object.assign({}, STYLES.iconBtn, { color: '#ef4444' })
                      }, icon(Trash2Icon, '🗑️'))
                    : h('div', { style: { display: 'inline-flex', alignItems: 'center' } },
                        h('button', {
                            title: 'Edit this mode',
                            onClick: function () { handleOpenEditor(mode); },
                            style: Object.assign({}, STYLES.iconBtn, { color: '#9ca3af' })
                          }, icon(PencilRulerIcon, '✏️')),
                        h('button', {
                            title: 'Copy mode JSON to clipboard',
                            onClick: function () { handleCopyMode(mode); },
                            style: Object.assign({}, STYLES.iconBtn, { color: '#9ca3af' })
                          }, icon(ClipboardCopyIcon, '📋'))
                      )
            );
        });

        var savedModesSection = library.length > 0
            ? h('div', null,
                h('div', { style: STYLES.sectionLabel }, 'Saved Modes'),
                libraryRows,
                h('div', { style: STYLES.toggleRow },
                    h('button', {
                        onClick: handleOpenCreate,
                        style: STYLES.secondaryBtn
                    }, 'Create Mode'),
                    h('button', {
                        onClick: function () { setEditMode(!editMode); },
                        style: STYLES.secondaryBtn
                    }, editMode ? 'Done' : 'Remove Modes')
                )
              )
            : h('div', { style: STYLES.toggleRow },
                h('button', {
                    onClick: handleOpenCreate,
                    style: STYLES.secondaryBtn
                }, 'Create Mode')
              );

        var libraryHas = {};
        library.forEach(function (m) { libraryHas[m.id] = true; });
        var availableDefaults = BUILTINS.filter(function (b) { return !libraryHas[b.id]; });
        var defaultsSection = availableDefaults.length > 0
            ? h('div', { style: STYLES.divider },
                h('div', { style: STYLES.sectionLabel }, 'Available defaults (' + availableDefaults.length + ')'),
                availableDefaults.map(function (mode) {
                    return h('div', { key: mode.id, style: STYLES.row },
                        h('div', { style: Object.assign({}, STYLES.modeName, { color: '#9ca3af' }) }, mode.name),
                        h('button', {
                            onClick: function () { handleRestoreDefault(mode.id); },
                            style: STYLES.addBtn
                        }, 'Restore')
                    );
                })
              )
            : null;

        var importCanSubmit = importText.trim().length > 0;
        var libraryTab = h('div', null,
            savedModesSection,
            h('div', { style: savedModesSection ? STYLES.divider : null },
                h('div', { style: STYLES.sectionLabel }, 'Import a Mode'),
                h('textarea', {
                    value: importText,
                    onChange: function (e) { setImportText(e.target.value); setImportError(''); },
                    placeholder: '{ "id": "my-mode", "name": "My Mode", "stats": { ... }, ... }',
                    style: STYLES.textarea
                }),
                importError ? h('div', { style: STYLES.errorBox }, importError) : null,
                h('button', {
                    onClick: handleImport,
                    disabled: !importCanSubmit,
                    style: Object.assign({}, STYLES.importBtn, {
                        background: importCanSubmit ? '#2563eb' : '#1f2937',
                        color: importCanSubmit ? '#fff' : '#6b7280',
                        cursor: importCanSubmit ? 'pointer' : 'not-allowed'
                    })
                }, 'Add Mode')
            ),
            defaultsSection
        );

        // ── This Save tab ────────────────────────────────────────────
        var committedEntries = committed.map(function (c) {
            // Snapshot wins: this save committed against c.definition, so
            // display from it. Library lookup is just a legacy fallback.
            return { id: c.id, locked: c.locked, def: c.definition || library.find(function (m) { return m.id === c.id; }) };
        });
        var available = library.filter(function (m) { return !committedIds[m.id]; });

        var committedSection = committedEntries.length === 0
            ? h('div', { style: STYLES.empty }, 'No modes added to this game yet.')
            : h('div', { style: { marginBottom: '4px' } },
                h('div', { style: STYLES.sectionLabel }, 'Active in this game'),
                committedEntries.map(function (entry) {
                    return h('div', { key: entry.id, style: STYLES.row },
                        h('div', null,
                            h('div', { style: STYLES.modeName }, entry.def ? entry.def.name : entry.id)
                        ),
                        entry.locked
                            ? h('span', {
                                title: 'Locked to prevent breaking game save',
                                style: Object.assign({}, STYLES.iconBtn, { color: '#f59e0b', cursor: 'default' })
                              }, icon(LockIcon, '🔒'))
                            : h('button', {
                                title: 'Remove from this game',
                                onClick: function () { handleRemoveCommitted(entry.id); },
                                style: Object.assign({}, STYLES.iconBtn, { color: '#ef4444' })
                              }, icon(XIcon, '✕'))
                    );
                })
              );

        var availableSection = available.length > 0
            ? h('div', { style: STYLES.divider },
                h('div', { style: STYLES.sectionLabel }, 'Available to add'),
                available.map(function (mode) {
                    return h('div', { key: mode.id, style: STYLES.row },
                        h('div', { style: Object.assign({}, STYLES.modeName, { color: '#9ca3af' }) }, mode.name),
                        h('button', {
                            onClick: function () { handleCommit(mode.id); },
                            style: STYLES.addBtn
                        }, '+ Add')
                    );
                })
              )
            : null;

        var saveTab = h('div', null,
            committedSection,
            availableSection
        );

        // When the editor is open it replaces the tab content entirely.
        // Action-error banner stays visible above so validation failures
        // surface where the user expects them; the tab bar hides because
        // there's only one screen relevant in editor mode.
        if (editorTarget) {
            return h('div', { style: STYLES.root },
                loadErrorBanner,
                actionErrorBanner,
                renderEditor()
            );
        }

        return h('div', { style: STYLES.root },
            loadErrorBanner,
            actionErrorBanner,
            tabBar,
            tab === 'save' ? saveTab : libraryTab
        );
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────
    // onGameInit fires on every game load (new game + save loads). The panel must
    // only be registered once per mod lifecycle — a flag prevents duplicates.
    // Mode registration and lock-state refresh run async on every load.

    var panelRegistered = false;

    api.hooks.onGameInit(function () {
        try {
            // Detect self-triggered hot reloads (e.g. just after a commit
            // that called api.reloadMods). The marker is short-lived so a
            // stale flag from a failed reload doesn't bleed into a future
            // session — only honor it within 10s of being set, and clear
            // it unconditionally on read.
            var selfTriggered = false;
            try {
                var raw = localStorage.getItem('mode-manager:reload-in-flight');
                if (raw !== null) {
                    var ts = parseInt(raw, 10);
                    selfTriggered = !isNaN(ts) && (Date.now() - ts) < 10000;
                    localStorage.removeItem('mode-manager:reload-in-flight');
                }
            } catch (e) {}

            // If this load is a brand-new game (no save name yet), drop any
            // __unsaved__ leftover from an abandoned prior session before we
            // do anything else. The user quit the previous map without saving
            // it, so its mod commits don't apply to anything — letting them
            // bleed into this fresh start would surprise the user. Done sync
            // so the cleanup runs before the panel can render stale data.
            //
            // Skipped on self-triggered hot reloads: the user is still in the
            // current session and just made a commit; wiping __unsaved__ here
            // would erase the very entry they're trying to add.
            if (!selfTriggered) {
                try {
                    if (api.gameState && typeof api.gameState.getSaveName === 'function' && !api.gameState.getSaveName()) {
                        localStorage.removeItem('mode-manager:' + UNSAVED_KEY);
                    }
                } catch (e) {}
            }

            // Register the panel once — addToolbarPanel appends a new button each
            // call, so calling it on every game load produces duplicate buttons.
            if (!panelRegistered) {
                api.ui.addToolbarPanel({
                    id: 'mode-manager',
                    icon: 'TrainTrack',
                    tooltip: 'Open Mode Manager',
                    title: 'Mode Manager',
                    width: 320,
                    render: function () {
                        return api.utils.React.createElement(ModeManagerPanel, null);
                    }
                });
                panelRegistered = true;
            }

            // Async: run any pending schema migrations, then register
            // committed train types and refresh lock state. Route ids are
            // read first so that any mode in use by an existing save but
            // missing from our committed bucket gets registered before the
            // engine tries to instantiate trains for it.
            runSchemaMigrations()
                .then(function () { return Promise.all([registry.getLibrary(), registry.getCommitted()]); })
                .then(function (results) {
                    var library   = results[0];
                    var committed = results[1];

                    var libraryMap = {};
                    library.forEach(function (m) { libraryMap[m.id] = m; });

                    var usedIds = {};
                    try {
                        var routes = api.gameState.getRoutes();
                        if (Array.isArray(routes)) {
                            routes.forEach(function (route) {
                                var typeId = route.trackType || route.trainTypeId || route.trainType;
                                if (typeId) usedIds[typeId] = true;
                            });
                        }
                        console.log('[Mode Manager] Train types with routes:', Object.keys(usedIds));
                    } catch (routeErr) {
                        console.warn('[Mode Manager] Could not query routes for lock check:', routeErr);
                    }

                    var inCommitted = {};
                    committed.forEach(function (c) { inCommitted[c.id] = true; });
                    var toRegister = committed.slice();
                    Object.keys(usedIds).forEach(function (id) {
                        if (inCommitted[id]) return;
                        // Snapshot inline so this load and the persisted bucket
                        // (written below by lockUsed) see the same definition.
                        var def = libraryMap[id];
                        toRegister.push(def
                            ? { id: id, locked: true, definition: withStatDefaults(def) }
                            : { id: id, locked: true });
                    });

                    var registered = 0;
                    toRegister.forEach(function (entry) {
                        // Prefer the per-save snapshot. Fall back to the live
                        // library only for legacy entries (pre-1.0.2 buckets
                        // that haven't been migrated yet, or self-healed
                        // entries the migration couldn't snapshot).
                        var def = entry.definition || libraryMap[entry.id];
                        if (!def) {
                            console.warn('[Mode Manager] Committed mode "' + entry.id + '" has no snapshot and is not in the library — skipping');
                            return;
                        }
                        // withStatDefaults fills geometry stats the legacy
                        // snapshot may have lacked (e.g. parallelTrackSpacing)
                        // so parallel/quad track preview doesn't crash.
                        var trainConfig = withStatDefaults(def);
                        delete trainConfig.schemaVersion;
                        delete trainConfig.revision;
                        delete trainConfig.tags;
                        try {
                            api.trains.registerTrainType(trainConfig);
                            registered++;
                        } catch (regErr) {
                            console.error('[Mode Manager] Failed to register "' + entry.id + '":', regErr);
                        }
                    });

                    return registry.lockUsed(usedIds).then(function () { return registered; });
                })
                .then(function (registered) {
                    console.log('[Mode Manager] active — ' + registered + ' mode' + (registered !== 1 ? 's' : '') + ' added');
                    try {
                        var raw = localStorage.getItem('mode-manager:pending-notification');
                        if (raw) {
                            localStorage.removeItem('mode-manager:pending-notification');
                            var pending = JSON.parse(raw);
                            api.ui.showNotification(pending.msg, pending.type);
                        }
                    } catch (e) {}

                    // For named-save loads, getCommitted's lazy migration above
                    // has already moved any pending __unsaved__ data into the
                    // current save's bucket. Anything still here belongs to a
                    // *different* abandoned new-game session and is orphaned —
                    // drop it so it doesn't migrate into some unrelated save
                    // later. (For new-game loads we already cleared sync above.)
                    if (currentBucketKey() !== UNSAVED_KEY) {
                        return storage.delete(UNSAVED_KEY).catch(function () {});
                    }
                })
                .catch(function (err) {
                    console.error('[Mode Manager] Mode registration error:', err);
                    api.ui.showNotification('Mode Manager: failed to add committed modes — check console', 'warning');
                });

        } catch (err) {
            console.error('[Mode Manager] Critical init error:', err);
            api.ui.showNotification('Mode Manager failed to initialize — check console', 'error');
        }
    });

    // Switching saves changes the storage bucket key. Tell any open panel to
    // refetch so it doesn't keep showing the previous save's committed list.
    if (typeof api.hooks.onGameLoaded === 'function') {
        api.hooks.onGameLoaded(function () {
            window.dispatchEvent(new CustomEvent('mode-manager:lock-changed'));
        });
    }

    // ─── REAL-TIME LOCK HOOKS ────────────────────────────────────────────────────
    // Lock a mode the moment tracks are built or a route is created, rather
    // than waiting for the next game reload.

    api.hooks.onTrackBuilt(function (tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) return;
        var seen = {};
        tracks.forEach(function (track) {
            var typeId = track.trackType;
            if (typeId && !seen[typeId]) {
                seen[typeId] = true;
                registry.lockMode(typeId)
                    .then(function () {
                        window.dispatchEvent(new CustomEvent('mode-manager:lock-changed'));
                    })
                    .catch(function (err) {
                        console.error('[Mode Manager] lockMode failed for "' + typeId + '":', err);
                    });
            }
        });
    });

    api.hooks.onRouteCreated(function (route) {
        if (!route) return;
        var typeId = route.trackType || route.trainTypeId || route.trainType;
        if (typeId) {
            registry.lockMode(typeId)
                .then(function () {
                    window.dispatchEvent(new CustomEvent('mode-manager:lock-changed'));
                })
                .catch(function (err) {
                    console.error('[Mode Manager] lockMode failed for "' + typeId + '":', err);
                });
        }
    });

})();
