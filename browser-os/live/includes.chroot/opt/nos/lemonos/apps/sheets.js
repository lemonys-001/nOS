(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 15h16M10 4v16"/></svg>';

  Embed.register({
    id: 'sheets',
    name: 'Sheets',
    shortName: 'Sheets',
    icon: ICON,
    width: 960,
    height: 640,
    desktop: true,
    url: 'https://lemonys-001.github.io/artcraft/gridcraft/',
    credit: 'GridCraft · self-hosted · Apache-2.0',
    note: 'Sheets runs GridCraft, a full spreadsheet editor. It is bundled with nOS and runs entirely in your browser.'
  });
})();
