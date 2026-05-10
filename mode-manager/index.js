// Mode Manager - All-in-one transit mode selector for Subway Builder
(function () {
    const api = window.SubwayBuilderAPI;
    if (!api) {
        console.error('[Mode Manager] SubwayBuilderAPI not found!');
        return;
    }

    console.log('[Mode Manager] Loaded!');

    api.hooks.onGameInit(() => {
        try {
            api.ui.addToolbarPanel({
                id: 'mode-manager',
                icon: 'TrainTrack',
                tooltip: 'Open Mode Manager',
                title: 'Mode Manager',
                width: 320,
                render: () => {
                    const h = api.utils.React.createElement;
                    return h('div', { style: { padding: '16px' } },
                        'Mode selection coming soon.'
                    );
                }
            });

            console.log('[Mode Manager] Toolbar panel registered');
            api.ui.showNotification('Mode Manager active', 'success');
        } catch (error) {
            console.error('[Mode Manager] Error:', error);
        }
    });
})();
