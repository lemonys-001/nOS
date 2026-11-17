(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>';
  const FOLDERS = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'sent', label: 'Sent' },
    { id: 'archive', label: 'Archive' }
  ];

  function me() {
    const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
    if (!session) return { name: 'Guest', email: 'guest@lemonos' };
    return {
      name: session.provider === 'guest' ? 'Guest' : (session.name || 'Me'),
      email: session.provider === 'guest' ? 'guest@lemonos' : (session.email || 'me@lemonos')
    };
  }

  APPS.mail = {
    id: 'mail',
    name: 'Mail',
    shortName: 'Mail',
    icon: ICON,
    width: 900,
    height: 640,
    singleton: true,
    desktop: true,

    mount(root, win) {
      const shell = UI.el('div', 'app');
      const bar = UI.el('div', 'app-bar');
      const split = UI.el('div', 'app-split');
      const aside = UI.el('aside', 'app-side');
      const main = UI.el('section', 'app-main');
      const status = UI.status();
      const statusNote = UI.el('span', 'app-status-grow', '');
      const unreadNote = UI.el('span', null, '');
      status.append(statusNote, unreadNote);

      let index = [];
      let folder = 'inbox';
      let view = 'list';
      let openId = null;
      let draft = { to: '', subject: '', body: '' };

      const composeBtn = UI.btn('Compose', 'primary');
      bar.append(UI.el('span', 'app-bar-title', 'Mail'), UI.el('span', 'app-status-grow'), composeBtn);

      function counts() {
        const c = { inbox: 0, drafts: 0, sent: 0, archive: 0 };
        let unread = 0;
        index.forEach((m) => {
          if (c[m.folder] !== undefined) c[m.folder] += 1;
          if (m.folder === 'inbox' && m.unread) unread += 1;
        });
        c._unread = unread;
        return c;
      }

      function saveIndex() {
        return Store.set('mail', 'index', index);
      }

      function saveMessage(msg) {
        return Store.set('mail', msg.id, msg);
      }

      function renderAside() {
        const c = counts();
        aside.textContent = '';
        aside.appendChild(UI.el('div', 'app-side-head', 'Folders'));
        const list = UI.el('div', 'app-list');
        FOLDERS.forEach((f) => {
          const row = UI.el('div', 'app-row' + (f.id === folder && view !== 'compose' ? ' sel' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const ico = UI.el('span', 'app-row-ico');
          ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>';
          const body = UI.el('div', 'app-row-body');
          body.appendChild(UI.el('span', 'app-row-title', f.label));
          const meta = UI.el('span', 'app-row-meta', String(c[f.id] || 0));
          row.append(ico, body, meta);
          const go = () => { folder = f.id; view = 'list'; openId = null; render(); };
          row.addEventListener('click', go);
          row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          list.appendChild(row);
        });
        aside.appendChild(list);
      }

      function fmtTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      function renderList() {
        const items = index.filter((m) => m.folder === folder).sort((a, b) => (b.updated || 0) - (a.updated || 0));
        statusNote.textContent = FOLDERS.find((f) => f.id === folder).label + ' · ' + items.length + ' message' + (items.length === 1 ? '' : 's');
        if (!items.length) {
          main.appendChild(UI.empty(
            folder === 'inbox' ? 'No messages yet' : (folder === 'drafts' ? 'No drafts' : (folder === 'sent' ? 'Nothing sent' : 'Archive is empty')),
            folder === 'inbox'
              ? 'nOS has no mail server, so nothing arrives on its own. Use Compose to write, or Import to load a saved .eml or .txt message from this device.'
              : 'Messages you move here will show up in this folder.'));
          return;
        }
        const list = UI.el('div', 'ml-list');
        items.forEach((m) => {
          const who = folder === 'sent' || folder === 'drafts' ? 'To: ' + (m.to || '—') : (m.from || '—');
          const row = UI.el('div', 'ml-row' + (m.unread && folder === 'inbox' ? ' unread' : ''));
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          const top = UI.el('div', 'ml-top');
          top.appendChild(UI.el('span', 'ml-who', who));
          top.appendChild(UI.el('span', 'ml-time', fmtTime(m.updated)));
          const subj = UI.el('div', 'ml-subject', m.subject || '(no subject)');
          const prev = UI.el('div', 'ml-preview', m.preview || '');
          row.append(top, subj, prev);
          row.addEventListener('click', () => openMessage(m.id));
          row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMessage(m.id); } });
          list.appendChild(row);
        });
        main.appendChild(list);
      }

      async function openMessage(id) {
        const msg = await Store.get('mail', id, null);
        if (!msg) { view = 'list'; render(); return; }
        openId = id;
        view = 'read';
        if (msg.unread) {
          msg.unread = false;
          const sum = index.find((m) => m.id === id);
          if (sum) sum.unread = false;
          await saveMessage(msg);
          await saveIndex();
        }
        render();
      }

      function renderRead() {
        const container = UI.el('div', 'ml-read');
        const head = UI.el('div', 'ml-read-head');
        const backBtn = UI.btn('Back');
        backBtn.addEventListener('click', () => { view = 'list'; openId = null; render(); });
        const replyBtn = UI.btn('Reply', 'primary');
        const archiveBtn = UI.btn('Archive');
        const delBtn = UI.btn('Delete', 'danger');
        head.append(backBtn, UI.el('span', 'app-status-grow'), replyBtn, archiveBtn, delBtn);
        container.appendChild(head);

        const meta = UI.el('div', 'ml-read-meta');
        const title = UI.el('h2', 'ml-read-subject', '');
        meta.appendChild(title);
        const from = UI.el('div', 'ml-read-line');
        const to = UI.el('div', 'ml-read-line');
        const date = UI.el('div', 'ml-read-line');
        meta.append(from, to, date);
        const body = UI.el('div', 'ml-read-body');
        container.appendChild(meta);
        container.appendChild(body);
        main.appendChild(container);

        Store.get('mail', openId, null).then((msg) => {
          if (!msg) { view = 'list'; render(); return; }
          title.textContent = msg.subject || '(no subject)';
          from.textContent = 'From: ' + (msg.from || '—');
          to.textContent = 'To: ' + (msg.to || '—');
          date.textContent = msg.updated ? new Date(msg.updated).toLocaleString() : '';
          body.textContent = msg.body || '';

          replyBtn.onclick = () => {
            draft = {
              to: (msg.from || '').indexOf('@') >= 0 ? msg.from : '',
              subject: /^re:/i.test(msg.subject || '') ? msg.subject : 'Re: ' + (msg.subject || ''),
              body: '\n\n--- ' + (msg.from || '') + ' wrote ---\n' + (msg.body || '')
            };
            view = 'compose';
            render();
          };
          archiveBtn.onclick = async () => {
            msg.folder = 'archive';
            msg.updated = Date.now();
            await saveMessage(msg);
            const sum = index.find((m) => m.id === msg.id);
            if (sum) { sum.folder = 'archive'; sum.updated = msg.updated; }
            await saveIndex();
            UI.toast('Moved to Archive');
            view = 'list';
            openId = null;
            render();
          };
          delBtn.onclick = async () => {
            const ok = await UI.confirm('Delete this message? This cannot be undone.', { confirmLabel: 'Delete' });
            if (!ok) return;
            await Store.del('mail', msg.id);
            index = index.filter((m) => m.id !== msg.id);
            await saveIndex();
            UI.toast('Message deleted');
            view = 'list';
            openId = null;
            render();
          };
        });
      }

      function renderCompose() {
        const form = UI.el('div', 'ml-compose');
        const head = UI.el('div', 'ml-read-head');
        const backBtn = UI.btn('Discard');
        const saveBtn = UI.btn('Save draft');
        const sendBtn = UI.btn('Send', 'primary');
        head.append(backBtn, UI.el('span', 'app-status-grow'), saveBtn, sendBtn);
        form.appendChild(head);

        const toField = UI.field(draft.to, 'Recipient address');
        toField.setAttribute('aria-label', 'To');
        const subjField = UI.field(draft.subject, 'Subject');
        subjField.setAttribute('aria-label', 'Subject');
        const body = UI.el('textarea', 'ml-compose-body');
        body.value = draft.body;
        body.placeholder = 'Write your message…';
        body.setAttribute('aria-label', 'Message body');
        form.append(toField, subjField, body);
        main.appendChild(form);

        backBtn.onclick = () => { view = 'list'; render(); };

        const makeMessage = (targetFolder) => ({
          id: 'msg_' + UI.uid('x').replace(/[^a-z0-9]/gi, '').slice(0, 12),
          folder: targetFolder,
          from: me().email,
          to: toField.value.trim(),
          subject: subjField.value.trim(),
          body: body.value,
          preview: body.value.replace(/\s+/g, ' ').trim().slice(0, 90),
          updated: Date.now(),
          unread: false
        });

        saveBtn.onclick = async () => {
          const msg = makeMessage('drafts');
          await saveMessage(msg);
          index.push({ id: msg.id, folder: 'drafts', from: msg.from, to: msg.to, subject: msg.subject, preview: msg.preview, updated: msg.updated, unread: false });
          await saveIndex();
          UI.toast('Saved to Drafts');
          folder = 'drafts';
          view = 'list';
          render();
        };

        sendBtn.onclick = async () => {
          if (!toField.value.trim()) { UI.toast('Add a recipient first'); toField.focus(); return; }
          const msg = makeMessage('sent');
          await saveMessage(msg);
          index.push({ id: msg.id, folder: 'sent', from: msg.from, to: msg.to, subject: msg.subject, preview: msg.preview, updated: msg.updated, unread: false });
          await saveIndex();
          UI.toast('Saved to Sent — nOS does not relay email');
          folder = 'sent';
          view = 'list';
          render();
        };

        toField.focus();
      }

      function render() {
        main.textContent = '';
        renderAside();
        const c = counts();
        unreadNote.textContent = c._unread ? c._unread + ' unread' : 'All read';
        if (view === 'read' && openId) renderRead();
        else if (view === 'compose') renderCompose();
        else renderList();
        win.setTitle('Mail');
      }

      composeBtn.addEventListener('click', () => {
        draft = { to: '', subject: '', body: '' };
        view = 'compose';
        render();
      });

      const importInput = document.createElement('input');
      importInput.type = 'file';
      importInput.accept = '.txt,.eml,.md,text/plain';
      importInput.style.display = 'none';
      importInput.addEventListener('change', () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        UI.readAsText(file).then(async (text) => {
          const parsed = parseMessage(text, file.name);
          const msg = {
            id: 'msg_' + UI.uid('x').replace(/[^a-z0-9]/gi, '').slice(0, 12),
            folder: 'inbox',
            from: parsed.from,
            to: parsed.to,
            subject: parsed.subject,
            body: parsed.body,
            preview: parsed.body.replace(/\s+/g, ' ').trim().slice(0, 90),
            updated: Date.now(),
            unread: true
          };
          await saveMessage(msg);
          index.push({ id: msg.id, folder: 'inbox', from: msg.from, to: msg.to, subject: msg.subject, preview: msg.preview, updated: msg.updated, unread: true });
          await saveIndex();
          folder = 'inbox';
          view = 'list';
          UI.toast('Imported ' + file.name);
          render();
        }).catch(() => UI.toast('Could not read that file'));
        importInput.value = '';
      });
      root.appendChild(importInput);

      function parseMessage(text, fallbackName) {
        const clean = String(text || '');
        const split = clean.split(/\r?\n\r?\n/);
        const out = { from: 'Imported file', to: me().email, subject: fallbackName || '(no subject)', body: clean };
        if (split.length > 1) {
          const headerBlock = split[0];
          const headers = {};
          headerBlock.split(/\r?\n/).forEach((line) => {
            const i = line.indexOf(':');
            if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
          });
          if (headers.from || headers.subject || headers.to) {
            out.from = headers.from || out.from;
            out.to = headers.to || out.to;
            out.subject = headers.subject || out.subject;
            out.body = split.slice(1).join('\n\n');
          }
        }
        return out;
      }

      const importBtn = UI.btn('Import');
      importBtn.addEventListener('click', () => importInput.click());
      bar.insertBefore(importBtn, composeBtn);

      (async () => {
        index = (await Store.get('mail', 'index', [])) || [];
        render();
      })();

      shell.append(bar, split, status);
      split.append(aside, main);
      root.appendChild(shell);
    }
  };
})();
