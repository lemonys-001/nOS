(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>';
  const STORE = 'files';
  const UPLOADS = 'uploads';
  const MAX_BYTES = 6 * 1024 * 1024; // shortcut: keeps the base64 data URL under the worker's 10 MB item limit; raise both together

  const docIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/></svg>';
  const sheetIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 15h16M10 4v16"/></svg>';
  const slideIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="11" rx="2"/><path d="M12 16v3M9 21h6"/></svg>';
  const noteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v10l-5 5H5z"/><path d="M19 14h-5v5"/></svg>';
  const upIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V5M6.5 10.5 12 5l5.5 5.5"/><path d="M5 19h14"/></svg>';

  function placeFromApp(key, label, appId, icon, nameField) {
    return {
      key,
      label,
      icon,
      isApp: true,
      appId,
      nameField,
      async load() {
        const index = (await Store.get(appId, 'index', [])) || [];
        return index.map((it) => ({
          id: it.id,
          name: (nameField === 'title' ? it.title : it.name) || 'Untitled',
          updated: it.updated || 0,
          kind: appId
        })).sort((a, b) => b.updated - a.updated);
      },
      async rename(item, name) {
        const index = (await Store.get(appId, 'index', [])) || [];
        const entry = index.find((x) => x.id === item.id);
        if (!entry) return;
        if (nameField === 'title') entry.title = name; else entry.name = name;
        await Store.set(appId, 'index', index);
        const record = await Store.get(appId, item.id, null);
        if (record) {
          if (nameField === 'title') record.title = name; else record.name = name;
          await Store.set(appId, item.id, record);
        }
      },
      async remove(item) {
        const index = (await Store.get(appId, 'index', [])) || [];
        await Store.set(appId, 'index', index.filter((x) => x.id !== item.id));
        await Store.del(appId, item.id);
      },
      open(item) {
        if (window.WM && APPS[appId]) WM.open(appId, { key: item.id });
      },
      create() {
        if (window.WM && APPS[appId]) WM.open(appId);
      }
    };
  }

  function askOpenWith(filename) {
    return new Promise((resolve) => {
      const { box, close } = UI.modal({ onClose: resolve });
      box.appendChild(UI.el('p', 'os-modal-msg', 'Open “' + filename + '” with'));
      box.appendChild(UI.el('p', 'set-hint', 'Notes and Code import a copy; the original stays in Files.'));
      const row = UI.el('div', 'os-modal-row');
      const cancel = UI.btn('Cancel');
      const preview = UI.btn('Preview');
      const codeLike = /\.(js|mjs|cjs|jsx|ts|tsx|json|html?|css|py|rb|go|rs|java|c|h|cpp|hpp|sh|yml|yaml|toml|ini|xml|svg)$/i.test(filename);
      const notes = UI.btn('Notes', codeLike ? '' : 'primary');
      const code = UI.btn('Code', codeLike ? 'primary' : '');
      row.append(cancel, preview, notes, code);
      box.appendChild(row);
      cancel.onclick = () => close(null);
      preview.onclick = () => close('preview');
      notes.onclick = () => close('notes');
      code.onclick = () => close('code');
      (codeLike ? code : notes).focus();
    });
  }

  const uploads = {
    key: 'uploads',
    label: 'Uploads',
    icon: upIcon,
    isApp: false,
    async load() {
      const index = (await Store.get(STORE, UPLOADS, [])) || [];
      return index.map((it) => ({
        id: it.id,
        name: it.name,
        updated: it.updated || 0,
        size: it.size,
        type: it.type,
        kind: 'uploads'
      })).sort((a, b) => b.updated - a.updated);
    },
    async rename(item, name) {
      const index = (await Store.get(STORE, UPLOADS, [])) || [];
      const entry = index.find((x) => x.id === item.id);
      if (!entry) return;
      entry.name = name;
      await Store.set(STORE, UPLOADS, index);
    },
    async remove(item) {
      const index = (await Store.get(STORE, UPLOADS, [])) || [];
      await Store.set(STORE, UPLOADS, index.filter((x) => x.id !== item.id));
      await Store.del(STORE, 'blob_' + item.id);
    },
    async open(item) {
      const blob = await Store.get(STORE, 'blob_' + item.id, null);
      if (!blob || !blob.dataUrl) { UI.toast('File data missing.'); return; }
      const name = item.name || 'file';
      if (!UI.isTextFile(name, blob.type)) {
        if (window.WM && APPS.viewer) WM.open('viewer', { key: item.id, name });
        else UI.toast('No previewer available.');
        return;
      }
      const choice = await askOpenWith(name);
      if (!choice) return;
      if (choice === 'preview') {
        if (window.WM && APPS.viewer) WM.open('viewer', { key: item.id, name });
        return;
      }
      const text = await UI.textFromData(blob.dataUrl, blob.type);
      if (choice === 'notes') WM.open('notes', { importText: text, name });
      else WM.open('code', { importText: text, name });
    },
    create() {
      UI.toast('Use Upload to add files here.');
    }
  };

  function places() {
    const list = [];
    if (APPS.notes) list.push(placeFromApp('notes', 'Notes', 'notes', noteIcon, 'title'));
    list.push(uploads);
    return list;
  }

  APPS.viewer = {
    id: 'viewer',
    name: 'Preview',
    shortName: 'Preview',
    icon: docIcon,
    width: 680,
    height: 540,
    singleton: false,
    desktop: false,
    hidden: true,
    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bodyWrap = UI.el('div', 'app-scroll fl-preview');
      const status = UI.status();
      const info = UI.el('span', 'app-status-grow', '');
      status.appendChild(info);
      shell.append(bodyWrap, status);
      root.appendChild(shell);

      const id = win.payload && win.payload.key;
      if (!id) { bodyWrap.appendChild(UI.empty('Nothing to preview')); return; }

      (async () => {
        const blob = await Store.get(STORE, 'blob_' + id, null);
        if (!blob || !blob.dataUrl) { bodyWrap.appendChild(UI.empty('File not found', 'It may have been deleted.')); return; }
        win.setTitle((win.payload && win.payload.name) || 'Preview');
        info.textContent = blob.type || 'file';
        if (/^image\//.test(blob.type)) {
          const img = UI.el('img', 'fl-preview-img');
          img.src = blob.dataUrl;
          img.alt = (win.payload && win.payload.name) || 'Preview';
          bodyWrap.appendChild(img);
        } else if (UI.isTextFile((win.payload && win.payload.name) || '', blob.type)) {
          const name = (win.payload && win.payload.name) || 'file';
          const text = await UI.textFromData(blob.dataUrl, blob.type);
          const actions = UI.el('div', 'fl-preview-actions');
          const notesBtn = UI.btn('Open in Notes');
          notesBtn.addEventListener('click', () => WM.open('notes', { importText: text, name }));
          const codeBtn = UI.btn('Open in Code', 'primary');
          codeBtn.addEventListener('click', () => WM.open('code', { importText: text, name }));
          actions.append(notesBtn, codeBtn);
          const pre = UI.el('pre', 'fl-preview-text');
          pre.textContent = text;
          const wrap = UI.el('div', 'fl-preview-doc');
          wrap.append(actions, pre);
          bodyWrap.appendChild(wrap);
        } else {
          const empty = UI.empty('No inline preview', 'This file type can be downloaded instead.');
          const dl = UI.btn('Download', 'primary');
          dl.addEventListener('click', () => {
            UI.saveFile((win.payload && win.payload.name) || 'download', blob.dataUrl, blob.type);
          });
          empty.appendChild(dl);
          bodyWrap.appendChild(empty);
        }
      })();
    }
  };

  APPS.files = {
    id: 'files',
    name: 'nOS Files',
    shortName: 'Files',
    icon: ICON,
    width: 900,
    height: 600,
    singleton: false,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const split = UI.el('div', 'app-split');
      const aside = UI.el('aside', 'app-side');
      const main = UI.el('section', 'app-main');
      const listEl = UI.el('div', 'app-list fl-list');
      const status = UI.status();
      const usage = UI.el('span', 'fl-usage');
      const usageText = UI.el('span', 'fl-usage-text', '');
      const usageTrack = UI.el('span', 'fl-usage-track');
      const usageFill = UI.el('span', 'fl-usage-fill');
      usageTrack.appendChild(usageFill);
      usage.append(usageText, usageTrack);
      const statusCount = UI.el('span', null, '');
      const statusNote = UI.el('span', 'app-status-grow', '');
      status.append(usage, statusCount, statusNote);

      const progress = UI.el('div', 'fl-progress');
      const progressFill = UI.el('span', 'fl-progress-fill');
      progress.appendChild(progressFill);
      progress.hidden = true;

      const placeList = places();
      let place = placeList[0];
      let items = [];
      let selected = null;

      const fileInput = UI.el('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.hidden = true;

      function renderSidebar() {
        aside.textContent = '';
        aside.appendChild(UI.el('div', 'app-side-head', 'Places'));
        const list = UI.el('div', 'app-list');
        placeList.forEach((p) => {
          const row = UI.el('div', 'app-row' + (p.key === place.key ? ' sel' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const ico = UI.el('span', 'app-row-ico');
          ico.innerHTML = p.icon;
          const body = UI.el('div', 'app-row-body');
          body.appendChild(UI.el('span', 'app-row-title', p.label));
          row.append(ico, body);
          row.addEventListener('click', () => selectPlace(p));
          list.appendChild(row);
        });
        aside.append(list);
      }

      async function selectPlace(p) {
        place = p;
        selected = null;
        renderSidebar();
        await refresh();
      }

      async function refresh() {
        items = await place.load();
        renderList();
        refreshUsage();
      }

      async function refreshUsage() {
        const u = await Store.usage();
        if (!u) {
          usageText.textContent = 'Storage unavailable';
          usageTrack.hidden = true;
          return;
        }
        if (u.local) {
          usageText.textContent = 'On this device · ' + UI.fmtBytes(u.used);
          usageTrack.hidden = true;
          return;
        }
        usageTrack.hidden = false;
        const pct = u.quota ? Math.min(1, u.used / u.quota) : 0;
        usageText.textContent = UI.fmtBytes(u.used) + ' of ' + UI.fmtBytes(u.quota);
        usageFill.style.transform = 'scaleX(' + pct + ')';
        usageFill.classList.toggle('full', pct >= 0.9);
      }

      function setProgress(p) {
        progressFill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)) + ')';
      }

      function renderList() {
        listEl.textContent = '';
        if (!items.length) {
          const empty = UI.empty(
            place.isApp ? 'Nothing in ' + place.label : 'No uploads yet',
            place.isApp ? 'Create something in ' + place.label + ' and it will show up here.' : 'Use Upload to add files.'
          );
          if (place.isApp) {
            const start = UI.btn('New in ' + place.label, 'primary');
            start.addEventListener('click', () => place.create());
            empty.appendChild(start);
          } else {
            const up = UI.btn('Upload files', 'primary');
            up.addEventListener('click', () => fileInput.click());
            empty.appendChild(up);
          }
          listEl.appendChild(empty);
        }
        items.forEach((item) => {
          const row = UI.el('div', 'app-row' + (selected && selected.id === item.id ? ' sel' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const ico = UI.el('span', 'app-row-ico');
          ico.innerHTML = place.icon;
          const body = UI.el('div', 'app-row-body');
          body.appendChild(UI.el('span', 'app-row-title', item.name));
          body.appendChild(UI.el('span', 'app-row-meta', UI.fmtDate(item.updated) + (item.size ? ' · ' + UI.fmtBytes(item.size) : '')));
          row.append(ico, body);
          row.addEventListener('click', () => { selected = item; renderList(); });
          row.addEventListener('dblclick', () => place.open(item));
          row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); place.open(item); }
          });
          listEl.appendChild(row);
        });
        statusCount.textContent = items.length + (items.length === 1 ? ' item' : ' items');
      }

      const newBtn = UI.btn('New', 'primary');
      newBtn.addEventListener('click', () => { if (place.isApp) place.create(); else fileInput.click(); });
      const uploadBtn = UI.btn('Upload', '');
      uploadBtn.addEventListener('click', () => fileInput.click());
      const openBtn = UI.btn('Open');
      openBtn.addEventListener('click', () => { if (selected) place.open(selected); else UI.toast('Select an item first.'); });
      const renameBtn = UI.btn('Rename');
      renameBtn.addEventListener('click', async () => {
        if (!selected) { UI.toast('Select an item first.'); return; }
        const name = await UI.prompt('Rename "' + selected.name + '"', { value: selected.name, confirmLabel: 'Rename' });
        if (!name) return;
        await place.rename(selected, name);
        await refresh();
      });
      const delBtn = UI.btn('Delete');
      delBtn.addEventListener('click', async () => {
        if (!selected) { UI.toast('Select an item first.'); return; }
        const ok = await UI.confirm('Delete "' + selected.name + '"? This cannot be undone.', { confirmLabel: 'Delete' });
        if (!ok) return;
        await place.remove(selected);
        selected = null;
        await refresh();
        refreshUsage();
      });
      const dlBtn = UI.btn('Download');
      dlBtn.addEventListener('click', async () => {
        if (!selected) { UI.toast('Select an item first.'); return; }
        if (place.key !== 'uploads') { UI.toast('Only uploads can be downloaded. Open it to export.'); return; }
        const blob = await Store.get(STORE, 'blob_' + selected.id, null);
        if (!blob || !blob.dataUrl) { UI.toast('File data missing.'); return; }
        await UI.saveFile(selected.name, blob.dataUrl, blob.type);
      });
      const refreshBtn = UI.iconBtn('Refresh', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-.7 4.6"/><path d="M20 5v6h-6"/></svg>');
      refreshBtn.addEventListener('click', refresh);

      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = '';
        if (!files.length) return;
        statusNote.textContent = '';
        const index = (await Store.get(STORE, UPLOADS, [])) || [];
        const total = files.length;
        let done = 0;
        let added = 0;
        let skipped = 0;
        progress.hidden = false;
        setProgress(0);
        for (const file of files) {
          if (file.size > MAX_BYTES) {
            skipped++;
            done++;
            setProgress(done / total);
            continue;
          }
          statusNote.textContent = 'Uploading ' + (done + 1) + ' of ' + total + ' · ' + file.name;
          const dataUrl = await UI.readAsDataURL(file);
          const id = UI.uid('file');
          const entry = { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, updated: Date.now() };
          try {
            await Store.setWithProgress(STORE, 'blob_' + id, { dataUrl, type: entry.type }, (p) => {
              setProgress((done + p) / total);
            });
            index.push(entry);
            added++;
          } catch (e) {
            skipped++;
          }
          done++;
          setProgress(done / total);
        }
        progress.hidden = true;
        setProgress(0);
        let saved = true;
        try {
          await Store.set(STORE, UPLOADS, index);
        } catch (e) {
          saved = false;
        }
        if (place.key !== 'uploads') await selectPlace(uploads);
        else await refresh();
        refreshUsage();
        if (!saved) {
          statusNote.textContent = 'Not enough storage — nothing was saved.';
        } else if (added) {
          UI.toast('Uploaded ' + added + (added === 1 ? ' file.' : ' files.'));
          if (skipped) statusNote.textContent = skipped + ' skipped (over ' + UI.fmtBytes(MAX_BYTES) + ').';
        } else if (skipped) {
          statusNote.textContent = 'Nothing uploaded — all files exceeded ' + UI.fmtBytes(MAX_BYTES) + '.';
        }
      });

      bar.append(newBtn, uploadBtn, UI.sep(), openBtn, renameBtn, delBtn, dlBtn, UI.sep(), refreshBtn, fileInput);
      split.append(aside, main);
      main.appendChild(listEl);
      shell.append(bar, split, progress, status);
      root.appendChild(shell);

      (async () => {
        renderSidebar();
        await refresh();
      })();
    }
  };
})();
