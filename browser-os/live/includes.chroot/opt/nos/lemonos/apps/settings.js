(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/></svg>';
  const DATA_APPS = ['word', 'sheets', 'slides', 'files', 'notes', 'code', 'photo', 'mail', 'appstore', 'browser', 'chat'];
  const PREFS_KEY = 'lemon.prefs';

  function cfg() {
    return typeof CONFIG !== 'undefined' ? CONFIG : {};
  }

  const SECTIONS = [
    { id: 'appearance', label: 'Appearance', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 14l4.5-4 3.5 3 3-3L21 15"/><circle cx="8" cy="8.5" r="1.2"/></svg>' },
    { id: 'account', label: 'Account', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/></svg>' },
    { id: 'storage', label: 'Storage', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>' },
    { id: 'about', label: 'About', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>' }
  ];

  APPS.settings = {
    id: 'settings',
    name: 'Settings',
    shortName: 'Settings',
    icon: ICON,
    width: 860,
    height: 620,
    singleton: true,
    desktop: true,

    mount(root, win) {
      const c = cfg();
      const shell = UI.el('div', 'app');
      const split = UI.el('div', 'app-split');
      const aside = UI.el('aside', 'app-side');
      const main = UI.el('section', 'app-main');
      const status = UI.status();
      const statusNote = UI.el('span', 'app-status-grow', '');
      status.appendChild(statusNote);

      let section = 'appearance';
      let panel = null;

      function wm() {
        return typeof WM !== 'undefined' ? WM : null;
      }

      function prefs() {
        const w = wm();
        if (w && w.getPrefs) return w.getPrefs();
        try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
      }

      function renderNav() {
        aside.textContent = '';
        aside.appendChild(UI.el('div', 'app-side-head', 'Settings'));
        const list = UI.el('div', 'app-list');
        SECTIONS.forEach((s) => {
          const row = UI.el('div', 'app-row' + (s.id === section ? ' sel' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const ico = UI.el('span', 'app-row-ico');
          ico.innerHTML = s.icon;
          const body = UI.el('div', 'app-row-body');
          body.appendChild(UI.el('span', 'app-row-title', s.label));
          row.append(ico, body);
          const go = () => { section = s.id; renderNav(); renderMain(); };
          row.addEventListener('click', go);
          row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          list.appendChild(row);
        });
        aside.appendChild(list);
      }

      function block(title, hint) {
        const sec = UI.el('section', 'set-block');
        sec.appendChild(UI.el('h2', 'set-h', title));
        if (hint) sec.appendChild(UI.el('p', 'set-hint', hint));
        return sec;
      }

      function renderAppearance() {
        const p = prefs();
        const wallpapers = c.wallpapers || [];

        const wallSec = block('Wallpaper', 'Applies to the desktop behind every window.');
        const grid = UI.el('div', 'wp-grid');
        wallpapers.forEach((w) => {
          const btn = UI.el('button', 'wp-swatch' + (p.wallpaperId === w.id ? ' sel' : ''));
          btn.type = 'button';
          btn.title = w.label;
          const prev = UI.el('span', 'wp-prev');
          prev.style.background = w.css;
          btn.append(prev, UI.el('span', 'wp-label', w.label));
          btn.addEventListener('click', () => {
            wm().setWallpaper(w.css, w.id);
            renderMain();
          });
          grid.appendChild(btn);
        });
        wallSec.appendChild(grid);

        const custom = UI.el('div', 'set-row');
        const color = UI.el('input', 'set-color');
        color.type = 'color';
        color.value = p.wallpaperColor || '#1c2030';
        color.setAttribute('aria-label', 'Custom background colour');
        const useBtn = UI.btn('Use colour');
        useBtn.addEventListener('click', () => {
          const css = 'radial-gradient(1200px 900px at 50% 12%, ' + color.value + ' 0%, #0a0b0e 72%)';
          wm().setWallpaper(css, 'custom');
          try {
            const cur = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
            cur.wallpaperColor = color.value;
            localStorage.setItem(PREFS_KEY, JSON.stringify(cur));
          } catch (e) { /* ignore */ }
          renderMain();
        });
        custom.append(UI.el('span', 'set-row-label', 'Custom'), color, useBtn);
        wallSec.appendChild(custom);

        const accSec = block('Accent', 'Used for highlights, focus rings, and the clock.');
        const accRow = UI.el('div', 'accent-row');
        (c.accents || []).forEach((a) => {
          const btn = UI.el('button', 'accent-swatch' + (p.accentId === a.id ? ' sel' : ''));
          btn.type = 'button';
          btn.title = a.label;
          btn.style.background = a.accent;
          btn.addEventListener('click', () => { wm().setAccent(a.id); renderMain(); });
          accRow.appendChild(btn);
        });
        accSec.appendChild(accRow);

        const resetRow = UI.el('div', 'set-row');
        const reset = UI.btn('Reset appearance');
        reset.addEventListener('click', () => {
          wm().setWallpaper('', '');
          wm().setAccent('');
          try {
            const cur = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
            delete cur.wallpaperColor;
            localStorage.setItem(PREFS_KEY, JSON.stringify(cur));
          } catch (e) { /* ignore */ }
          renderMain();
        });
        resetRow.appendChild(reset);
        accSec.appendChild(resetRow);

        panel.append(wallSec, accSec);
      }
      function renderAccount() {
        const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
        const sec = block('Account');
        if (!session) {
          sec.appendChild(UI.el('p', 'set-hint', 'Not signed in.'));
          panel.appendChild(sec);
          return;
        }
        const isGuest = session.provider === 'guest';
        const dl = UI.el('dl', 'set-facts');
        const fact = (k, v) => {
          const row = UI.el('div', 'set-fact');
          row.appendChild(UI.el('dt', null, k));
          row.appendChild(UI.el('dd', null, v));
          dl.appendChild(row);
        };
        fact('Mode', isGuest ? 'Guest session' : 'Google account');
        fact('Name', session.name || '—');
        if (!isGuest) fact('Email', session.email || '—');
        fact('Storage id', session.userId || '—');
        sec.appendChild(dl);
        sec.appendChild(UI.el('p', 'set-hint', isGuest
          ? 'Guest data lives only in this browser. Sign out to start a fresh session.'
          : 'Documents are synced to Cloudflare Workers KV under your storage id, with 50 MB per account.'));

        const row = UI.el('div', 'set-row');
        const out = UI.btn('Sign out', 'danger');
        out.addEventListener('click', async () => {
          const ok = await UI.confirm('Sign out of nOS?', { confirmLabel: 'Sign out' });
          if (!ok) return;
          if (typeof Auth !== 'undefined') Auth.signOut();
        });
        row.appendChild(out);

        const delRow = UI.el('div', 'set-row');
        const delAcct = UI.btn('Delete account', 'danger');
        delAcct.title = 'Delete your account and all stored data';
        delAcct.addEventListener('click', async () => {
          const ok = await UI.confirm('Delete your nOS account? This removes all your stored data and cannot be undone.', { confirmLabel: 'Delete my account' });
          if (!ok) return;
          const again = await UI.confirm('Are you sure? All documents, notes, photos, and chats will be erased.', { confirmLabel: 'Yes, delete everything' });
          if (!again) return;
          statusNote.textContent = 'Deleting account…';
          try {
            const res = await fetch(CONFIG.apiBase.replace(/\/store\/?$/, '') + '/account', {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + (typeof Auth !== 'undefined' && Auth.getSession() ? Auth.getSession().userId : '') }
            });
            const body = await res.json();
            if (!body.ok) throw new Error(body.error || 'Deletion failed');
          } catch (e) {
            UI.toast(e.message || 'Account deletion failed.');
            return;
          }
          if (typeof Auth !== 'undefined') Auth.signOut();
        });
        delRow.appendChild(delAcct);
        sec.appendChild(row);
        sec.appendChild(delRow);
        panel.appendChild(sec);
      }

      async function collect() {
        const data = {};
        let items = 0;
        for (const app of DATA_APPS) {
          const keys = (await Store.list(app)) || [];
          const bucket = {};
          for (const k of keys) {
            bucket[k] = await Store.get(app, k, null);
            items += 1;
          }
          if (keys.length) data[app] = bucket;
        }
        return { data, items, apps: Object.keys(data).length };
      }

      async function wipe() {
        for (const app of DATA_APPS) {
          const keys = (await Store.list(app)) || [];
          for (const k of keys) await Store.del(app, k);
        }
      }

      function renderStorage() {
        const sec = block('Storage', 'Everything nOS has saved for this account.');
        const meter = UI.el('div', 'set-meter');
        const meterTop = UI.el('div', 'set-meter-top');
        const meterLabel = UI.el('span', 'set-meter-label', 'Checking usage…');
        const meterAmount = UI.el('span', 'set-meter-amount', '');
        meterTop.append(meterLabel, meterAmount);
        const track = UI.el('div', 'set-meter-track');
        const fill = UI.el('span', 'set-meter-fill');
        track.appendChild(fill);
        meter.append(meterTop, track);
        sec.appendChild(meter);
        const summary = UI.el('p', 'set-hint', 'Counting…');
        sec.appendChild(summary);
        const row = UI.el('div', 'set-row');
        const exportBtn = UI.btn('Export JSON', 'primary');
        const deleteBtn = UI.btn('Delete all data', 'danger');
        row.append(exportBtn, deleteBtn);
        sec.appendChild(row);
        panel.appendChild(sec);

        (async () => {
          const use = await Store.usage();
          if (use && use.quota) {
            const pct = Math.min(100, Math.round((use.used / use.quota) * 100));
            meterLabel.textContent = 'Used';
            meterAmount.textContent = UI.fmtBytes(use.used) + ' of ' + UI.fmtBytes(use.quota);
            fill.style.transform = 'scaleX(' + (Math.max(pct, use.used ? 2 : 0) / 100) + ')';
            if (pct >= 90) fill.classList.add('full');
          } else if (use && use.used) {
            meterLabel.textContent = 'On this device';
            meterAmount.textContent = UI.fmtBytes(use.used);
            fill.style.transform = 'scaleX(0)';
          } else {
            meterLabel.textContent = 'Used';
            meterAmount.textContent = '—';
          }
          const res = await collect();
          summary.textContent = res.items === 0
            ? 'No saved data yet.'
            : res.items + ' item' + (res.items === 1 ? '' : 's') + ' across ' + res.apps + ' app' + (res.apps === 1 ? '' : 's') + '.';
        })();

        exportBtn.addEventListener('click', async () => {
          statusNote.textContent = 'Preparing export…';
          const res = await collect();
          const payload = {
            app: c.name || 'nOS',
            version: c.version || '1.0.0',
            exported: new Date().toISOString(),
            account: (typeof Auth !== 'undefined' && Auth.getSession()) || null,
            prefs: prefs(),
            data: res.data
          };
          UI.saveFile('lemonos-export-' + new Date().toISOString().slice(0, 10) + '.json',
            JSON.stringify(payload, null, 2), 'application/json');
          statusNote.textContent = 'Prepared ' + res.items + ' items for export.';
        });

        deleteBtn.addEventListener('click', async () => {
          const ok = await UI.confirm('Delete every document, sheet, deck, note, photo, and message stored for this account? This cannot be undone.', { confirmLabel: 'Delete everything' });
          if (!ok) return;
          statusNote.textContent = 'Deleting…';
          await wipe();
          statusNote.textContent = 'All saved data deleted.';
          renderMain();
        });
      }

      function renderAbout() {
        const sec = block('About');
        const dl = UI.el('dl', 'set-facts');
        const fact = (k, v) => {
          const row = UI.el('div', 'set-fact');
          row.appendChild(UI.el('dt', null, k));
          row.appendChild(UI.el('dd', null, v));
          dl.appendChild(row);
        };
        fact('Product', c.name || 'nOS');
        fact('Version', c.version || '1.0.0');
        fact('Shell', 'Vanilla JavaScript, no build step');
        fact('Backend', 'Cloudflare Worker + Workers KV');
        sec.appendChild(dl);
        const row = UI.el('div', 'set-row');
        const open = UI.btn('Open About', 'primary');
        open.addEventListener('click', () => { if (typeof WM !== 'undefined') WM.open('about'); });
        row.appendChild(open);
        sec.appendChild(row);
        panel.appendChild(sec);
      }

      function renderMain() {
        main.textContent = '';
        panel = UI.el('div', 'app-scroll set-scroll');
        main.appendChild(panel);
        if (section === 'appearance') renderAppearance();
        else if (section === 'account') renderAccount();
        else if (section === 'storage') renderStorage();
        else renderAbout();
        win.setTitle('Settings');
      }

      renderNav();
      renderMain();
      shell.append(split, status);
      split.append(aside, main);
      root.appendChild(shell);

      const navStatus = UI.el('span', null, 'Local preferences apply instantly');
      status.insertBefore(navStatus, statusNote);
    }
  };
})();
