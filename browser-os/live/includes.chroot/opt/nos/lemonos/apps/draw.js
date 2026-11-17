(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5Z"/><path d="M13.5 6.5l4 4"/></svg>';

  Embed.register({
    id: 'draw',
    name: 'Draw',
    shortName: 'Draw',
    icon: ICON,
    width: 1100,
    height: 740,
    desktop: true,
    sources: [
      { label: 'VectorCraft', url: 'https://lemonys-001.github.io/artcraft/vectorcraft/', default: true },
      { label: 'Excalidraw', url: 'https://excalidraw.com/' }
    ],
    url: 'https://lemonys-001.github.io/artcraft/vectorcraft/',
    credit: 'VectorCraft · self-hosted · Apache-2.0',
    note: 'Draw runs VectorCraft, a vector illustration editor. It is bundled with nOS and runs entirely in your browser. Switch the source to Excalidraw for a freehand whiteboard.'
  });
})();
