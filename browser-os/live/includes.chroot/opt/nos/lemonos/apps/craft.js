(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>';

  const GROUPS = [
    {
      title: 'Office',
      apps: [
        { name: 'WordCraft', tag: 'Word processing', appId: 'word' },
        { name: 'GridCraft', tag: 'Spreadsheets', appId: 'sheets' },
        { name: 'DeckCraft', tag: 'Presentations', appId: 'slides' },
        { name: 'PdfCraft', tag: 'PDF editing', appId: 'pdfcraft' },
        { name: 'DesignCraft', tag: 'Page layout & publishing', appId: 'designcraft' }
      ]
    },
    {
      title: 'Image & design',
      apps: [
        { name: 'PhotoCraft', tag: 'Photo editor', appId: 'photoedit' },
        { name: 'VectorCraft', tag: 'Vector illustration', appId: 'draw' },
        { name: 'FigCraft', tag: 'Interface design', appId: 'figcraft' },
        { name: 'LightCraft', tag: 'RAW photo library', appId: 'lightcraft' },
        { name: 'EffectCraft', tag: 'Motion graphics & VFX', appId: 'effectcraft' }
      ]
    },
    {
      title: 'Video, audio, CAD',
      apps: [
        { name: 'FilmCraft', tag: 'Video editing', appId: null, unavailable: 'No web build available' },
        { name: 'SoundCraft', tag: 'Digital audio workstation', appId: 'soundcraft' },
        { name: 'CADCraft', tag: 'CAD & drafting', appId: 'cadcraft' }
      ]
    }
  ];

  const ORG = 'https://github.com/storytold';

  APPS.craft = {
    id: 'craft',
    name: 'ArtCraft Suite',
    shortName: 'ArtCraft',
    icon: ICON,
    width: 860,
    height: 640,
    singleton: true,
    desktop: false,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const scroll = UI.el('div', 'app-scroll craft-app');
      const status = UI.status();
      const grow = UI.el('span', 'app-status-grow', 'Self-hosted · Apache-2.0');
      const orgBtn = UI.btn('Source on GitHub');
      orgBtn.addEventListener('click', () => window.open(ORG, '_blank', 'noopener'));
      status.append(grow, orgBtn);

      const head = UI.el('header', 'craft-head');
      head.appendChild(UI.el('h1', 'craft-title', 'ArtCraft Suite'));
      head.appendChild(UI.el('p', 'craft-lede',
        'Twelve open-source editors compiled to WebAssembly. Every app runs entirely in your browser — files never leave this device. All apps are bundled with nOS.'));

      scroll.appendChild(head);

      GROUPS.forEach((group) => {
        const block = UI.el('section', 'craft-block');
        block.appendChild(UI.el('h2', 'craft-h', group.title));
        const list = UI.el('div', 'craft-list');
        group.apps.forEach((item) => {
          const row = UI.el('div', 'craft-row');
          const text = UI.el('div', 'craft-text');
          text.appendChild(UI.el('span', 'craft-name', item.name));
          text.appendChild(UI.el('span', 'craft-tag', item.tag));
          row.appendChild(text);
          if (item.appId) {
            const btn = UI.btn('Launch', 'primary');
            btn.addEventListener('click', () => WM.open(item.appId));
            row.appendChild(btn);
          } else {
            row.appendChild(UI.el('span', 'craft-tag', item.unavailable));
          }
          list.appendChild(row);
        });
        block.appendChild(list);
        scroll.appendChild(block);
      });

      shell.append(scroll, status);
      root.appendChild(shell);
      win.setTitle('ArtCraft Suite');
    }
  };
})();
