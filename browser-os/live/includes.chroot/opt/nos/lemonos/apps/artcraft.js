(function () {
  const BASE = 'https://lemonys-001.github.io/artcraft';

  const icons = {
    pdfcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M8.5 14h7"/><path d="M8.5 17h4"/></svg>',
    designcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/><circle cx="15" cy="15" r="2"/></svg>',
    effectcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6L15.5 18.5l2.6-.9L19 15Z"/></svg>',
    figcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg>',
    cadcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20L20 4"/><path d="M4 20h4M4 20v-4"/><path d="M14 4h6v6"/><circle cx="12" cy="12" r="1.5"/></svg>',
    lightcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    soundcraft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 11v2"/></svg>'
  };

  const entries = [
    { id: 'pdfcraft', name: 'PDF Editor', shortName: 'PDF', credit: 'PdfCraft · self-hosted · Apache-2.0', note: 'PdfCraft is a PDF editor and annotation tool. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'designcraft', name: 'Design', shortName: 'Design', credit: 'DesignCraft · self-hosted · Apache-2.0', note: 'DesignCraft is a graphic design and page layout tool. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'effectcraft', name: 'Video Effects', shortName: 'Effects', credit: 'EffectCraft · self-hosted · Apache-2.0', note: 'EffectCraft is a motion graphics and VFX compositor. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'figcraft', name: 'Interface Design', shortName: 'Interface', credit: 'FigCraft · self-hosted · Apache-2.0', note: 'FigCraft is a UI and diagram design tool. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'cadcraft', name: 'CAD', shortName: 'CAD', credit: 'CADCraft · self-hosted · Apache-2.0', note: 'CADCraft is a 2D/3D CAD and drafting tool. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'lightcraft', name: 'Photo Library', shortName: 'Library', credit: 'LightCraft · self-hosted · Apache-2.0', note: 'LightCraft is a RAW photo library and browser. Self-hosted on GitHub Pages, runs entirely in your browser.' },
    { id: 'soundcraft', name: 'Audio Editor', shortName: 'Audio', credit: 'SoundCraft · self-hosted · Apache-2.0', note: 'SoundCraft is a digital audio workstation. Self-hosted on GitHub Pages, runs entirely in your browser.' }
  ];

  entries.forEach((entry) => {
    Embed.register({
      id: entry.id,
      name: entry.name,
      shortName: entry.shortName,
      icon: icons[entry.id],
      width: 1120,
      height: 740,
      hidden: true,
      desktop: false,
      url: BASE + '/' + entry.id + '/',
      credit: entry.credit,
      note: entry.note
    });
  });
})();
