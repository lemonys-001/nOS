(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-4-1L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14.5h5"/></svg>';
  const URL = 'https://hearth.lemonyss.dpdns.org/';

  APPS.lemonchat = {
    id: 'lemonchat',
    name: 'LemonChat',
    shortName: 'Chat',
    icon: ICON,
    width: 1120,
    height: 760,
    singleton: true,
    desktop: true,

    mount(root, win) {
      Embed.mount(root, win, { name: 'LemonChat', url: URL });
    }
  };
})();
