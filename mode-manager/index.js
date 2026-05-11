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
    // change to the on-disk storage layout requires a migration. The block
    // below runs each migration once per machine by comparing the stored
    // installed-version against MOD_VERSION.
    var MOD_VERSION = '1.0.1';
    try {
        var installedVersion = localStorage.getItem('mode-manager:installed-version');
        if (installedVersion !== MOD_VERSION) {
            // Pre-1.0.1 stored committed modes under a single global key,
            // which leaked the list into every new game. 1.0.1 keys per save
            // instead; existing saves recover via lockUsed's route-driven
            // self-heal on next load. Safe to run on a fresh install: the
            // legacy key simply won't exist.
            localStorage.removeItem('mode-manager:modes-committed');
            localStorage.setItem('mode-manager:installed-version', MOD_VERSION);
        }
    } catch (e) {}

    console.log('[Mode Manager] Loaded!');

    // ─── BUILTINS ────────────────────────────────────────────────────────────────

    const BUILTINS = [
        {
            id: 'tram',
            name: 'Tram',
            description: 'Lightweight tram for short-distance urban transit',
            source: 'builtin',
            version: '1.0.1',
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
                scissorsCrossoverCost: 2000000
            },
            compatibleTrackTypes: ['tram'],
            appearance: { color: '#f59e0b' },
            allowAtGradeRoadCrossing: true,
            tags: []
        },
        {
            id: 'brt',
            name: 'Bus Rapid Transit',
            description: 'High-capacity bus for dedicated rapid transit corridors',
            source: 'builtin',
            version: '1.0.1',
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
                scissorsCrossoverCost: 500000
            },
            compatibleTrackTypes: ['brt'],
            appearance: { color: '#ef4444' },
            allowAtGradeRoadCrossing: true,
            tags: ['bus']
        },
        {
            id: 'monorail',
            name: 'Monorail',
            description: 'Elevated monorail for scenic urban and resort transit',
            source: 'builtin',
            version: '1.0.1',
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
                scissorsCrossoverCost: 3000000
            },
            compatibleTrackTypes: ['monorail'],
            appearance: { color: '#8b5cf6' },
            allowAtGradeRoadCrossing: false,
            tags: []
        },
        {
            id: 'people-mover',
            name: 'People Mover',
            description: 'Automated people mover for short-distance elevated transit',
            source: 'builtin',
            version: '1.0.1',
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
                scissorsCrossoverCost: 1500000
            },
            compatibleTrackTypes: ['people-mover'],
            appearance: { color: '#3b82f6' },
            allowAtGradeRoadCrossing: false,
            tags: []
        }
    ];

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
    //   modes-imported          → ModeDefinition[]      global user-imported library
    //   committed:<saveName>    → { id, locked }[]      modes added to a specific save
    //   committed:__unsaved__   → { id, locked }[]      modes added in a brand-new game
    //                                                   before its first save; lazily
    //                                                   migrated into committed:<name>
    //                                                   when a save name first appears
    //   installed-version       → string                 last MOD_VERSION run on this
    //                                                    machine; drives schema migrations

    var UNSAVED_KEY = 'committed:__unsaved__';

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
                return BUILTINS.concat(Array.isArray(imported) ? imported : []);
            });
        },

        addImported: function (def) {
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported : [];
                list.push(Object.assign({}, def, { source: 'imported' }));
                return storage.set('modes-imported', list);
            });
        },

        removeImported: function (id) {
            return storage.get('modes-imported', []).then(function (imported) {
                var list = Array.isArray(imported) ? imported : [];
                return storage.set('modes-imported', list.filter(function (m) { return m.id !== id; }));
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
            return storage.get(key, []).then(function (committed) {
                var list = Array.isArray(committed) ? committed : [];
                if (!list.find(function (c) { return c.id === id; })) {
                    list.push({ id: id, locked: false });
                    return storage.set(key, list);
                }
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
            return storage.get(key, []).then(function (committed) {
                var list = Array.isArray(committed) ? committed : [];
                var seen = {};
                list.forEach(function (c) { seen[c.id] = true; });
                // Self-heal: a route in the save references a mode not in our
                // bucket → re-commit it as locked. Without this, existing saves
                // would lose their committed list during the global→per-save
                // key migration and routes would lose their train types.
                Object.keys(usedIds).forEach(function (id) {
                    if (!seen[id]) list.push({ id: id, locked: true });
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

            return { def: def };
        }
    };

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

        var tab         = tabState[0];         var setTab         = tabState[1];
        var library     = libraryState[0];     var setLibrary     = libraryState[1];
        var committed   = committedState[0];   var setCommitted   = committedState[1];
        var loadError   = loadErrorState[0];   var setLoadError   = loadErrorState[1];
        var importText  = importTextState[0];  var setImportText  = importTextState[1];
        var importError = importErrorState[0]; var setImportError = importErrorState[1];
        var actionError = actionErrorState[0]; var setActionError = actionErrorState[1];

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
            window.__modeManagerLoaded = false;
            api.reloadMods().catch(function (err) {
                console.error('[Mode Manager] reloadMods failed:', err);
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

        function handleRemoveImported(id) {
            setActionError(null);
            registry.removeImported(id)
                .then(reload)
                .catch(function (err) {
                    console.error('[Mode Manager] removeImported failed:', err);
                    setActionError('Failed to remove — ' + err.message);
                });
        }

        function handleImport() {
            var result = registry.validateImport(importText);
            if (result.error) { setImportError(result.error); return; }
            if (library.find(function (m) { return m.id === result.def.id; })) {
                setImportError('A mode with id "' + result.def.id + '" already exists.');
                return;
            }
            setImportError('');
            registry.addImported(result.def)
                .then(function () { reload(); setImportText(''); })
                .catch(function (err) {
                    console.error('[Mode Manager] addImported failed:', err);
                    setImportError('Failed to save import — ' + err.message);
                });
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
        var libraryRows = library.map(function (mode) {
            var isCommitted = !!committedIds[mode.id];
            return h('div', { key: mode.id, style: STYLES.row },
                h('div', null,
                    h('div', { style: STYLES.modeName }, mode.name)
                ),
                mode.source === 'imported'
                    ? h('button', {
                        title: isCommitted ? 'Cannot remove — added to a game' : 'Remove from library',
                        disabled: isCommitted,
                        onClick: function () { handleRemoveImported(mode.id); },
                        style: Object.assign({}, STYLES.iconBtn, {
                            color: isCommitted ? '#374151' : '#ef4444',
                            cursor: isCommitted ? 'not-allowed' : 'pointer'
                        })
                      }, icon(Trash2Icon, '🗑️'))
                    : null
            );
        });

        var importCanSubmit = importText.trim().length > 0;
        var libraryTab = h('div', null,
            h('div', null, libraryRows),
            h('div', { style: STYLES.divider },
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
            )
        );

        // ── This Save tab ────────────────────────────────────────────
        var committedEntries = committed.map(function (c) {
            return { id: c.id, locked: c.locked, def: library.find(function (m) { return m.id === c.id; }) };
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

            // Async: register committed train types then refresh lock state.
            // Route ids are read first so that any mode in use by an existing
            // save but missing from our committed bucket (e.g. after the v2
            // per-save key migration) gets registered before the engine tries
            // to instantiate trains for it.
            Promise.all([registry.getLibrary(), registry.getCommitted()])
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
                        if (!inCommitted[id]) toRegister.push({ id: id, locked: true });
                    });

                    var registered = 0;
                    toRegister.forEach(function (entry) {
                        var def = libraryMap[entry.id];
                        if (!def) {
                            console.warn('[Mode Manager] Committed mode "' + entry.id + '" not in library — skipping');
                            return;
                        }
                        var trainConfig = Object.assign({}, def);
                        delete trainConfig.source;
                        delete trainConfig.version;
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
    // Lock a mode the moment tracks are built or a route is created, rather than
    // waiting for the next game reload. The first event is logged in full so we
    // can confirm the Track/Route field names used to identify the train type.

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

    var routeShapeLogged = false;
    api.hooks.onRouteCreated(function (route) {
        if (!route) return;
        if (!routeShapeLogged) {
            console.log('[Mode Manager] onRouteCreated — Route object shape:', route);
            routeShapeLogged = true;
        }
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
