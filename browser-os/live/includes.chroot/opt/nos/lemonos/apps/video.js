(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5l5 2.5-5 2.5v-5Z"/><path d="M3 9h18M3 15h18"/></svg>';

  Embed.register({
    id: 'video',
    name: 'Video Editor',
    shortName: 'Video',
    icon: ICON,
    width: 1140,
    height: 760,
    desktop: true,
    url: 'https://omniclip.app/',
    credit: 'Omniclip · MIT · runs on omniclip.app',
    note: 'Video Editor is Omniclip, an open-source editor built on the WebCodecs API. It runs entirely in your browser, needs no account, and never uploads your clips. Export from the timeline when you are done.'
  });
})();
