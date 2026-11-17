(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v10l-5 5H5z"/><path d="M19 14h-5v5"/></svg>';
  const STORE = 'notes';

  const loadIndex = async () => (await Store.get(STORE, 'index', [])) || [];
  const saveIndex = (index) => Store.set(STORE, 'index', index);

  function deriveTitle(body) {
    const line = String(body || '').split(/\r?\n/).find((l) => l.trim());
    return line ? line.trim().slice(0, 60) : 'Untitled note';
  }

  APPS.notes = {
    id: 'notes',
    name: 'Lemon Notes',
    shortName: 'Notes',
    icon: ICON,
    width: 830,
    height: 600,
    singleton: false,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const split = UI.el('div', 'app-split');
      const aside = UI.el('aside', 'app-side');
      const main = UI.el('section', 'app-main');
      const status = UI.status();
      const statusMeta = UI.el('span', 'app-status-grow', '');
      status.appendChild(statusMeta);

      let notes = [];
      let current = null;
      let filter = '';
      let titleInput = null;
      let bodyArea = null;

      const saveNow = async () => {
        if (!current) return;
        current.body = bodyArea.value;
        current.title = (titleInput.value || '').trim() || deriveTitle(current.body);
        current.updated = Date.now();
        const entry = notes.find((n) => n.id === current.id);
        if (entry) { entry.title = current.title; entry.updated = current.updated; }
        await Store.set(STORE, current.id, current);
        await saveIndex(notes);
        renderSidebar();
        win.setTitle(current.title);
        statusMeta.textContent = 'Saved · ' + UI.fmtDate(current.updated);
      };
      const autosave = UI.debounce(() => { statusMeta.textContent = 'Saving…'; saveNow(); }, 600);

      function renderSidebar() {
        aside.textContent = '';
        const head = UI.el('div', 'app-side-head', 'Notes');
        const search = UI.field(filter, 'Search notes');
        search.className = 'app-input app-side-search';
        search.addEventListener('input', () => {
          filter = search.value.trim().toLowerCase();
          renderList();
        });
        const list = UI.el('div', 'app-list');
        aside.append(head, search, list);

        function renderList() {
          list.textContent = '';
          const filtered = notes
            .filter((n) => !filter || n.title.toLowerCase().indexOf(filter) !== -1)
            .sort((a, b) => b.updated - a.updated);
          if (!filtered.length) {
            list.appendChild(UI.el('p', 'app-side-note', notes.length ? 'No matches.' : 'No notes yet.'));
          }
          filtered.forEach((note) => {
            const row = UI.el('div', 'app-row' + (current && current.id === note.id ? ' sel' : ''));
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            const body = UI.el('div', 'app-row-body');
            body.appendChild(UI.el('span', 'app-row-title', note.title));
            body.appendChild(UI.el('span', 'app-row-meta', UI.fmtDate(note.updated)));
            row.appendChild(body);
            const del = UI.iconBtn('Delete ' + note.title, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12"/></svg>', 'ghost');
            del.addEventListener('click', async (e) => {
              e.stopPropagation();
              const ok = await UI.confirm('Delete "' + note.title + '"?', { confirmLabel: 'Delete' });
              if (!ok) return;
              notes = notes.filter((n) => n.id !== note.id);
              await saveIndex(notes);
              await Store.del(STORE, note.id);
              if (current && current.id === note.id) { current = null; showEditor(); }
              renderSidebar();
            });
            row.appendChild(del);
            row.addEventListener('click', () => openNote(note.id));
            row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openNote(note.id); } });
            list.appendChild(row);
          });
        }
        renderList();
      }

      function showEditor() {
        main.textContent = '';
        if (!current) {
          const empty = UI.empty('No note open', 'Create a note or pick one from the list.');
          const start = UI.btn('New note', 'primary');
          start.addEventListener('click', newNote);
          empty.appendChild(start);
          main.appendChild(empty);
          titleInput = null;
          bodyArea = null;
          statusMeta.textContent = '';
          return;
        }
        const editor = UI.el('div', 'nt-editor');
        titleInput = UI.field(current.title, 'Note title');
        titleInput.className = 'app-title-input';
        bodyArea = UI.el('textarea', 'nt-body');
        bodyArea.placeholder = 'Write something…';
        bodyArea.spellcheck = true;
        bodyArea.value = current.body || '';
        const head = UI.el('div', 'nt-head');
        head.appendChild(titleInput);
        editor.append(head, bodyArea);
        main.appendChild(editor);

        const sync = () => {
          const t = bodyArea.value;
          const words = UI.words(t);
          statusMeta.textContent = t.length + ' chars · ' + words + (words === 1 ? ' word' : ' words');
        };
        bodyArea.addEventListener('input', () => { sync(); autosave(); });
        titleInput.addEventListener('input', () => { win.setTitle(titleInput.value || 'Untitled note'); autosave(); });
        win.setTitle(current.title || 'Untitled note');
        sync();
        if (win.payload && win.payload.focusBody) bodyArea.focus();
        else titleInput.focus();
      }

      async function openNote(id) {
        if (current && current.id !== id) await saveNow();
        const note = await Store.get(STORE, id, null);
        if (!note) { UI.toast('That note is missing.'); return; }
        current = note;
        showEditor();
        renderSidebar();
      }

      async function newNote() {
        if (current) await saveNow();
        const note = { id: UI.uid('note'), title: '', body: '', updated: Date.now() };
        notes.push({ id: note.id, title: note.title, updated: note.updated });
        await Store.set(STORE, note.id, note);
        await saveIndex(notes);
        current = note;
        showEditor();
        renderSidebar();
        if (titleInput) { titleInput.focus(); titleInput.select(); }
      }

      async function importFile(payload) {
        const raw = String(payload.name || 'Imported note');
        const title = raw.replace(/\.[^.]+$/, '').slice(0, 60) || 'Imported note';
        const note = { id: UI.uid('note'), title, body: String(payload.importText || ''), updated: Date.now() };
        const ok = await Store.set(STORE, note.id, note);
        if (!ok) { UI.toast('Not enough storage to import that file.'); showEditor(); return; }
        notes.push({ id: note.id, title: note.title, updated: note.updated });
        await saveIndex(notes);
        current = note;
        showEditor();
        renderSidebar();
        if (bodyArea) bodyArea.focus();
      }

      const newBtn = UI.btn('New', 'primary');
      newBtn.addEventListener('click', newNote);
      const copyBtn = UI.btn('Copy');
      copyBtn.addEventListener('click', async () => {
        if (!current) { UI.toast('Open a note first.'); return; }
        const ok = await UI.copy(bodyArea.value);
        UI.toast(ok ? 'Note copied.' : 'Copy not available.');
      });
      const dlBtn = UI.btn('Download');
      dlBtn.addEventListener('click', async () => {
        if (!current) { UI.toast('Open a note first.'); return; }
        await saveNow();
        const name = (current.title || 'note').replace(/[^\w.-]+/g, '-').toLowerCase() + '.md';
        UI.saveFile(name, '# ' + current.title + '\n\n' + current.body, 'text/markdown');
      });

      bar.append(newBtn, UI.sep(), copyBtn, dlBtn);
      split.append(aside, main);
      shell.append(bar, split, status);
      root.appendChild(shell);
      win.onClose(() => { saveNow(); });

      (async () => {
        notes = await loadIndex();
        if (win.payload && typeof win.payload.importText === 'string') {
          await importFile(win.payload);
          renderSidebar();
          return;
        }
        if (win.payload && win.payload.key) await openNote(win.payload.key);
        else if (notes.length) await openNote(notes.slice().sort((a, b) => b.updated - a.updated)[0].id);
        else showEditor();
        renderSidebar();
      })();
    }
  };
})();
