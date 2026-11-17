(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v3M9 21h6"/><path d="m7.5 12.5 2.6-3.2 2 2L17 6.8"/></svg>';

  Embed.register({
    id: 'slides',
    name: 'Slides',
    shortName: 'Slides',
    icon: ICON,
    width: 960,
    height: 640,
    desktop: true,
    url: 'https://lemonys-001.github.io/artcraft/deckcraft/',
    credit: 'DeckCraft · self-hosted · Apache-2.0',
    note: 'Slides runs DeckCraft, a full presentation editor. It is bundled with nOS and runs entirely in your browser.'
  });
})();
