(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-5.5 5.5L8 15l-5 3"/></svg>';

  Embed.register({
    id: 'photoedit',
    name: 'Photo Editor',
    shortName: 'Photos',
    icon: ICON,
    width: 1120,
    height: 740,
    desktop: true,
    sources: [
      { label: 'PhotoCraft', url: 'https://lemonys-001.github.io/artcraft/photocraft/', default: true },
      { label: 'Photopea', url: 'https://www.photopea.com/' }
    ],
    url: 'https://lemonys-001.github.io/artcraft/photocraft/',
    credit: 'PhotoCraft · self-hosted · Apache-2.0',
    note: 'Photo Editor runs PhotoCraft, a photo and raster editor. It is bundled with nOS and runs entirely in your browser. Switch the source to Photopea for PSD support.'
  });

  Embed.register({
    id: 'photopea',
    name: 'Photopea',
    shortName: 'Photopea',
    icon: ICON,
    width: 1120,
    height: 740,
    desktop: false,
    hidden: true,
    url: 'https://www.photopea.com/',
    credit: 'Photopea · photopea.com',
    note: 'Photopea is a free web image editor with PSD/AI/XCF support, run from photopea.com in a frame.'
  });
})();
