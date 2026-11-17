(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>';
  const HOME_LINKS = [
    { label: 'Example domain', url: 'https://example.com' },
    { label: 'Wikipedia', url: 'https://en.wikipedia.org' },
    { label: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
    { label: 'Hacker News', url: 'https://news.ycombinator.com' }
  ];

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return url;
    }
  }

  function normalize(input) {
    const value = String(input || '').trim();
    if (!value) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
    if (/^localhost(:\d+)?(\/|$)/i.test(value) || /^\d{1,3}(\.\d{1,3}){3}/.test(value)) return 'http://' + value;
    if (/^[^\s]+\.[^\s]+$/.test(value) && !/\s/.test(value)) return 'https://' + value;
    return null;
  }

  APPS.browser = {
    id: 'browser',
    name: 'Browser',
    shortName: 'Browser',
    icon: ICON,
    width: 1000,
    height: 680,
    singleton: true,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar br-bar');
      const tabStrip = UI.el('div', 'br-tabs');
      const content = UI.el('div', 'br-content');
      const status = UI.status();
      const statusNote = UI.el('span', 'app-status-grow', '');
      const frameNote = UI.el('span', null, 'External sites load in a sandboxed frame');
      status.append(statusNote, frameNote);

      let tabs = [];
      let activeId = null;
      let seq = 0;

      const backBtn = UI.iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>');
      backBtn.title = 'Back';
      const fwdBtn = UI.iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>');
      fwdBtn.title = 'Forward';
      const reloadBtn = UI.iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>');
      reloadBtn.title = 'Reload';
      const address = UI.el('input', 'br-address');
      address.type = 'text';
      address.placeholder = 'Enter a web address — e.g. example.com';
      address.setAttribute('aria-label', 'Address');
      const goBtn = UI.iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>', 'primary');
      goBtn.title = 'Go';
      const newTabBtn = UI.iconBtn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>');
      newTabBtn.title = 'New tab';
      bar.append(backBtn, fwdBtn, reloadBtn, address, goBtn, newTabBtn);

      function active() {
        return tabs.find((t) => t.id === activeId) || null;
      }

      function newTab(url) {
        const tab = { id: 'tab_' + (++seq), url: url || '', title: url ? hostOf(url) : 'New tab', history: [], hist: -1 };
        tabs.push(tab);
        activeId = tab.id;
        renderTabs();
        renderContent();
        return tab;
      }

      function closeTab(id) {
        const i = tabs.findIndex((t) => t.id === id);
        if (i < 0) return;
        tabs.splice(i, 1);
        if (!tabs.length) { newTab(''); return; }
        if (activeId === id) activeId = tabs[Math.max(0, i - 1)].id;
        renderTabs();
        renderContent();
      }

      function navigate(input, recompute) {
        const tab = active();
        if (!tab) return;
        const url = normalize(input);
        if (url === null) {
          statusNote.textContent = '“' + String(input).trim() + '” is not a web address';
          address.select();
          return;
        }
        tab.url = url;
        tab.title = url ? hostOf(url) : 'New tab';
        if (recompute !== false && url) {
          tab.history = tab.history.slice(0, tab.hist + 1);
          tab.history.push(url);
          tab.hist = tab.history.length - 1;
        }
        renderTabs();
        renderContent();
      }

      function renderTabs() {
        tabStrip.textContent = '';
        tabs.forEach((tab) => {
          const el = UI.el('div', 'br-tab' + (tab.id === activeId ? ' sel' : ''));
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          const label = UI.el('span', 'br-tab-label', tab.title || 'New tab');
          const close = UI.el('button', 'br-tab-close');
          close.type = 'button';
          close.title = 'Close tab';
          close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
          close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
          el.append(label, close);
          const pick = () => { activeId = tab.id; renderTabs(); renderContent(); };
          el.addEventListener('click', pick);
          el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
          tabStrip.appendChild(el);
        });
      }

      function renderHome(message) {
        const home = UI.el('div', 'br-home');
        home.appendChild(UI.el('h2', 'br-home-title', 'New tab'));
        if (message) home.appendChild(UI.el('p', 'br-home-note', message));
        const grid = UI.el('div', 'br-home-grid');
        HOME_LINKS.forEach((link) => {
          const btn = UI.el('button', 'br-home-card');
          btn.type = 'button';
          btn.appendChild(UI.el('span', 'br-home-name', link.label));
          btn.appendChild(UI.el('span', 'br-home-url', hostOf(link.url)));
          btn.addEventListener('click', () => navigate(link.url));
          grid.appendChild(btn);
        });
        home.appendChild(grid);
        home.appendChild(UI.el('p', 'br-home-note',
          'Enter any address above. Pages are shown in a sandboxed iframe; sites that forbid embedding will refuse to display and stay blank.'));
        content.appendChild(home);
      }

      function renderContent() {
        content.textContent = '';
        const tab = active();
        if (!tab) return;
        address.value = tab.url || '';
        backBtn.disabled = tab.hist <= 0;
        fwdBtn.disabled = tab.hist >= tab.history.length - 1;
        if (!tab.url) {
          statusNote.textContent = 'Start page';
          renderHome();
          return;
        }
        statusNote.textContent = 'Loading ' + hostOf(tab.url) + '…';
        const frame = UI.el('iframe', 'br-frame');
        frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.setAttribute('title', tab.title || 'Web page');
        frame.src = tab.url;
        frame.addEventListener('load', () => { statusNote.textContent = hostOf(tab.url); });
        content.appendChild(frame);
        win.setTitle(tab.title || 'Browser');
      }

      address.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); navigate(address.value); }
      });
      goBtn.addEventListener('click', () => navigate(address.value));
      newTabBtn.addEventListener('click', () => newTab(''));
      reloadBtn.addEventListener('click', () => {
        const tab = active();
        if (tab && tab.url) { const t = tab.url; tab.url = ''; renderContent(); tab.url = t; renderContent(); }
      });
      backBtn.addEventListener('click', () => {
        const tab = active();
        if (tab && tab.hist > 0) { tab.hist -= 1; tab.url = tab.history[tab.hist]; tab.title = hostOf(tab.url); renderTabs(); renderContent(); }
      });
      fwdBtn.addEventListener('click', () => {
        const tab = active();
        if (tab && tab.hist < tab.history.length - 1) { tab.hist += 1; tab.url = tab.history[tab.hist]; tab.title = hostOf(tab.url); renderTabs(); renderContent(); }
      });

      shell.append(bar, tabStrip, content, status);
      root.appendChild(shell);
      newTab('');
    }
  };
})();
