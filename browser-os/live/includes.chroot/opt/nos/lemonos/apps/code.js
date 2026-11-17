(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13.5 5-3 14"/></svg>';
  const STORE = 'code';
  const LANGS = [
    { id: 'javascript', label: 'JavaScript', ext: 'js', mono: 'javascript' },
    { id: 'html', label: 'HTML', ext: 'html', mono: 'html' },
    { id: 'css', label: 'CSS', ext: 'css', mono: 'css' },
    { id: 'json', label: 'JSON', ext: 'json', mono: 'json' },
    { id: 'markdown', label: 'Markdown', ext: 'md', mono: 'markdown' },
    { id: 'python', label: 'Python', ext: 'py', mono: 'python' },
    { id: 'text', label: 'Plain text', ext: 'txt', mono: 'plaintext' }
  ];
  const extOf = (lang) => (LANGS.find((l) => l.id === lang) || LANGS[LANGS.length - 1]).ext;
  const monoOf = (lang) => (LANGS.find((l) => l.id === lang) || LANGS[LANGS.length - 1]).mono;

  const APP_TEMPLATE = `// A nOS community app. Give it a unique id and name, build your UI,
// then press Publish in the toolbar to ship it to the App Store.
(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>';

  CUSTOM_APPS['my-lemon-app'] = {
    id: 'my-lemon-app',
    name: 'My Lemon App',
    shortName: 'My App',
    icon: ICON,
    width: 640,
    height: 480,
    singleton: false,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const body = UI.el('div', 'app-main');

      bar.appendChild(UI.el('span', 'app-bar-title', 'My Lemon App'));
      bar.appendChild(UI.el('span', 'app-status-grow'));

      body.appendChild(UI.el('h2', null, 'Hello, nOS'));
      body.appendChild(UI.el('p', null, 'This is your app. Build it with the nOS window manager.'));
      const btn = UI.btn('Say hello', 'primary');
      btn.addEventListener('click', () => UI.toast('Hello from your app!'));
      body.appendChild(btn);

      root.appendChild(shell);
      win.setTitle('My Lemon App');
    }
  };
})();`;

  const loadIndex = async () => (await Store.get(STORE, 'index', [])) || [];
  const saveIndex = (index) => Store.set(STORE, 'index', index);

  let monaco = null;
  let monacoReady = null;

  function loadMonaco() {
    if (monacoReady) return monacoReady;
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    monacoReady = new Promise((resolve, reject) => {
      if (window.monaco) { resolve(window.monaco); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.MonacoEnvironment = {
          getWorkerUrl: function (moduleId, label) {
            return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.worker.js';
          }
        };
        resolve(window.monaco);
      };
      script.onerror = () => reject(new Error('Monaco did not load'));
      document.head.appendChild(script);
    });
    return monacoReady;
  }

  APPS.code = {
    id: 'code',
    name: 'Lemon Code',
    shortName: 'Code',
    icon: ICON,
    width: 920,
    height: 620,
    singleton: false,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const split = UI.el('div', 'app-split');
      const aside = UI.el('aside', 'app-side');
      const main = UI.el('section', 'app-main');
      const status = UI.status();
      const statusLines = UI.el('span', null, '');
      const statusLang = UI.el('span', 'app-status-grow', '');
      status.append(statusLines, statusLang);

      let items = [];
      let current = null;
      let editor = null;
      let editorKind = 'textarea';
      let gutter = null;
      let monacoEditor = null;
      let preview = null;
      let nameInput = null;
      let langSelect = null;

      function getValue() {
        if (editorKind === 'monaco' && monacoEditor) return monacoEditor.getValue();
        return editor ? editor.value : '';
      }
      function setValue(v) {
        if (editorKind === 'monaco' && monacoEditor) { monacoEditor.setValue(v || ''); return; }
        if (editor) editor.value = v || '';
      }
      function onChange(cb) {
        if (editorKind === 'monaco' && monacoEditor) {
          monacoEditor.onDidChangeModelContent(() => cb());
          return;
        }
        if (editor) editor.addEventListener('input', cb);
      }

      const saveNow = async () => {
        if (!current) return;
        current.name = (nameInput.value || '').trim() || 'Untitled';
        current.lang = langSelect.value;
        current.code = getValue();
        current.updated = Date.now();
        const entry = items.find((x) => x.id === current.id);
        if (entry) { entry.name = current.name; entry.lang = current.lang; entry.updated = current.updated; }
        await Store.set(STORE, current.id, current);
        await saveIndex(items);
        renderSidebar();
        win.setTitle(current.name);
        statusLang.textContent = 'Saved · ' + UI.fmtDate(current.updated);
      };
      const autosave = UI.debounce(() => { statusLang.textContent = 'Saving…'; saveNow(); }, 700);

      function renderSidebar() {
        aside.textContent = '';
        aside.appendChild(UI.el('div', 'app-side-head', 'Snippets'));
        const list = UI.el('div', 'app-list');
        if (!items.length) list.appendChild(UI.el('p', 'app-side-note', 'No snippets yet.'));
        items.slice().sort((a, b) => b.updated - a.updated).forEach((s) => {
          const row = UI.el('div', 'app-row' + (current && current.id === s.id ? ' sel' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const body = UI.el('div', 'app-row-body');
          body.appendChild(UI.el('span', 'app-row-title', s.name));
          body.appendChild(UI.el('span', 'app-row-meta', (s.lang || 'text') + ' · ' + UI.fmtDate(s.updated)));
          row.appendChild(body);
          const del = UI.iconBtn('Delete ' + s.name, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12"/></svg>', 'ghost');
          del.addEventListener('click', async (e) => {
            e.stopPropagation();
            const ok = await UI.confirm('Delete "' + s.name + '"?', { confirmLabel: 'Delete' });
            if (!ok) return;
            items = items.filter((x) => x.id !== s.id);
            await saveIndex(items);
            await Store.del(STORE, s.id);
            if (current && current.id === s.id) { current = null; renderMain(); }
            renderSidebar();
          });
          row.appendChild(del);
          row.addEventListener('click', () => openSnippet(s.id));
          row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openSnippet(s.id); } });
          list.appendChild(row);
        });
        aside.appendChild(list);
      }

      function refreshGutter() {
        if (!gutter) return;
        const lines = String(getValue() || '').split('\n').length;
        let out = '';
        for (let i = 1; i <= lines; i++) out += i + '\n';
        gutter.textContent = out;
        gutter.scrollTop = (editor && editorKind === 'textarea') ? editor.scrollTop : 0;
        statusLines.textContent = lines + (lines === 1 ? ' line' : ' lines');
      }

      function renderMain() {
        main.textContent = '';
        if (!current) {
          const empty = UI.empty('No snippet open', 'Create one to start coding.');
          const start = UI.btn('New snippet', 'primary');
          start.addEventListener('click', newSnippet);
          empty.appendChild(start);
          main.appendChild(empty);
          editor = null; gutter = null; monacoEditor = null; preview = null;
          return;
        }
        nameInput.value = current.name;
        langSelect.value = current.lang || 'javascript';

        const wrap = UI.el('div', 'cd-wrap');
        gutter = UI.el('pre', 'cd-gutter');
        const editorHost = UI.el('div', 'cd-editor-host');
        editor = UI.el('textarea', 'cd-code');
        editor.spellcheck = false;
        editor.wrap = 'off';
        editor.value = current.code || '';
        wrap.appendChild(gutter);
        editorHost.appendChild(editor);
        wrap.appendChild(editorHost);

        preview = UI.el('div', 'cd-preview');
        preview.hidden = true;

        const shellEd = UI.el('div', 'cd-editor');
        shellEd.appendChild(wrap);
        shellEd.appendChild(preview);

        editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
        editor.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            if (e.shiftKey) {
              const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
              const seg = editor.value.slice(lineStart, end);
              const dedented = seg.replace(/^ {1,2}/, '');
              editor.value = editor.value.slice(0, lineStart) + dedented + editor.value.slice(end);
              editor.selectionStart = editor.selectionEnd = Math.max(lineStart, start - (seg.length - dedented.length));
            } else {
              editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
              editor.selectionStart = editor.selectionEnd = start + 2;
            }
            refreshGutter(); autosave();
            return;
          }
          if (e.key === 'Enter') {
            const start = editor.selectionStart;
            const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
            const indent = (editor.value.slice(lineStart, start).match(/^[ \t]*/) || [''])[0];
            if (indent) {
              e.preventDefault();
              const ins = '\n' + indent;
              editor.value = editor.value.slice(0, start) + ins + editor.value.slice(editor.selectionEnd);
              editor.selectionStart = editor.selectionEnd = start + ins.length;
              refreshGutter(); autosave();
            }
          }
        });

        editor.addEventListener('input', () => { refreshGutter(); autosave(); });

        main.appendChild(shellEd);
        refreshGutter();
        updatePreviewBtn();

        loadMonaco().then((monacoLib) => {
          monaco = monacoLib;
          try {
            const container = document.createElement('div');
            container.className = 'cd-monaco';
            editorHost.replaceChild(container, editor);
            monacoEditor = monacoLib.editor.create(container, {
              value: current.code || '',
              language: monoOf(current.lang || 'javascript'),
              theme: 'vs-dark',
              automaticLayout: true,
              minimap: { enabled: true },
              lineNumbers: 'on',
              wordWrap: 'off',
              scrollBeyondLastLine: false
            });
            monacoEditor.onDidChangeModelContent(() => { refreshGutter(); autosave(); });
            monacoEditor.onDidScrollChange((e) => { if (gutter) gutter.scrollTop = e.scrollTop; });
            editorKind = 'monaco';
            editor = null;
            refreshGutter();
          } catch (err) {
            editorKind = 'textarea';
            console.warn('Monaco editor unavailable, using textarea:', err && err.message);
          }
        }).catch(() => {
          editorKind = 'textarea';
        });
      }

      let previewBtn = null;

      function updatePreviewBtn() {
        if (!previewBtn) return;
        const isHtml = current && (current.lang || langSelect.value) === 'html';
        previewBtn.disabled = !isHtml;
        previewBtn.title = isHtml ? 'Preview HTML (scripts disabled)' : 'Preview available for HTML only';
        if (!isHtml && preview && !preview.hidden) { preview.hidden = true; preview.textContent = ''; }
      }

      function togglePreview() {
        if (!current || current.lang !== 'html') return;
        if (preview.hidden) {
          const frame = UI.el('iframe', 'cd-frame');
          frame.setAttribute('sandbox', '');
          frame.setAttribute('title', 'HTML preview');
          frame.srcdoc = getValue();
          preview.textContent = '';
          preview.appendChild(frame);
          preview.hidden = false;
        } else {
          preview.hidden = true;
          preview.textContent = '';
        }
      }

      async function openSnippet(id) {
        if (current) await saveNow();
        const rec = await Store.get(STORE, id, null);
        if (!rec) { UI.toast('That snippet is missing.'); return; }
        current = rec;
        renderMain();
        renderSidebar();
        win.setTitle(rec.name);
      }

      function langFromName(name) {
        const ext = (String(name || '').match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
        const found = LANGS.find((l) => l.ext === ext);
        if (found) return found.id;
        if (/^(js|mjs|cjs|jsx|ts|tsx)$/.test(ext)) return 'javascript';
        return 'text';
      }

      async function importFile(payload) {
        const raw = String(payload.name || 'imported.txt');
        const name = (raw.replace(/\.[^.]+$/, '') || 'Imported file').slice(0, 60);
        const rec = { id: UI.uid('code'), name, lang: langFromName(raw), code: String(payload.importText || ''), updated: Date.now() };
        const ok = await Store.set(STORE, rec.id, rec);
        if (!ok) { UI.toast('Not enough storage to import that file.'); renderMain(); return; }
        items.push({ id: rec.id, name: rec.name, lang: rec.lang, updated: rec.updated });
        await saveIndex(items);
        current = rec;
        renderMain();
        renderSidebar();
        win.setTitle(rec.name);
        if (nameInput) nameInput.focus();
      }

      async function newSnippet(kind) {
        if (current) await saveNow();
        let code = '';
        let name = 'Untitled';
        let lang = 'javascript';
        if (kind === 'lemon-app') {
          name = 'My Lemon App';
          code = APP_TEMPLATE;
        }
        const rec = { id: UI.uid('code'), name, lang, code, updated: Date.now() };
        items.push({ id: rec.id, name: rec.name, lang: rec.lang, updated: rec.updated });
        await Store.set(STORE, rec.id, rec);
        await saveIndex(items);
        current = rec;
        renderMain();
        renderSidebar();
        win.setTitle(rec.name);
        if (nameInput) { nameInput.focus(); nameInput.select(); }
      }

      nameInput = UI.field('', 'Snippet name');
      nameInput.className = 'app-title-input';
      nameInput.addEventListener('input', () => { if (current) { current.name = nameInput.value || 'Untitled'; win.setTitle(current.name); autosave(); } });

      langSelect = UI.el('select', 'app-input cd-select');
      LANGS.forEach((l) => {
        const opt = UI.el('option', null, l.label);
        opt.value = l.id;
        langSelect.appendChild(opt);
      });
      langSelect.addEventListener('change', () => {
        if (!current) return;
        current.lang = langSelect.value;
        statusLang.textContent = current.lang;
        updatePreviewBtn();
        if (monacoEditor) monacoEditor.model.changeLanguage(monoOf(current.lang));
        autosave();
      });

      const newBtn = UI.btn('New', 'primary');
      newBtn.addEventListener('click', () => newSnippet());
      const newAppBtn = UI.btn('New nOS app');
      newAppBtn.title = 'Start from a nOS app template';
      newAppBtn.addEventListener('click', () => newSnippet('lemon-app'));
      previewBtn = UI.btn('Preview');
      previewBtn.addEventListener('click', togglePreview);
      const copyBtn = UI.btn('Copy');
      copyBtn.addEventListener('click', async () => {
        if (!current) { UI.toast('Open a snippet first.'); return; }
        const ok = await UI.copy(getValue());
        UI.toast(ok ? 'Code copied.' : 'Copy not available.');
      });
      const dlBtn = UI.btn('Download');
      dlBtn.addEventListener('click', async () => {
        if (!current) { UI.toast('Open a snippet first.'); return; }
        await saveNow();
        const name = (current.name || 'snippet').replace(/[^\w.-]+/g, '-').toLowerCase() + '.' + extOf(current.lang);
        UI.saveFile(name, getValue(), 'text/plain');
      });

      async function publish() {
        if (!current) { UI.toast('Open a snippet first.'); return; }
        if ((current.lang || 'javascript') !== 'javascript') {
          UI.toast('Only JavaScript apps can be published.');
          return;
        }
        if (typeof Auth === 'undefined') { UI.toast('Publishing is unavailable right now.'); return; }
        const session = Auth.getSession();
        if (!session || session.provider === 'guest') { UI.toast('Sign in to publish apps.'); return; }
        let username = await Auth.ensureUsername();
        if (!username) username = await Auth.promptUsername();
        if (!username) return;
        await saveNow();
        const code = getValue();
        if (!code.trim()) { UI.toast('There is no code to publish.'); return; }
        const glyph = await UI.prompt('Icon for the store listing (one emoji)', { value: '🧩', confirmLabel: 'Publish' });
        if (glyph === null) return;
        statusLang.textContent = 'Publishing…';
        try {
          const res = await fetch(Auth.apiBase() + '/community', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + session.userId, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: current.name, glyph, code })
          });
          const body = await res.json();
          if (!body || !body.ok) {
            statusLang.textContent = 'Publish failed.';
            UI.toast((body && body.error) || 'Publish failed.');
            return;
          }
          statusLang.textContent = 'Published · ' + UI.fmtDate(Date.now());
          UI.toast('Published “' + body.app.name + '” to the App Store.');
        } catch (e) {
          statusLang.textContent = 'Publish failed.';
          UI.toast('Publish failed: ' + (e && e.message ? e.message : 'network error'));
        }
      }

      const publishBtn = UI.btn('Publish', 'primary');
      publishBtn.title = 'Publish this JavaScript app to the community App Store';
      publishBtn.addEventListener('click', publish);

      bar.append(newBtn, newAppBtn, nameInput, langSelect, UI.sep(), previewBtn, copyBtn, dlBtn, UI.sep(), publishBtn);
      split.append(aside, main);
      shell.append(bar, split, status);
      root.appendChild(shell);
      win.onClose(() => { saveNow(); });

      (async () => {
        items = await loadIndex();
        if (win.payload && typeof win.payload.importText === 'string') {
          await importFile(win.payload);
          renderSidebar();
          return;
        }
        if (win.payload && win.payload.key) await openSnippet(win.payload.key);
        else if (items.length) await openSnippet(items.slice().sort((a, b) => b.updated - a.updated)[0].id);
        else renderMain();
        renderSidebar();
      })();
    }
  };
})();
