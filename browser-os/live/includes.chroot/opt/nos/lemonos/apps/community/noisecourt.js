(function () {
  const ICON = '<svg viewBox="0 0 32 32" role="img" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="8" fill="#262a33"/><text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#e05252">n</text></svg>';
  const URL = 'https://noise-court.lemonys.workers.dev/';

  CUSTOM_APPS.noisecourt = {
    id: 'noisecourt',
    name: 'Noise Court',
    shortName: 'Noise',
    icon: ICON,
    width: 1200,
    height: 800,
    singleton: true,
    desktop: true,

    mount(root, win) {
      Embed.mount(root, win, { name: 'Noise Court', url: URL });
    }
  };
})();
