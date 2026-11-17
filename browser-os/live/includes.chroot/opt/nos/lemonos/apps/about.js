(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';

  const STACK = [
    ['shell', 'Vanilla JavaScript. No framework, no bundler, no build command.'],
    ['apps', 'Standalone scripts that register with the global APPS registry.'],
    ['hosting', 'Cloudflare Workers, serving the app from the edge as static assets.'],
    ['api', 'A Cloudflare Worker handling GET, POST, and DELETE at /api/store.'],
    ['storage', 'Cloudflare Workers KV for native app data; Firebase Authentication for accounts.'],
    ['auth', 'Google and email sign-in through Firebase Authentication, or a guest identity kept locally.']
  ];

  function cfg() {
    return typeof CONFIG !== 'undefined' ? CONFIG : {};
  }

  APPS.about = {
    id: 'about',
    name: 'About nOS',
    shortName: 'About',
    icon: ICON,
    width: 660,
    height: 600,
    singleton: true,
    desktop: false,

    mount(root, win) {
      const c = cfg();
      const shell = UI.el('div', 'app');
      const scroll = UI.el('div', 'app-scroll about-app');
      const status = UI.status();
      const brand = UI.el('span', null, c.name || 'nOS');
      const ver = UI.el('span', 'app-status-grow', 'Version ' + (c.version || '1.0.0'));
      status.append(brand, ver);

      const head = UI.el('header', 'about-head');
      const wheel = UI.el('span', 'about-wheel');
      wheel.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#lemon-wheel"></use></svg>';
      const hgroup = UI.el('div');
      hgroup.appendChild(UI.el('h1', 'about-title', c.name || 'nOS'));
      hgroup.appendChild(UI.el('p', 'about-tagline', c.tagline || 'A modular operating system that lives in your browser'));
      head.append(wheel, hgroup);

      const intro = UI.el('p', 'about-lede',
        'A desktop that runs in a browser tab: real overlapping windows, a taskbar with a start menu, and native apps that share one storage layer. Sign in with Google or email to sync native app data, or stay a guest and keep it in this browser. Embedded apps run on their own hosts.');

      const arch = UI.el('section', 'about-block');
      arch.appendChild(UI.el('h2', 'about-h', 'Architecture'));
      const dl = UI.el('dl', 'stack');
      STACK.forEach(([term, desc]) => {
        const row = UI.el('div', 'stack-row');
        row.appendChild(UI.el('dt', null, term));
        row.appendChild(UI.el('dd', null, desc));
        dl.appendChild(row);
      });
      arch.appendChild(dl);

      const appsBlock = UI.el('section', 'about-block');
      appsBlock.appendChild(UI.el('h2', 'about-h', 'Built-in apps'));
      const list = UI.el('ul', 'about-apps');
      Object.keys(APPS)
        .filter((id) => id !== 'viewer' && APPS[id] && APPS[id].hidden !== true)
        .forEach((id) => list.appendChild(UI.el('li', null, APPS[id].name || id)));
      appsBlock.appendChild(list);

      const webBlock = UI.el('section', 'about-block');
      webBlock.appendChild(UI.el('h2', 'about-h', 'Web editors'));
      webBlock.appendChild(UI.el('p', 'about-lede',
        'Writer, Sheets, Slides, Draw, Photo Editor, Video Editor, and the ArtCraft Suite open editors from their own hosts inside a sandboxed frame. Their files are handled by those editors rather than by Workers KV.'));
      const toolList = UI.el('ul', 'about-apps');
      const tools = (typeof Embed !== 'undefined' && Embed.tools) ? Embed.tools : [];
      tools.forEach((t) => {
        let host = t.url;
        try { host = new URL(t.url).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
        toolList.appendChild(UI.el('li', null, t.name + ' — ' + (t.credit || host)));
      });
      if (!tools.length) toolList.appendChild(UI.el('li', null, 'None loaded in this session.'));
      webBlock.appendChild(toolList);

      const credits = UI.el('section', 'about-block');
      credits.appendChild(UI.el('h2', 'about-h', 'Credits'));
      credits.appendChild(UI.el('p', 'about-lede',
        'Typefaces: Syne for display, JetBrains Mono for code. Icons are drawn inline as SVG. Built with the platform: HTML, CSS, and plain JavaScript — no third-party UI runtime.'));

      scroll.append(head, intro, arch, appsBlock, webBlock, credits);
      shell.append(scroll, status);
      root.appendChild(shell);
      win.setTitle(c.name || 'nOS');
    }
  };
})();
