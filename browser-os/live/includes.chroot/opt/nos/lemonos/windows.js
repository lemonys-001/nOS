const WM = (() => {
  const els = {};
  const windows = new Map();
  let zTop = 100;
  let cascade = 0;
  let idSeq = 0;

  const DESKTOP_MIN_W = 320;
  const DESKTOP_MIN_H = 200;

  function $(id) {
    return document.getElementById(id);
  }

  function resolveApp(appId) {
    return APPS[appId] || CUSTOM_APPS[appId] || null;
  }

  function defaultIcon(label) {
    const ch = (label || '?').trim().charAt(0).toUpperCase() || '?';
    return (
      '<svg viewBox="0 0 32 32" role="img" aria-hidden="true">' +
      '<rect x="2" y="2" width="28" height="28" rx="8" fill="#262a33"/>' +
      '<text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#f5d547">' +
      ch +
      '</text></svg>'
    );
  }

  function iconMarkup(app) {
    return app && app.icon ? app.icon : defaultIcon(app ? app.name : '');
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function desktopRect() {
    return els.desktop.getBoundingClientRect();
  }

  function focusWindow(record) {
    if (record.state === 'closed') return;
    zTop += 1;
    record.el.style.zIndex = String(zTop);
    windows.forEach((rec) => rec.el.classList.toggle('focused', rec === record));
    record.taskEl.classList.add('active');
    record.taskEl.classList.remove('minimized');
  }

  function createTaskItem(record) {
    const btn = el('button', 'task-item');
    btn.type = 'button';
    btn.setAttribute('aria-label', record.app.name);
    btn.dataset.appId = record.appId;
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = iconMarkup(record.app);
    if (iconWrap.firstElementChild) btn.appendChild(iconWrap.firstElementChild);
    btn.appendChild(el('span', 'ti-label', record.app.name));
    btn.addEventListener('click', () => {
      const active = btn.classList.contains('active') && !btn.classList.contains('minimized');
      if (active) minimizeWindow(record);
      else restoreWindow(record);
    });
    els.taskItems.appendChild(btn);
    return btn;
  }

  function setTitle(record, title) {
    record.title = title || record.app.name;
    record.titleEl.textContent = record.title;
    const label = record.taskEl.querySelector('.ti-label');
    if (label) label.textContent = record.title;
  }

  function placeWindow(record, desk) {
    const app = record.app;
    const width = Math.min(app.width || 760, Math.max(DESKTOP_MIN_W, desk.width - 36));
    const height = Math.min(app.height || 500, Math.max(DESKTOP_MIN_H, desk.height - 36));
    const offset = (cascade % 6) * 26;
    cascade += 1;
    const left = Math.max(12, Math.min(desk.width - width - 12, Math.round((desk.width - width) / 2) + offset - 60));
    const top = Math.max(12, Math.min(desk.height - height - 12, Math.round((desk.height - height) / 2.4) + offset - 40));
    record.el.style.width = width + 'px';
    record.el.style.height = height + 'px';
    record.el.style.left = left + 'px';
    record.el.style.top = top + 'px';
  }

  function open(appId, payload) {
    const app = resolveApp(appId);
    if (!app) return null;

    const singleton = app.singleton !== false;
    if (singleton) {
      for (const rec of windows.values()) {
        if (rec.appId === appId && rec.state !== 'closed') {
          restoreWindow(rec);
          return rec.win;
        }
      }
    }

    idSeq += 1;
    const desk = desktopRect();
    const winEl = el('div', 'window opening');
    winEl.dataset.winId = String(idSeq);
    winEl.setAttribute('role', 'dialog');
    winEl.setAttribute('aria-label', app.name);

    const titlebar = el('div', 'titlebar');
    const traffic = el('div', 'traffic');
    const mkLight = (kind, label, glyph) => {
      const b = el('button', 'tl tl-' + kind);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.innerHTML = glyph;
      return b;
    };
    const btnClose = mkLight('close', 'Close window', '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="#4d0f0b" stroke-width="1.6" stroke-linecap="round"/></svg>');
    const btnMin = mkLight('min', 'Minimize window', '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6" stroke="#5c3a05" stroke-width="1.6" stroke-linecap="round"/></svg>');
    const btnMax = mkLight('max', 'Maximize window', '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.2 6.8V3.2h3.6" fill="none" stroke="#0b3d13" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    traffic.append(btnClose, btnMin, btnMax);

    const titleWrap = el('div', 'win-title');
    titleWrap.innerHTML = iconMarkup(app);
    const titleText = el('span', 'win-title-text', app.name);
    titleWrap.appendChild(titleText);

    titlebar.append(traffic, titleWrap, el('div', 'win-spacer'));
    const body = el('div', 'win-body');
    const loading = el('div', 'app-loading', 'Loading');
    body.appendChild(loading);

    winEl.append(titlebar, body);
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      const h = el('div', 'resize-handle rh-' + dir);
      h.dataset.dir = dir;
      winEl.appendChild(h);
    });

    const record = {
      id: idSeq,
      appId,
      app,
      el: winEl,
      body,
      payload: payload,
      state: 'open',
      maximized: false,
      prevRect: null,
      titleEl: titleText,
      onCloseHandlers: [],
      context: null
    };

    record.win = {
      appId,
      el: winEl,
      body,
      payload,
      setTitle: (t) => setTitle(record, t),
      close: () => closeWindow(record),
      minimize: () => minimizeWindow(record),
      toggleMaximize: () => toggleMaximize(record),
      onClose: (fn) => {
        if (typeof fn === 'function') record.onCloseHandlers.push(fn);
      }
    };

    record.taskEl = createTaskItem(record);
    els.windowsLayer.appendChild(winEl);
    placeWindow(record, desk);
    windows.set(record.id, record);

    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeWindow(record);
    });
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      minimizeWindow(record);
    });
    btnMax.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMaximize(record);
    });
    winEl.addEventListener('pointerdown', () => focusWindow(record), true);
    attachDrag(record, titlebar);
    attachResize(record);

    focusWindow(record);
    setTimeout(() => winEl.classList.remove('opening'), 260);

    try {
      const result = app.mount ? app.mount(body, record.win) : null;
      if (result && typeof result.then === 'function') {
        result.catch((err) => {
          body.innerHTML = '';
          const box = el('div', 'app-error');
          box.textContent = 'This app failed to start: ' + (err && err.message ? err.message : 'unknown error');
          body.appendChild(box);
        });
      }
    } catch (err) {
      body.innerHTML = '';
      body.appendChild(el('div', 'app-error', 'This app failed to start: ' + err.message));
    }
    if (loading.parentNode === body) body.removeChild(loading);

    return record.win;
  }

  function closeWindow(record) {
    if (record.state === 'closed') return;
    record.state = 'closed';
    record.onCloseHandlers.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
    record.el.classList.add('closing');
    record.taskEl.remove();
    windows.delete(record.id);
    setTimeout(() => record.el.remove(), 200);
    const remaining = [...windows.values()];
    if (remaining.length) focusWindow(remaining[remaining.length - 1]);
  }

  function minimizeWindow(record) {
    if (record.state === 'closed' || record.state === 'minimized') return;
    record.state = 'minimized';
    record.el.classList.add('minimizing');
    record.taskEl.classList.remove('active');
    record.taskEl.classList.add('minimized');
    record.el.classList.remove('focused');
    setTimeout(() => {
      if (record.state === 'minimized') record.el.style.display = 'none';
    }, 210);
  }

  function restoreWindow(record) {
    if (record.state === 'closed') return;
    record.el.style.display = '';
    record.el.classList.remove('minimizing', 'opening');
    record.state = 'open';
    focusWindow(record);
  }

  function toggleMaximize(record) {
    if (record.state === 'closed') return;
    const desk = desktopRect();
    if (!record.maximized) {
      record.prevRect = {
        left: record.el.style.left,
        top: record.el.style.top,
        width: record.el.style.width,
        height: record.el.style.height
      };
      record.maximized = true;
      record.el.classList.add('maximized');
      record.el.style.left = '0px';
      record.el.style.top = '0px';
      record.el.style.width = desk.width + 'px';
      record.el.style.height = desk.height + 'px';
      record.taskEl.classList.remove('minimized');
    } else {
      record.maximized = false;
      record.el.classList.remove('maximized');
      if (record.prevRect) {
        record.el.style.left = record.prevRect.left;
        record.el.style.top = record.prevRect.top;
        record.el.style.width = record.prevRect.width;
        record.el.style.height = record.prevRect.height;
      }
    }
  }

  function attachDrag(record, handle) {
    let drag = null;
    let lastTap = 0;

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.tl')) return;
      const now = Date.now();
      if (now - lastTap < 320) {
        lastTap = 0;
        toggleMaximize(record);
        return;
      }
      lastTap = now;
      if (record.maximized) return;

      const desk = desktopRect();
      const rect = record.el.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originLeft: rect.left - desk.left,
        originTop: rect.top - desk.top,
        w: rect.width,
        h: rect.height
      };
      handle.setPointerCapture(e.pointerId);
      record.el.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const desk = desktopRect();
      let left = drag.originLeft + (e.clientX - drag.startX);
      let top = drag.originTop + (e.clientY - drag.startY);
      left = Math.min(Math.max(left, -(drag.w - 130)), desk.width - 60);
      top = Math.min(Math.max(top, 0), desk.height - 40);
      record.el.style.left = left + 'px';
      record.el.style.top = top + 'px';
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      record.el.classList.remove('dragging');
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function attachResize(record) {
    record.el.querySelectorAll('.resize-handle').forEach((handle) => {
      let drag = null;
      const dir = handle.dataset.dir;

      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || record.maximized) return;
        const desk = desktopRect();
        const rect = record.el.getBoundingClientRect();
        drag = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          left: rect.left - desk.left,
          top: rect.top - desk.top,
          w: rect.width,
          h: rect.height
        };
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        let { left, top, w, h } = drag;
        if (dir.includes('e')) w = Math.max(DESKTOP_MIN_W, drag.w + dx);
        if (dir.includes('s')) h = Math.max(DESKTOP_MIN_H, drag.h + dy);
        if (dir.includes('w')) {
          w = Math.max(DESKTOP_MIN_W, drag.w - dx);
          left = drag.left + (drag.w - w);
        }
        if (dir.includes('n')) {
          h = Math.max(DESKTOP_MIN_H, drag.h - dy);
          top = drag.top + (drag.h - h);
        }
        if (top < 0) {
          h += top;
          top = 0;
        }
        record.el.style.left = left + 'px';
        record.el.style.top = top + 'px';
        record.el.style.width = w + 'px';
        record.el.style.height = h + 'px';
      });

      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function renderLauncher() {
    const session = Auth.getSession();
    const guest = !session || session.provider === 'guest';
    const apps = Object.entries(APPS)
      .concat(Object.entries(CUSTOM_APPS))
      .filter(([, app]) => app && app.hidden !== true && !(app.requiresAuth && guest));

    els.desktopIcons.innerHTML = '';
    els.startGrid.innerHTML = '';
    const emptyNotice = els.desktop.querySelector('.desktop-empty');

    const desktopApps = apps.filter(([, app]) => app.desktop !== false);
    if (!desktopApps.length) {
      if (emptyNotice) emptyNotice.hidden = false;
    } else {
      if (emptyNotice) emptyNotice.hidden = true;
      desktopApps.forEach(([id, app]) => {
        const btn = el('button', 'desk-icon');
        btn.type = 'button';
        btn.innerHTML = iconMarkup(app);
        btn.appendChild(el('span', '', app.shortName || app.name || id));
        btn.addEventListener('click', () => open(id));
        els.desktopIcons.appendChild(btn);
      });
    }

    if (!apps.length) {
      const empty = el('div', 'start-empty');
      empty.innerHTML = '<strong>No apps installed yet</strong>Apps from the App Store will appear here.';
      els.startGrid.appendChild(empty);
      return;
    }

    apps.forEach(([id, app]) => {
      const btn = el('button', 'start-app');
      btn.type = 'button';
      btn.dataset.search = ((app.name || '') + ' ' + id).toLowerCase();
      btn.innerHTML = iconMarkup(app);
      btn.appendChild(el('span', '', app.name || id));
      btn.addEventListener('click', () => {
        closeStartMenu();
        open(id);
      });
      els.startGrid.appendChild(btn);
    });
  }

  function openStartMenu() {
    els.startMenu.hidden = false;
    els.startBtn.setAttribute('aria-expanded', 'true');
    els.startSearch.value = '';
    filterStartMenu('');
    els.startSearch.focus();
  }

  function closeStartMenu() {
    els.startMenu.hidden = true;
    els.startBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleStartMenu() {
    if (els.startMenu.hidden) openStartMenu();
    else closeStartMenu();
  }

  function filterStartMenu(query) {
    const q = query.trim().toLowerCase();
    let visible = 0;
    els.startGrid.querySelectorAll('.start-app').forEach((node) => {
      const match = !q || node.dataset.search.includes(q);
      node.hidden = !match;
      if (match) visible += 1;
    });
    let noResults = els.startGrid.querySelector('.start-none');
    if (visible === 0 && els.startGrid.querySelector('.start-app')) {
      if (!noResults) {
        noResults = el('div', 'start-empty start-none');
        noResults.innerHTML = '<strong>Nothing matches</strong>Try a different search term.';
        els.startGrid.appendChild(noResults);
      }
      noResults.hidden = false;
    } else if (noResults) {
      noResults.hidden = true;
    }
  }

  function openTrayMenu() {
    els.trayMenu.hidden = false;
    els.trayBtn.setAttribute('aria-expanded', 'true');
  }

  function closeTrayMenu() {
    els.trayMenu.hidden = true;
    els.trayBtn.setAttribute('aria-expanded', 'false');
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    els.clockTime.textContent = time;
    els.clockDate.textContent = date;
    els.clock.title = now.toLocaleString();
    if (els.lockClock) els.lockClock.textContent = date + ' · ' + time;
  }

  function renderUser() {
    const session = Auth.getSession();
    if (!session) return;
    els.startUserName.textContent = session.username || session.name || 'User';
    const labels = {
      google: session.email || 'Google account',
      email: session.email || 'Email account',
      guest: 'Guest session (local only)'
    };
    els.startUserMeta.textContent = labels[session.provider] || 'Signed in';
    els.trayAvatar.innerHTML = '';
    if (session.picture) {
      const img = document.createElement('img');
      img.src = session.picture;
      img.alt = '';
      els.trayAvatar.appendChild(img);
    } else {
      els.trayAvatar.textContent = (session.username || session.name || 'U').trim().charAt(0).toUpperCase();
    }
  }

  function toast(message, ms) {
    const node = el('div', 'toast', message);
    els.toastHost.appendChild(node);
    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 220);
    }, ms || 3200);
  }

  const PREFS_KEY = 'lemon.prefs';

  function config() {
    return typeof CONFIG !== 'undefined' ? CONFIG : {};
  }

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function writePrefs(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function applyPrefs() {
    const prefs = readPrefs();
    const root = document.documentElement;
    const cfg = config();
    const wall = prefs.wallpaperCss || cfg.wallpaper;
    if (wall) root.style.setProperty('--wallpaper', wall);
    const accents = cfg.accents || [];
    const accent = accents.find((a) => a.id === prefs.accentId);
    if (accent) {
      root.style.setProperty('--accent', accent.accent);
      root.style.setProperty('--accent-soft', accent.soft);
      root.style.setProperty('--accent-dim', accent.dim);
      root.style.setProperty('--accent-ink', accent.ink);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-soft');
      root.style.removeProperty('--accent-dim');
      root.style.removeProperty('--accent-ink');
    }
  }

  function setWallpaper(css, id) {
    const prefs = readPrefs();
    prefs.wallpaperCss = css || '';
    prefs.wallpaperId = id || '';
    writePrefs(prefs);
    applyPrefs();
  }

  function setAccent(id) {
    const prefs = readPrefs();
    prefs.accentId = id || '';
    writePrefs(prefs);
    applyPrefs();
  }

  function showScreen(which) {
    els.landing.hidden = which !== 'landing';
    els.lock.hidden = which !== 'lock';
    els.os.hidden = which !== 'os';
    document.body.style.overflow = which === 'landing' ? '' : 'hidden';
  }

  function enterOS() {
    if (!Auth.isSignedIn()) {
      showScreen('lock');
      return;
    }
    els.landing.hidden = true;
    els.lock.hidden = true;
    els.os.hidden = false;
    els.boot.hidden = false;
    renderUser();
    applyPrefs();
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      els.boot.hidden = true;
      els.os.classList.add('enter');
      renderLauncher();
      updateClock();
      if (windows.size === 0) {
        ['files'].forEach((id) => resolveApp(id) && open(id));
      }
    }, 620);
  }

  function lock() {
    windows.forEach((rec) => {
      rec.state = 'closed';
      rec.el.remove();
      rec.taskEl.remove();
    });
    windows.clear();
    els.os.classList.remove('enter');
    els.desktopIcons.innerHTML = '';
    els.taskItems.innerHTML = '';
    showScreen('lock');
  }

  function init() {
    els.landing = $('landing');
    els.lock = $('lock');
    els.os = $('os');
    els.boot = $('boot');
    els.desktop = $('desktop');
    els.desktopIcons = $('desktop-icons');
    els.windowsLayer = $('windows-layer');
    els.taskItems = $('task-items');
    els.startBtn = $('start-btn');
    els.startMenu = $('start-menu');
    els.startGrid = $('start-grid');
    els.startSearch = $('start-search');
    els.startUserName = $('start-user-name');
    els.startUserMeta = $('start-user-meta');
    els.trayBtn = $('tray-btn');
    els.trayMenu = $('tray-menu');
    els.trayAvatar = $('tray-avatar');
    els.clock = $('clock');
    els.clockTime = $('clock-time');
    els.clockDate = $('clock-date');
    els.lockClock = $('lock-clock');
    els.toastHost = $('toast-host');

    applyPrefs();

    els.startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTrayMenu();
      toggleStartMenu();
    });
    els.startSearch.addEventListener('input', (e) => filterStartMenu(e.target.value));
    els.trayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeStartMenu();
      if (els.trayMenu.hidden) openTrayMenu();
      else closeTrayMenu();
    });
    document.addEventListener('click', (e) => {
      if (!els.startMenu.hidden && !els.startMenu.contains(e.target)) closeStartMenu();
      if (!els.trayMenu.hidden && !els.trayMenu.contains(e.target)) closeTrayMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeStartMenu();
        closeTrayMenu();
      }
    });
    document.querySelectorAll('[data-signout]').forEach((btn) => {
      btn.addEventListener('click', () => Auth.signOut());
    });
    const versionTag = $('lock-version');
    if (versionTag) versionTag.textContent = 'nOS ' + CONFIG.version;

    document.addEventListener('lemon:signin', () => enterOS());
    document.addEventListener('lemon:signout', () => lock());

    updateClock();
    setInterval(updateClock, 15000);

    if (els.desktop) {
      const notice = el('div', 'desktop-empty');
      notice.hidden = true;
      notice.innerHTML = '<strong>No desktop apps</strong>Open the Start menu to launch an app.';
      els.desktop.appendChild(notice);
    }
  }

  return {
    init,
    open,
    toast,
    enterOS,
    lock,
    showScreen,
    refreshLauncher: renderLauncher,
    closeStartMenu,
    setWallpaper,
    setAccent,
    getPrefs: readPrefs,
    applyPrefs,
    windows
  };
})();
