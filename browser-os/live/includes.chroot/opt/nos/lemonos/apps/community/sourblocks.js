(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>';
  const URL = 'https://sourblocks.lemonys.workers.dev/';

  CUSTOM_APPS.sourblocks = {
    id: 'sourblocks',
    name: 'SourBlocks',
    shortName: 'SourBlocks',
    icon: ICON,
    width: 1200,
    height: 800,
    singleton: true,
    desktop: true,

    mount(root, win) {
      Embed.mount(root, win, { name: 'SourBlocks', url: URL });
    }
  };
})();
