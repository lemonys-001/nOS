(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 11a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 19L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';
  const SOURBLOCKS = {
    id: 'sourblocks',
    name: 'SourBlocks',
    note: 'Build and play block worlds with friends.',
    glyph: '\u{1F9F1}',
    url: new URL('apps/community/sourblocks.js', location.href).href
  };

  function wm() {
    return typeof WM !== 'undefined' ? WM : { refreshLauncher() {}, open() {} };
  }

  function apiBase() {
    if (typeof Auth !== 'undefined' && Auth.apiBase) return Auth.apiBase();
    const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
    return String(cfg.apiBase || '/api/store').replace(/\/store\/?$/, '');
  }

  function scriptUrl(id) {
    return apiBase() + '/community/' + encodeURIComponent(id) + '.js';
  }

  async function fetchPublished() {
    try {
      const res = await fetch(apiBase() + '/community');
      const body = await res.json();
      return body && body.ok && Array.isArray(body.apps) ? body.apps : [];
    } catch {
      return [];
    }
  }

  async function getInstalled() {
    const list = await Store.get('appstore', 'installed', []);
    return Array.isArray(list) ? list : [];
  }

  function loadScript(url) {
    return new Promise((resolve) => {
      const before = Object.keys(CUSTOM_APPS);
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.setAttribute('data-community', url);
      script.onload = () => resolve({ ok: true, ids: Object.keys(CUSTOM_APPS).filter((k) => !before.includes(k)) });
      script.onerror = () => resolve({ ok: false, ids: [] });
      document.head.appendChild(script);
    });
  }

  async function commit(url, ids, meta) {
    const list = await getInstalled();
    ids.forEach((id) => {
      if (list.some((x) => x.id === id && x.url === url)) return;
      const app = CUSTOM_APPS[id];
      const m = (meta && meta[id]) || {};
      const entry = { id, url, name: m.name || (app && app.name) || id, addedAt: Date.now() };
      if (m.glyph) entry.glyph = m.glyph;
      else if (m.icon) entry.icon = m.icon;
      list.push(entry);
    });
    await Store.set('appstore', 'installed', list);
    wm().refreshLauncher();
  }

  async function install(url, opts) {
    const options = opts || {};
    const res = await loadScript(url);
    if (!res.ok) {
      if (!options.silent) UI.toast('Could not load that script');
      return null;
    }
    if (!res.ids.length) {
      if (!options.silent) UI.toast('That script registered no app');
      return null;
    }
    await commit(url, res.ids, options.meta);
    if (!options.silent) UI.toast('Installed ' + res.ids.length + ' app' + (res.ids.length === 1 ? '' : 's'));
    return res.ids;
  }

  const DEFAULT_GLYPHS = ['\u{1F4E6}', '\u{1F9E9}', '\u2B50', '\u{1F527}', '\u{1F39B}', '\u{1F579}'];

  function pickAppMeta(app, id) {
    return new Promise((resolve) => {
      const { box, close } = UI.modal({ onClose: resolve });
      box.appendChild(UI.el('p', 'os-modal-msg', 'Add “' + ((app && app.name) || id) + '”'));
      box.appendChild(UI.el('p', 'set-hint', 'Give it a name and pick an icon. These are only labels — the app keeps working the same.'));

      const nameWrap = UI.el('label', 'set-field');
      nameWrap.appendChild(UI.el('span', 'set-hint', 'Name'));
      const nameInput = UI.field((app && app.name) || id, 'App name');
      nameWrap.appendChild(nameInput);
      box.appendChild(nameWrap);

      box.appendChild(UI.el('span', 'set-hint', 'Icon'));
      const icoRow = UI.el('div', 'icon-pick');
      const appIcon = app && app.icon;
      let chosen = appIcon ? { icon: appIcon } : null;
      const addOption = (value, label, selected) => {
        const b = UI.el('button', 'icon-pick-btn' + (selected ? ' sel' : ''));
        b.type = 'button';
        if (value.icon) b.innerHTML = value.icon;
        else b.textContent = label;
        b.addEventListener('click', () => {
          chosen = value;
          [...icoRow.children].forEach((c) => c.classList.remove('sel'));
          b.classList.add('sel');
        });
        icoRow.appendChild(b);
      };
      if (appIcon) addOption({ icon: appIcon }, '', true);
      DEFAULT_GLYPHS.forEach((g) => addOption({ glyph: g }, g, !appIcon && g === DEFAULT_GLYPHS[0]));
      box.appendChild(icoRow);

      const row = UI.el('div', 'os-modal-row');
      const cancel = UI.btn('Cancel');
      const add = UI.btn('Add', 'primary');
      row.append(cancel, add);
      box.appendChild(row);
      cancel.onclick = () => close(null);
      add.onclick = () => {
        const name = nameInput.value.trim() || (app && app.name) || id;
        close(Object.assign({ name }, chosen || {}));
      };
      nameInput.focus();
      nameInput.select();
    });
  }

  async function uninstall(id) {
    const list = await getInstalled();
    const entry = list.find((x) => x.id === id);
    delete CUSTOM_APPS[id];
    if (entry) {
      const stillUsed = list.some((x) => x.id !== id && x.url === entry.url);
      if (!stillUsed) {
        document.querySelectorAll('script[data-community]').forEach((s) => {
          if (s.getAttribute('data-community') === entry.url) s.remove();
        });
      }
    }
    await Store.set('appstore', 'installed', list.filter((x) => x.id !== id));
    wm().refreshLauncher();
    UI.toast('Removed');
  }

  async function restore() {
    const list = await getInstalled();
    const urls = [...new Set(list.map((x) => x.url))];
    for (const url of urls) await install(url, { silent: true });
    wm().refreshLauncher();
  }

  if (typeof window !== 'undefined') {
    window.CommunityApps = { restore, install, commit, uninstall, getInstalled };
  }

  APPS.appstore = {
    id: 'appstore',
    name: 'App Store',
    shortName: 'Store',
    icon: ICON,
    width: 900,
    height: 640,
    singleton: true,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const scroll = UI.el('div', 'app-scroll store');
      const status = UI.status();
      const statusNote = UI.el('span', 'app-status-grow', '');
      status.appendChild(statusNote);

      const addBtn = UI.btn('Add app by URL', 'primary');
      bar.append(UI.el('span', 'app-bar-title', 'App Store'), UI.el('span', 'app-status-grow'), addBtn);

      function builtins() {
        const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
        const guest = !session || session.provider === 'guest';
        return Object.keys(APPS)
          .filter((id) => id !== 'viewer' && id !== 'appstore' && APPS[id] && APPS[id].hidden !== true
            && !(APPS[id].requiresAuth && guest))
          .map((id) => ({ id, name: APPS[id].name || id, icon: APPS[id].icon }));
      }

      function card(opts) {
        const el = UI.el('div', 'store-card');
        const ico = UI.el('span', 'store-icon');
        if (opts.glyph) {
          ico.className = 'store-icon glyph';
          ico.textContent = opts.glyph;
        } else {
          ico.innerHTML = opts.icon || ICON;
        }
        const body = UI.el('div', 'store-body');
        body.appendChild(UI.el('h3', 'store-name', opts.name));
        if (opts.note) body.appendChild(UI.el('p', 'store-note', opts.note));
        const actions = UI.el('div', 'store-actions');
        if (opts.onInstall) {
          const inst = UI.btn('Install', 'primary');
          inst.addEventListener('click', opts.onInstall);
          actions.appendChild(inst);
        }
        if (opts.onOpen) {
          const open = UI.btn('Open', 'primary');
          open.addEventListener('click', opts.onOpen);
          actions.appendChild(open);
        }
        if (opts.onRemove) {
          const rm = UI.btn('Remove', 'danger');
          rm.addEventListener('click', opts.onRemove);
          actions.appendChild(rm);
        }
        el.append(ico, body, actions);
        return el;
      }

      async function installPublished(app) {
        const ok = await UI.confirm(
          'Community apps run with the same access as nOS itself and your data. Install “' + app.name + '”?',
          { confirmLabel: 'Install', danger: false }
        );
        if (!ok) return;
        statusNote.textContent = 'Installing…';
        const ids = await install(scriptUrl(app.id));
        await render();
        return ids;
      }

      async function render() {
        scroll.textContent = '';
        const list = await getInstalled();

        const feat = UI.el('section', 'store-block');
        feat.appendChild(UI.el('h2', 'store-h', 'Built in'));
        feat.appendChild(UI.el('p', 'store-hint', 'Ships with nOS. Open any app, or find it in the start menu.'));
        const fgrid = UI.el('div', 'store-grid');
        builtins().forEach((app) => {
          fgrid.appendChild(card({
            name: app.name,
            icon: app.icon,
            note: 'Included',
            onOpen: () => wm().open(app.id)
          }));
        });
        feat.appendChild(fgrid);
        scroll.appendChild(feat);

        const gameInstalled = list.some((x) => x.url === SOURBLOCKS.url);
        const games = UI.el('section', 'store-block');
        games.appendChild(UI.el('h2', 'store-h', 'Games'));
        games.appendChild(UI.el('p', 'store-hint',
          'Downloadable apps that run in their own window. Install one to add it to the desktop and start menu.'));
        const ggrid = UI.el('div', 'store-grid');
        ggrid.appendChild(card({
          name: SOURBLOCKS.name,
          glyph: SOURBLOCKS.glyph,
          note: SOURBLOCKS.note + (gameInstalled ? ' · Installed' : ''),
          onInstall: gameInstalled ? null : async () => {
            statusNote.textContent = 'Installing…';
            await install(SOURBLOCKS.url, { meta: { [SOURBLOCKS.id]: { name: SOURBLOCKS.name, glyph: SOURBLOCKS.glyph } } });
            await render();
          },
          onOpen: gameInstalled ? () => wm().open(SOURBLOCKS.id) : null,
          onRemove: gameInstalled ? async () => {
            const ok = await UI.confirm('Remove “' + SOURBLOCKS.name + '”?', { confirmLabel: 'Remove' });
            if (!ok) return;
            await uninstall(SOURBLOCKS.id);
            await render();
          } : null
        }));
        games.appendChild(ggrid);
        scroll.appendChild(games);

        const webTools = (typeof Embed !== 'undefined' && Embed.tools ? Embed.tools : [])
          .filter((tool) => APPS[tool.id] && APPS[tool.id].hidden === true);
        if (webTools.length) {
          const web = UI.el('section', 'store-block');
          web.appendChild(UI.el('h2', 'store-h', 'Web editors'));
          web.appendChild(UI.el('p', 'store-hint',
            'Full editors that run on their own site inside a nOS window. Open one whenever the built-in apps are not enough.'));
          const wgrid = UI.el('div', 'store-grid');
          webTools.forEach((tool) => {
            wgrid.appendChild(card({
              name: tool.name,
              icon: APPS[tool.id].icon,
              note: tool.credit || 'Web editor',
              onOpen: () => wm().open(tool.id)
            }));
          });
          web.appendChild(wgrid);
          scroll.appendChild(web);
        }

        const disc = UI.el('section', 'store-block');
        disc.appendChild(UI.el('h2', 'store-h', 'Community apps'));
        disc.appendChild(UI.el('p', 'store-hint',
          'Apps published to nOS by other users. Community apps run with the same access as nOS itself — only install code you trust.'));
        const published = await fetchPublished();
        if (!published.length) {
          disc.appendChild(UI.el('div', 'store-empty', 'Nothing published yet. Open Lemon Code, load the app template, and press Publish.'));
        } else {
          const dgrid = UI.el('div', 'store-grid');
          published.forEach((app) => {
            const installed = list.some((x) => x.url === scriptUrl(app.id));
            dgrid.appendChild(card({
              name: app.name,
              glyph: app.glyph,
              note: (app.author ? '@' + app.author : 'Anonymous') + (installed ? ' · Installed' : ''),
              onInstall: installed ? null : () => installPublished(app)
            }));
          });
          disc.appendChild(dgrid);
        }
        scroll.appendChild(disc);

        const comm = UI.el('section', 'store-block');
        comm.appendChild(UI.el('h2', 'store-h', 'Installed'));
        comm.appendChild(UI.el('p', 'store-hint',
          'Community apps on this device, or add one by its script URL.'));
        if (!list.length) {
          const box = UI.el('div', 'store-empty', 'No community apps installed yet.');
          comm.appendChild(box);
        } else {
          const cgrid = UI.el('div', 'store-grid');
          list.forEach((entry) => {
            const app = CUSTOM_APPS[entry.id];
            cgrid.appendChild(card({
              name: entry.name || entry.id,
              icon: entry.icon || (app && app.icon) || ICON,
              glyph: entry.glyph,
              note: entry.url,
              onOpen: app ? () => wm().open(entry.id) : null,
              onRemove: async () => {
                const ok = await UI.confirm('Remove “' + (entry.name || entry.id) + '”?', { confirmLabel: 'Remove' });
                if (!ok) return;
                await uninstall(entry.id);
                render();
              }
            }));
          });
          comm.appendChild(cgrid);
        }
        scroll.appendChild(comm);

        statusNote.textContent = list.length + ' installed · ' + builtins().length + ' built in';
      }

      addBtn.addEventListener('click', async () => {
        const url = await UI.prompt('Enter the URL of the app script to install', { placeholder: 'https://example.com/my-app.js', confirmLabel: 'Continue' });
        if (!url) return;
        const ok = await UI.confirm('Community apps run with full access to this page and your data. Only install scripts you trust. Install now?', { confirmLabel: 'Install' });
        if (!ok) return;
        statusNote.textContent = 'Installing…';
        const res = await loadScript(url);
        if (!res.ok) { UI.toast('Could not load that script'); statusNote.textContent = ''; return; }
        if (!res.ids.length) { UI.toast('That script registered no app'); statusNote.textContent = ''; return; }
        const meta = {};
        for (const id of res.ids) {
          const choice = await pickAppMeta(CUSTOM_APPS[id], id);
          if (!choice) {
            res.ids.forEach((x) => { delete CUSTOM_APPS[x]; });
            document.querySelectorAll('script[data-community]').forEach((s) => {
              if (s.getAttribute('data-community') === url) s.remove();
            });
            statusNote.textContent = '';
            UI.toast('Cancelled.');
            return;
          }
          meta[id] = choice;
        }
        await commit(url, res.ids, meta);
        UI.toast('Installed ' + res.ids.length + ' app' + (res.ids.length === 1 ? '' : 's'));
        render();
      });

      render();
      shell.append(bar, scroll, status);
      root.appendChild(shell);
      win.setTitle('App Store');
    }
  };
})();
