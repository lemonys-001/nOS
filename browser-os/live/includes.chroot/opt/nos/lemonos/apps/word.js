(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7"/><path d="M8.5 16.5h5"/></svg>';

  Embed.register({
    id: 'word',
    name: 'Writer',
    shortName: 'Writer',
    icon: ICON,
    width: 920,
    height: 620,
    desktop: true,
    url: 'https://lemonys-001.github.io/artcraft/wordcraft/',
    credit: 'WordCraft · self-hosted · Apache-2.0',
    note: 'Writer runs WordCraft, a full word processor. It is bundled with nOS and runs entirely in your browser.'
  });
})();
