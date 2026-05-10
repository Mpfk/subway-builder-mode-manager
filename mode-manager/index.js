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
            // TODO: register bundled train types and render mode picker UI
            console.log('[Mode Manager] Ready — mode picker not yet implemented');
            api.ui.showNotification('Mode Manager active', 'info');
        } catch (error) {
            console.error('[Mode Manager] Error:', error);
        }
    });
})();
