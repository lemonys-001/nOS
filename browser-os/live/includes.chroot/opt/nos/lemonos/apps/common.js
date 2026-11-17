const UI = {
  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  },

  on(node, ev, fn, opts) {
    node.addEventListener(ev, fn, opts);
    return node;
  },

  uid(prefix) {
    const raw = crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return (prefix || 'id') + '_' + raw.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  },

  debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay ? time : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
  },

  fmtBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  },

  byteSize(text) {
    return new Blob([text == null ? '' : text]).size;
  },

  words(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  },

  download(filename, text, mime) {
    return UI.saveFile(filename, text, mime);
  },

  _toBlob(data, mime) {
    if (typeof data === 'string' && /^data:/.test(data)) {
      const comma = data.indexOf(',');
      const meta = data.slice(5, comma);
      const type = meta.split(';')[0] || mime || 'application/octet-stream';
      const payload = data.slice(comma + 1);
      if (/;base64/.test(meta)) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type });
      }
      return new Blob([decodeURIComponent(payload)], { type });
    }
    return new Blob([data == null ? '' : data], { type: mime || 'text/plain' });
  },

  isTextFile(name, type) {
    const t = String(type || '');
    const n = String(name || '');
    if (/^text\//.test(t)) return true;
    if (/(json|javascript|xml|csv|markdown|x-yaml|toml)/.test(t)) return true;
    return /\.(txt|md|markdown|js|mjs|cjs|jsx|ts|tsx|json|html?|css|py|rb|go|rs|java|c|h|cpp|hpp|sh|yml|yaml|toml|ini|log|csv|xml|svg)$/i.test(n);
  },

  textFromData(data, mime) {
    return UI._toBlob(data, mime).text();
  },

  _downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  _askSave(filename) {
    return new Promise((resolve) => {
      const { box, close } = UI.modal({ onClose: resolve });
      box.appendChild(UI.el('p', 'os-modal-msg', 'Save “' + filename + '”'));
      box.appendChild(UI.el('p', 'set-hint', 'Download a copy to this PC, or save it in nOS Files so it stays with your account.'));
      const row = UI.el('div', 'os-modal-row');
      const cancel = UI.btn('Cancel');
      const pc = UI.btn('Download to PC');
      const lo = UI.btn('Save to nOS', 'primary');
      row.append(cancel, pc, lo);
      box.appendChild(row);
      cancel.onclick = () => close(null);
      pc.onclick = () => close('pc');
      lo.onclick = () => close('lemonos');
      lo.focus();
    });
  },

  async _saveToFiles(filename, blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const id = UI.uid('file');
    const type = blob.type || 'application/octet-stream';
    const entry = { id, name: filename, type, size: blob.size, updated: Date.now() };
    const okBlob = await Store.set('files', 'blob_' + id, { dataUrl, type });
    if (!okBlob) return false;
    const index = (await Store.get('files', 'uploads', [])) || [];
    index.push(entry);
    return Store.set('files', 'uploads', index);
  },

  async saveFile(filename, data, mime) {
    const where = await UI._askSave(filename);
    if (!where) return null;
    const blob = UI._toBlob(data, mime);
    if (where === 'pc') {
      UI._downloadBlob(filename, blob);
      UI.toast('Downloaded to this device.');
      return 'pc';
    }
    const ok = await UI._saveToFiles(filename, blob);
    if (ok) { UI.toast('Saved to Files.'); return 'lemonos'; }
    UI.toast('Not enough nOS storage for that file.');
    return 'failed';
  },

  readAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  },

  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  },

  toast(message) {
    if (window.WM && WM.toast) WM.toast(message);
  },

  copy(text) {
    const fallback = () => {
      try {
        const area = UI.el('textarea');
        area.value = String(text == null ? '' : text);
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand && document.execCommand('copy');
        area.remove();
        return !!ok;
      } catch (e) {
        return false;
      }
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(String(text == null ? '' : text)).then(() => true).catch(fallback);
    }
    return Promise.resolve(fallback());
  },

  btn(label, cls) {
    const b = UI.el('button', 'app-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    return b;
  },

  iconBtn(label, svg, cls) {
    const b = UI.el('button', 'app-btn icon' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = svg;
    return b;
  },

  sep() {
    return UI.el('span', 'app-sep');
  },

  empty(title, body) {
    const box = UI.el('div', 'app-empty');
    box.appendChild(UI.el('strong', null, title));
    if (body) box.appendChild(UI.el('p', null, body));
    return box;
  },

  status() {
    return UI.el('div', 'app-status');
  },

  field(value, placeholder) {
    const input = UI.el('input', 'app-input');
    input.type = 'text';
    input.value = value == null ? '' : value;
    if (placeholder) input.placeholder = placeholder;
    input.spellcheck = false;
    return input;
  },

  modal(opts) {
    const options = opts || {};
    const overlay = UI.el('div', 'os-modal');
    const box = UI.el('div', 'os-modal-box');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (typeof options.onClose === 'function') options.onClose(value);
      return value;
    };
    function onKey(e) {
      if (e.key === 'Escape') close(null);
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) close(null);
    });
    return { overlay, box, close };
  },

  confirm(message, opts) {
    const options = opts || {};
    return new Promise((resolve) => {
      const { box, close } = UI.modal({ onClose: resolve });
      box.appendChild(UI.el('p', 'os-modal-msg', message));
      const row = UI.el('div', 'os-modal-row');
      const cancel = UI.btn(options.cancelLabel || 'Cancel');
      const ok = UI.btn(options.confirmLabel || 'Delete', options.danger === false ? 'primary' : 'danger');
      row.append(cancel, ok);
      box.appendChild(row);
      cancel.onclick = () => close(false);
      ok.onclick = () => close(true);
      ok.focus();
    });
  },

  prompt(message, opts) {
    const options = opts || {};
    return new Promise((resolve) => {
      const { box, close } = UI.modal({ onClose: resolve });
      box.appendChild(UI.el('label', 'os-modal-msg', message));
      const input = UI.field(options.value || '', options.placeholder || '');
      box.appendChild(input);
      const row = UI.el('div', 'os-modal-row');
      const cancel = UI.btn('Cancel');
      const ok = UI.btn(options.confirmLabel || 'Save', 'primary');
      row.append(cancel, ok);
      box.appendChild(row);
      const done = (value) => close(value);
      cancel.onclick = () => done(null);
      ok.onclick = () => done(input.value.trim() || null);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(input.value.trim() || null);
      });
      input.focus();
      input.select();
    });
  }
};
