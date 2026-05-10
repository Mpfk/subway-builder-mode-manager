// Mode Manager - All-in-one transit mode selector for Subway Builder
(function () {
    'use strict';

    const api = window.SubwayBuilderAPI;
    if (!api) {
        console.error('[Mode Manager] SubwayBuilderAPI not found!');
        return;
    }

    console.log('[Mode Manager] Loaded!');

    // ─── BUILTINS ────────────────────────────────────────────────────────────────

    const BUILTINS = [
        {
            id: 'tram',
            name: 'Tram',
            description: 'Lightweight tram for short-distance urban transit',
            source: 'builtin',
            version: '1.0.0',
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
            allowAtGradeRoadCrossing: true
        },
        {
            id: 'brt',
            name: 'Bus Rapid Transit',
            description: 'High-capacity bus for dedicated rapid transit corridors',
            source: 'builtin',
            version: '1.0.0',
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
            allowAtGradeRoadCrossing: true
        },
        {
            id: 'monorail',
            name: 'Monorail',
            description: 'Elevated monorail for scenic urban and resort transit',
            source: 'builtin',
            version: '1.0.0',
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
            allowAtGradeRoadCrossing: false
        },
        {
            id: 'people-mover',
            name: 'People Mover',
            description: 'Automated people mover for short-distance elevated transit',
            source: 'builtin',
            version: '1.0.0',
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
            allowAtGradeRoadCrossing: false
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
    // Use api.storage when available. Fall back to an in-memory store so the rest
    // of the mod works (without persistence) if the API surface is missing.

    var storage = (function () {
        if (api.storage && typeof api.storage.get === 'function') {
            return api.storage;
        }
        console.warn('[Mode Manager] api.storage unavailable — falling back to in-memory store (state will not persist)');
        var mem = {};
        return {
            get: function (key, defaultValue) {
                return Promise.resolve(key in mem ? mem[key] : defaultValue);
            },
            set: function (key, value) {
                mem[key] = value;
                return Promise.resolve();
            },
            delete: function (key) {
                delete mem[key];
                return Promise.resolve();
            },
            keys: function () {
                return Promise.resolve(Object.keys(mem));
            }
        };
    })();

    // ─── REGISTRY ────────────────────────────────────────────────────────────────
    // Storage keys (auto-namespaced by mod ID via api.storage):
    //   modes-imported   → ModeDefinition[]      global user-imported library
    //   modes-committed  → { id, locked }[]      modes added to this game

    var registry = {
        getLibrary: function () {
            return storage.get('modes-imported', []).then(function (imported) {
                return BUILTINS.concat(imported);
            });
        },

        addImported: function (def) {
            return storage.get('modes-imported', []).then(function (imported) {
                imported.push(Object.assign({}, def, { source: 'imported' }));
                return storage.set('modes-imported', imported);
            });
        },

        removeImported: function (id) {
            return storage.get('modes-imported', []).then(function (imported) {
                return storage.set('modes-imported', imported.filter(function (m) { return m.id !== id; }));
            });
        },

        getCommitted: function () {
            return storage.get('modes-committed', []);
        },

        commitMode: function (id) {
            return storage.get('modes-committed', []).then(function (committed) {
                if (!committed.find(function (c) { return c.id === id; })) {
                    committed.push({ id: id, locked: false });
                    return storage.set('modes-committed', committed);
                }
            });
        },

        removeCommitted: function (id) {
            return storage.get('modes-committed', []).then(function (committed) {
                var entry = committed.find(function (c) { return c.id === id; });
                if (entry && !entry.locked) {
                    return storage.set('modes-committed', committed.filter(function (c) { return c.id !== id; }));
                }
            });
        },

        lockAll: function () {
            return storage.get('modes-committed', []).then(function (committed) {
                return storage.set('modes-committed', committed.map(function (c) {
                    return Object.assign({}, c, { locked: true });
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
        modeSubtitle: { fontSize: '11px', marginTop: '2px' },
        sectionLabel: { color: '#6b7280', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
        divider:      { borderTop: '1px solid #374151', paddingTop: '12px', marginTop: '4px' },
        iconBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '0 4px' },
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
        var dirtyState       = useState(false);

        var tab         = tabState[0];         var setTab         = tabState[1];
        var library     = libraryState[0];     var setLibrary     = libraryState[1];
        var committed   = committedState[0];   var setCommitted   = committedState[1];
        var loadError   = loadErrorState[0];   var setLoadError   = loadErrorState[1];
        var importText  = importTextState[0];  var setImportText  = importTextState[1];
        var importError = importErrorState[0]; var setImportError = importErrorState[1];
        var actionError = actionErrorState[0]; var setActionError = actionErrorState[1];
        var dirty       = dirtyState[0];       var setDirty       = dirtyState[1];

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

        // Loading state
        if (!library || !committed) {
            return h('div', { style: Object.assign({}, STYLES.root, { color: '#6b7280' }) }, 'Loading...');
        }

        var committedIds = {};
        committed.forEach(function (c) { committedIds[c.id] = true; });

        function handleCommit(id) {
            setActionError(null);
            registry.commitMode(id)
                .then(function () { reload(); setDirty(true); })
                .catch(function (err) {
                    console.error('[Mode Manager] commitMode failed:', err);
                    setActionError('Failed to save — ' + err.message);
                });
        }

        function handleRemoveCommitted(id) {
            setActionError(null);
            registry.removeCommitted(id)
                .then(function () { reload(); setDirty(true); })
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
            ? h('div', { style: STYLES.warnBox }, '⚠ ' + loadError)
            : null;

        var actionErrorBanner = actionError
            ? h('div', { style: Object.assign({}, STYLES.warnBox, { color: '#ef4444' }) }, '✕ ' + actionError)
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
                    h('div', { style: STYLES.modeName }, mode.name),
                    h('div', { style: Object.assign({}, STYLES.modeSubtitle, { color: '#6b7280' }) },
                        mode.source === 'builtin' ? 'Built-in' : 'Imported'
                    )
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
                      }, '✕')
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
                            h('div', { style: STYLES.modeName }, entry.def ? entry.def.name : entry.id),
                            h('div', { style: Object.assign({}, STYLES.modeSubtitle, { color: entry.locked ? '#f59e0b' : '#34d399' }) },
                                entry.locked ? '🔒 In use — cannot remove' : 'Pending next load'
                            )
                        ),
                        !entry.locked
                            ? h('button', {
                                title: 'Remove from this game',
                                onClick: function () { handleRemoveCommitted(entry.id); },
                                style: Object.assign({}, STYLES.iconBtn, { color: '#ef4444' })
                              }, '✕')
                            : null
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
            availableSection,
            dirty ? h('div', { style: STYLES.notice }, '⚠ Mode added, press Control + Shift + R to reload and enable.') : null
        );

        return h('div', { style: STYLES.root },
            loadErrorBanner,
            actionErrorBanner,
            tabBar,
            tab === 'save' ? saveTab : libraryTab
        );
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────
    // onGameInit callback is synchronous. The toolbar panel is registered first so
    // it always appears. Mode registration runs asynchronously afterward and does
    // not block panel visibility.

    api.hooks.onGameInit(function () {
        try {
            // Register the panel immediately — synchronous, always runs regardless
            // of whether storage or train registration succeeds.
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

            // Async: register committed train types. Failures are logged and
            // surfaced via notification but do not affect panel availability.
            Promise.all([registry.getLibrary(), registry.getCommitted()])
                .then(function (results) {
                    var library   = results[0];
                    var committed = results[1];

                    var libraryMap = {};
                    library.forEach(function (m) { libraryMap[m.id] = m; });

                    var registered = 0;
                    committed.forEach(function (entry) {
                        var def = libraryMap[entry.id];
                        if (!def) {
                            console.warn('[Mode Manager] Committed mode "' + entry.id + '" not in library — skipping');
                            return;
                        }
                        // Strip metadata fields before passing to the game API
                        var trainConfig = Object.assign({}, def);
                        delete trainConfig.source;
                        delete trainConfig.version;
                        try {
                            api.trains.registerTrainType(trainConfig);
                            registered++;
                        } catch (regErr) {
                            console.error('[Mode Manager] Failed to register "' + entry.id + '":', regErr);
                        }
                    });

                    return registry.lockAll().then(function () { return registered; });
                })
                .then(function (registered) {
                    var msg = 'Mode Manager active';
                    if (registered > 0) {
                        msg += ' — ' + registered + ' mode' + (registered !== 1 ? 's' : '') + ' registered';
                    }
                    console.log('[Mode Manager] ' + msg);
                    api.ui.showNotification(msg, 'success');
                })
                .catch(function (err) {
                    console.error('[Mode Manager] Mode registration error:', err);
                    api.ui.showNotification('Mode Manager: failed to register committed modes — check console', 'warning');
                });

        } catch (err) {
            console.error('[Mode Manager] Critical init error:', err);
            api.ui.showNotification('Mode Manager failed to initialize — check console', 'error');
        }
    });

})();
