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

    // ─── REGISTRY ────────────────────────────────────────────────────────────────
    //
    // Storage keys (auto-namespaced by mod ID via api.storage):
    //   modes-imported   → ModeDefinition[]   global imported mode library
    //   modes-committed  → { id, locked }[]   modes added to any game save
    //
    // "locked" becomes true after a mode's first onGameInit registration,
    // meaning it may have been placed and cannot safely be removed.

    const storage = api.storage;

    const registry = {
        async getLibrary() {
            const imported = await storage.get('modes-imported', []);
            return [...BUILTINS, ...imported];
        },

        async addImported(def) {
            const imported = await storage.get('modes-imported', []);
            imported.push({ ...def, source: 'imported' });
            await storage.set('modes-imported', imported);
        },

        async removeImported(id) {
            const imported = await storage.get('modes-imported', []);
            await storage.set('modes-imported', imported.filter(m => m.id !== id));
        },

        async getCommitted() {
            return storage.get('modes-committed', []);
        },

        async commitMode(id) {
            const committed = await storage.get('modes-committed', []);
            if (!committed.find(c => c.id === id)) {
                committed.push({ id, locked: false });
                await storage.set('modes-committed', committed);
            }
        },

        async removeCommitted(id) {
            const committed = await storage.get('modes-committed', []);
            const entry = committed.find(c => c.id === id);
            if (entry && !entry.locked) {
                await storage.set('modes-committed', committed.filter(c => c.id !== id));
            }
        },

        // Called during onGameInit after registering all committed modes.
        // Marks every committed entry as locked — they have now been registered
        // and may have been placed in the game world.
        async lockAll() {
            const committed = await storage.get('modes-committed', []);
            await storage.set('modes-committed', committed.map(c => ({ ...c, locked: true })));
        },

        validateImport(jsonText) {
            let def;
            try {
                def = JSON.parse(jsonText);
            } catch (e) {
                return { error: 'Invalid JSON: ' + e.message };
            }

            if (!def || typeof def !== 'object' || Array.isArray(def)) {
                return { error: 'Definition must be a JSON object.' };
            }

            const missingTop = ['id', 'name', 'description', 'stats', 'compatibleTrackTypes', 'appearance']
                .filter(f => !(f in def));
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

            const missingStats = REQUIRED_STATS.filter(s => typeof def.stats[s] !== 'number');
            if (missingStats.length) {
                return { error: 'Missing or non-numeric stats: ' + missingStats.join(', ') + '.' };
            }

            return { def };
        }
    };

    // ─── UI ──────────────────────────────────────────────────────────────────────
    // React is accessed lazily inside ModeManagerPanel (not at module load time)
    // because api.utils may not be populated until after onGameInit fires.

    const STYLES = {
        root:       { padding: '12px 16px', color: '#f9fafb', fontFamily: 'inherit' },
        tabBar:     { display: 'flex', borderBottom: '1px solid #374151', marginBottom: '12px' },
        tab:        { flex: 1, padding: '8px', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '13px' },
        tabActive:  { borderBottom: '2px solid #60a5fa', color: '#60a5fa' },
        tabInactive:{ borderBottom: '2px solid transparent', color: '#6b7280' },
        row:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid #1f2937' },
        modeName:   { color: '#f9fafb', fontSize: '13px', fontWeight: '500' },
        modeSubtitle: { fontSize: '11px', marginTop: '2px' },
        sectionLabel: { color: '#6b7280', fontSize: '11px', marginBottom: '6px',
                        textTransform: 'uppercase', letterSpacing: '0.05em' },
        divider:    { borderTop: '1px solid #374151', paddingTop: '12px', marginTop: '4px' },
        iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '0 4px' },
        addBtn:     { padding: '4px 10px', border: 'none', borderRadius: '4px',
                      color: '#fff', cursor: 'pointer', fontSize: '11px', background: '#1d4ed8' },
        importBtn:  { marginTop: '6px', padding: '6px 12px', border: 'none',
                      borderRadius: '4px', fontSize: '12px' },
        textarea:   { width: '100%', height: '80px', background: '#111827',
                      border: '1px solid #374151', borderRadius: '4px', color: '#f9fafb',
                      padding: '6px', fontSize: '11px', fontFamily: 'monospace',
                      resize: 'vertical', boxSizing: 'border-box' },
        error:      { color: '#ef4444', fontSize: '11px', margin: '4px 0' },
        notice:     { marginTop: '12px', padding: '8px', background: '#1f2937',
                      borderRadius: '4px', color: '#f59e0b', fontSize: '11px' },
        empty:      { color: '#6b7280', fontSize: '12px', padding: '8px 0' }
    };

    function ModeManagerPanel() {
        const { createElement: h, useState, useEffect } = api.utils.React;

        if (typeof useState !== 'function' || typeof useEffect !== 'function') {
            return h('div', { style: STYLES.root },
                h('p', { style: { color: '#ef4444', fontSize: '13px' } },
                    'Mode Manager requires React 16.8+. Please update Subway Builder.')
            );
        }

        const [tab, setTab]             = useState('library');
        const [library, setLibrary]     = useState(null);
        const [committed, setCommitted] = useState(null);
        const [importText, setImportText] = useState('');
        const [importError, setImportError] = useState('');
        const [dirty, setDirty]         = useState(false);

        function reload() {
            Promise.all([registry.getLibrary(), registry.getCommitted()])
                .then(([lib, comm]) => { setLibrary(lib); setCommitted(comm); });
        }

        useEffect(() => { reload(); }, []);

        if (!library || !committed) {
            return h('div', { style: { ...STYLES.root, color: '#6b7280' } }, 'Loading...');
        }

        const committedIds = new Set(committed.map(c => c.id));

        function handleCommit(id) {
            registry.commitMode(id).then(() => { reload(); setDirty(true); });
        }

        function handleRemoveCommitted(id) {
            registry.removeCommitted(id).then(() => { reload(); setDirty(true); });
        }

        function handleRemoveImported(id) {
            registry.removeImported(id).then(reload);
        }

        function handleImport() {
            const result = registry.validateImport(importText);
            if (result.error) { setImportError(result.error); return; }
            if (library.find(m => m.id === result.def.id)) {
                setImportError(`A mode with id "${result.def.id}" already exists.`);
                return;
            }
            registry.addImported(result.def).then(() => {
                reload();
                setImportText('');
                setImportError('');
            });
        }

        // Tab bar
        const tabBar = h('div', { style: STYLES.tabBar },
            ['library', 'game'].map(t =>
                h('button', {
                    key: t,
                    onClick: () => setTab(t),
                    style: { ...STYLES.tab, ...(tab === t ? STYLES.tabActive : STYLES.tabInactive) }
                }, t === 'library' ? 'Library' : 'This Game')
            )
        );

        // ── Library tab ──────────────────────────────────────────────
        const libraryTab = h('div', null,
            library.map(mode =>
                h('div', { key: mode.id, style: STYLES.row },
                    h('div', null,
                        h('div', { style: STYLES.modeName }, mode.name),
                        h('div', { style: { ...STYLES.modeSubtitle, color: '#6b7280' } },
                            mode.source === 'builtin' ? 'Built-in' : 'Imported'
                        )
                    ),
                    mode.source === 'imported'
                        ? h('button', {
                            title: committedIds.has(mode.id) ? 'Cannot remove — added to a game' : 'Remove from library',
                            disabled: committedIds.has(mode.id),
                            onClick: () => handleRemoveImported(mode.id),
                            style: { ...STYLES.iconBtn,
                                color: committedIds.has(mode.id) ? '#374151' : '#ef4444',
                                cursor: committedIds.has(mode.id) ? 'not-allowed' : 'pointer' }
                          }, '✕')
                        : null
                )
            ),
            h('div', { style: STYLES.divider },
                h('div', { style: STYLES.sectionLabel }, 'Import a Mode'),
                h('textarea', {
                    value: importText,
                    onChange: e => { setImportText(e.target.value); setImportError(''); },
                    placeholder: '{ "id": "my-mode", "name": "My Mode", "stats": { ... }, ... }',
                    style: STYLES.textarea
                }),
                importError ? h('div', { style: STYLES.error }, importError) : null,
                h('button', {
                    onClick: handleImport,
                    disabled: !importText.trim(),
                    style: {
                        ...STYLES.importBtn,
                        background: importText.trim() ? '#2563eb' : '#1f2937',
                        color: importText.trim() ? '#fff' : '#6b7280',
                        cursor: importText.trim() ? 'pointer' : 'not-allowed'
                    }
                }, 'Add Mode')
            )
        );

        // ── This Game tab ────────────────────────────────────────────
        const committedEntries = committed.map(c => ({ ...c, def: library.find(m => m.id === c.id) }));
        const available = library.filter(m => !committedIds.has(m.id));

        const gameTab = h('div', null,
            committedEntries.length === 0
                ? h('div', { style: STYLES.empty }, 'No modes added to this game yet.')
                : h('div', { style: { marginBottom: '4px' } },
                    h('div', { style: STYLES.sectionLabel }, 'Active in this game'),
                    committedEntries.map(({ id, locked, def }) =>
                        h('div', { key: id, style: STYLES.row },
                            h('div', null,
                                h('div', { style: STYLES.modeName }, def ? def.name : id),
                                h('div', { style: { ...STYLES.modeSubtitle,
                                    color: locked ? '#f59e0b' : '#34d399' } },
                                    locked ? '🔒 In use — cannot remove' : 'Pending next load'
                                )
                            ),
                            !locked
                                ? h('button', {
                                    title: 'Remove from this game',
                                    onClick: () => handleRemoveCommitted(id),
                                    style: { ...STYLES.iconBtn, color: '#ef4444' }
                                  }, '✕')
                                : null
                        )
                    )
                  ),
            available.length > 0
                ? h('div', { style: STYLES.divider },
                    h('div', { style: STYLES.sectionLabel }, 'Available to add'),
                    available.map(mode =>
                        h('div', { key: mode.id, style: STYLES.row },
                            h('div', { style: { ...STYLES.modeName, color: '#9ca3af' } }, mode.name),
                            h('button', {
                                onClick: () => handleCommit(mode.id),
                                style: STYLES.addBtn
                            }, '+ Add')
                        )
                    )
                  )
                : null,
            dirty
                ? h('div', { style: STYLES.notice }, '⚠ Changes apply on next game load')
                : null
        );

        return h('div', { style: STYLES.root },
            tabBar,
            tab === 'library' ? libraryTab : gameTab
        );
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────

    api.hooks.onGameInit(async () => {
        try {
            const [library, committed] = await Promise.all([
                registry.getLibrary(),
                registry.getCommitted()
            ]);

            const libraryMap = new Map(library.map(m => [m.id, m]));
            let registered = 0;

            for (const { id } of committed) {
                const def = libraryMap.get(id);
                if (!def) {
                    console.warn(`[Mode Manager] Committed mode "${id}" missing from library — skipping`);
                    continue;
                }
                const { source, version, ...trainConfig } = def;
                api.trains.registerTrainType(trainConfig);
                registered++;
            }

            // Lock all committed entries — they have now been registered and
            // may have been placed in the game world.
            await registry.lockAll();

            api.ui.addToolbarPanel({
                id: 'mode-manager',
                icon: 'TrainTrack',
                tooltip: 'Open Mode Manager',
                title: 'Mode Manager',
                width: 320,
                render: () => h(ModeManagerPanel, null)
            });

            console.log(`[Mode Manager] ${registered} mode(s) registered`);
            api.ui.showNotification(
                `Mode Manager active — ${registered} mode${registered !== 1 ? 's' : ''} registered`,
                'success'
            );
        } catch (error) {
            console.error('[Mode Manager] Error:', error);
        }
    });

})();
