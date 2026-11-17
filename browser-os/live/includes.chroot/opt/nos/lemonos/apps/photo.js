(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m5 16 4.5-5 3 3.2L16 10l3 4"/><circle cx="8.5" cy="9" r="1.2"/></svg>';
  const STORE = 'photos';
  const INDEX = 'library';
  const MAX_BYTES = 900 * 1024;

  const loadIndex = async () => (await Store.get(STORE, INDEX, [])) || [];
  const saveIndex = (index) => Store.set(STORE, INDEX, index);

  APPS.photo = {
    id: 'photo',
    name: 'Lemon Photos',
    shortName: 'Photos',
    icon: ICON,
    width: 920,
    height: 620,
    singleton: false,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const main = UI.el('section', 'app-main ph-main');
      const status = UI.status();
      const statusCount = UI.el('span', null, '');
      const statusNote = UI.el('span', 'app-status-grow', '');
      status.append(statusCount, statusNote);

      let photos = [];
      let viewing = -1;
      let lightbox = null;

      const fileInput = UI.el('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.multiple = true;
      fileInput.hidden = true;

      function renderGallery() {
        main.textContent = '';
        lightbox = null;
        if (!photos.length) {
          const empty = UI.empty('No photos yet', 'Upload images to build your library. Each file can be up to ' + UI.fmtBytes(MAX_BYTES) + '.');
          const up = UI.btn('Upload images', 'primary');
          up.addEventListener('click', () => fileInput.click());
          empty.appendChild(up);
          main.appendChild(empty);
        } else {
          const grid = UI.el('div', 'ph-grid');
          photos.forEach((p, i) => {
            const cell = UI.el('button', 'ph-cell');
            cell.type = 'button';
            cell.title = p.name;
            const img = UI.el('img', 'ph-thumb');
            img.loading = 'lazy';
            img.alt = p.name;
            img.src = p.dataUrl;
            cell.appendChild(img);
            cell.addEventListener('click', () => openLightbox(i));
            grid.appendChild(cell);
          });
          main.appendChild(grid);
        }
        statusCount.textContent = photos.length + (photos.length === 1 ? ' photo' : ' photos');
      }

      function openLightbox(i) {
        viewing = i;
        if (!lightbox) {
          lightbox = UI.el('div', 'ph-lightbox');
          main.appendChild(lightbox);
        }
        paintLightbox();
      }

      function closeLightbox() {
        viewing = -1;
        if (lightbox) { lightbox.remove(); lightbox = null; }
      }

      function paintLightbox() {
        if (!lightbox || viewing < 0) return;
        const p = photos[viewing];
        lightbox.textContent = '';
        const img = UI.el('img', 'ph-full');
        img.alt = p.name;
        img.src = p.dataUrl;
        const bar2 = UI.el('div', 'ph-lb-bar');
        const prev = UI.iconBtn('Previous', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>');
        const next = UI.iconBtn('Next', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>');
        const dl = UI.btn('Download');
        const del = UI.btn('Delete');
        const close = UI.btn('Close');
        prev.addEventListener('click', () => step(-1));
        next.addEventListener('click', () => step(1));
        dl.addEventListener('click', () => download(p));
        del.addEventListener('click', () => remove(p));
        close.addEventListener('click', closeLightbox);
        const meta = UI.el('span', 'ph-lb-meta', (viewing + 1) + ' / ' + photos.length + ' · ' + UI.fmtBytes(p.size));
        bar2.append(prev, next, meta, dl, del, close);
        const cap = UI.el('div', 'ph-lb-cap', p.name);
        lightbox.append(img, bar2, cap);
      }

      function step(dir) {
        if (!photos.length) return;
        viewing = (viewing + dir + photos.length) % photos.length;
        paintLightbox();
      }

      function download(p) {
        UI.saveFile(p.name, p.dataUrl, p.type);
      }

      async function remove(p) {
        const ok = await UI.confirm('Delete "' + p.name + '"?', { confirmLabel: 'Delete' });
        if (!ok) return;
        photos = photos.filter((x) => x.id !== p.id);
        await saveIndex(photos.map(stripData));
        await Store.del(STORE, 'img_' + p.id);
        closeLightbox();
        renderGallery();
      }

      const stripData = (p) => ({ id: p.id, name: p.name, type: p.type, size: p.size, updated: p.updated });

      function onKey(e) {
        if (viewing < 0) return;
        if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      }
      shell.tabIndex = -1;
      shell.addEventListener('keydown', onKey);

      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files || []).filter((f) => /^image\//.test(f.type));
        fileInput.value = '';
        if (!files.length) { statusNote.textContent = 'Only image files are supported.'; return; }
        statusNote.textContent = '';
        let added = 0;
        let skipped = 0;
        for (const file of files) {
          if (file.size > MAX_BYTES) { skipped++; continue; }
          const dataUrl = await UI.readAsDataURL(file);
          const id = UI.uid('img');
          const entry = { id, name: file.name, type: file.type, size: file.size, updated: Date.now(), dataUrl };
          try {
            await Store.set(STORE, 'img_' + id, dataUrl);
            photos.push(entry);
            added++;
          } catch (e) {
            skipped++;
          }
        }
        try {
          await saveIndex(photos.map(stripData));
        } catch (e) {
          statusNote.textContent = 'Not enough storage — nothing was saved.';
          renderGallery();
          return;
        }
        renderGallery();
        if (added) UI.toast('Added ' + added + (added === 1 ? ' photo.' : ' photos.'));
        if (skipped) statusNote.textContent = skipped + ' skipped (over ' + UI.fmtBytes(MAX_BYTES) + ').';
      });

      const upBtn = UI.btn('Upload', 'primary');
      upBtn.addEventListener('click', () => fileInput.click());
      const refreshBtn = UI.iconBtn('Refresh', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-.7 4.6"/><path d="M20 5v6h-6"/></svg>');
      refreshBtn.addEventListener('click', load);

      bar.append(upBtn, refreshBtn, fileInput);
      shell.append(bar, main, status);
      root.appendChild(shell);

      async function load() {
        const index = await loadIndex();
        photos = [];
        for (const meta of index) {
          const dataUrl = await Store.get(STORE, 'img_' + meta.id, null);
          if (dataUrl) photos.push(Object.assign({}, meta, { dataUrl }));
        }
        photos.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        renderGallery();
      }

      (async () => { await load(); })();
    }
  };
})();
