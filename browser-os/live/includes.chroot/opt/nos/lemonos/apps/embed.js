(function () {
  const EXT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const RELOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>';
  const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-downloads allow-modals allow-pointer-lock';
  const PERMISSIONS = 'clipboard-read; clipboard-write; fullscreen; picture-in-picture';
  const tools = [];

  function hostOf(url) {
    try {
      return new URL(url, location.href).hostname.replace(/^www\./, '');
    } catch (e) {
      return String(url || '');
    }
  }

  function register(opts) {
    const primary = (opts.sources && opts.sources.length ? opts.sources[0].url : opts.url) || opts.url;
    APPS[opts.id] = {
      id: opts.id,
      name: opts.name,
      shortName: opts.shortName || opts.name,
      icon: opts.icon,
      width: opts.width || 1080,
      height: opts.height || 720,
      singleton: true,
      desktop: opts.desktop !== false,
      hidden: !!opts.hidden,
      mount(root, win) {
        mount(root, win, Object.assign({ url: primary }, opts));
      }
    };
    tools.push({
      id: opts.id,
      name: opts.name,
      url: primary,
      credit: opts.credit || '',
      note: opts.note || ''
    });
    return APPS[opts.id];
  }

  function mount(root, win, opts) {
    const sources = (opts.sources && opts.sources.length
      ? opts.sources
      : [{ label: opts.name, url: opts.url }]);
    let active = sources.find((s) => s.default) || sources[0];
    let picker = null;
    let timer = null;

    const shell = UI.el('div', 'app');
    const bar = UI.el('div', 'app-bar emb-bar');
    const title = UI.el('span', 'app-bar-title', opts.name);
    const grow = UI.el('span', 'app-status-grow');
    bar.append(title, grow);

    if (sources.length > 1) {
      picker = UI.el('select', 'emb-select');
      picker.setAttribute('aria-label', 'Source');
      sources.forEach((s) => {
        const option = UI.el('option', null, s.label);
        option.value = s.label;
        if (s === active) option.selected = true;
        picker.appendChild(option);
      });
      picker.addEventListener('change', () => {
        active = sources.find((s) => s.label === picker.value) || active;
        load();
      });
      bar.appendChild(picker);
    }

    const reload = UI.iconBtn('Reload', RELOAD_ICON);
    const openTab = UI.iconBtn('Open in a new tab', EXT_ICON);
    bar.append(reload, openTab);

    const stage = UI.el('div', 'emb');

    function load() {
      clearTimeout(timer);
      stage.textContent = '';
      if (picker) {
        Array.prototype.forEach.call(picker.options, (option) => {
          option.selected = option.value === active.label;
        });
      }
      win.setTitle(opts.name);

      const veil = UI.el('div', 'emb-load');
      const spin = UI.el('span', 'emb-spin');
      const msg = UI.el('span', 'emb-load-msg', 'Loading ' + opts.name + '…');
      veil.append(spin, msg);

      const frame = UI.el('iframe', 'emb-frame');
      frame.setAttribute('sandbox', SANDBOX);
      frame.setAttribute('allow', PERMISSIONS);
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('title', opts.name + ' on ' + hostOf(active.url));
      frame.addEventListener('load', () => {
        clearTimeout(timer);
        veil.remove();
      });
      frame.src = active.url;
      stage.append(frame, veil);
      timer = setTimeout(() => {
        msg.textContent = 'Still loading. Use “Open in a new tab” if this pane stays blank.';
      }, 9000);
    }

    reload.addEventListener('click', load);
    openTab.addEventListener('click', () => {
      window.open(active.url, '_blank', 'noopener');
    });

    shell.append(bar, stage);
    root.appendChild(shell);
    load();
  }

  window.Embed = { register, mount, hostOf, tools, EXT_ICON };
})();
