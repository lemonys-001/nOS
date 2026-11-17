/* nOS system tray: battery, network, bluetooth — real machine state via host bridge */
(function () {
  const $ = (id) => document.getElementById(id);
  const BATTERY = $('tb-battery');
  const BATT_PCT = $('tb-batt-pct');
  const BATT_BOLT = $('batt-bolt');
  const WIFI = $('tb-wifi');
  const BT = $('tb-bt');
  const MENU = $('sys-menu');
  const BODY = $('sys-menu-body');
  if (!BATTERY || !MENU) return;

  let status = null;
  let busy = {};

  function fmtPct(n) { return (n == null ? '?' : n) + '%'; }

  function refreshIcons() {
    if (!status) return;
    const batts = (status.battery && status.battery.batteries) || [];
    const ac = status.battery && status.battery.ac;
    if (batts.length) {
      const b = batts[0];
      BATT_PCT.textContent = b.pct + '%';
      BATT_BOLT.style.display = (b.status === 'charging' || ac) ? '' : 'none';
    } else {
      BATT_PCT.textContent = 'AC';
      BATT_BOLT.style.display = 'none';
    }
    const net = status.network || {};
    WIFI.style.opacity = net.wifi_on === false ? 0.4 : 1;
    BT.style.opacity = (status.bluetooth && status.bluetooth.powered) ? 1 : 0.45;
  }

  async function poll() {
    try {
      const r = await fetch('/api/status');
      if (r.ok) { status = await r.json(); refreshIcons(); if (!MENU.hidden) renderMenu(); }
    } catch (e) {}
  }

  function section(title) {
    const h = document.createElement('div');
    h.className = 'sys-section-title';
    h.textContent = title;
    return h;
  }

  function row(label, right, onclick, cls) {
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'sys-row' + (cls ? ' ' + cls : '');
    const l = document.createElement('span');
    l.textContent = label;
    r.appendChild(l);
    if (right) {
      const s = document.createElement('span');
      s.className = 'sys-row-right';
      s.textContent = right;
      r.appendChild(s);
    }
    if (onclick) r.addEventListener('click', onclick);
    return r;
  }

  async function act(key, fn) {
    if (busy[key]) return;
    busy[key] = true;
    try {
      const j = await fn();
      if (j && j.error) WM.toast('Error: ' + j.error);
    } catch (e) {
      WM.toast('Error: ' + e);
    }
    busy[key] = false;
    poll();
  }

  function renderMenu() {
    BODY.textContent = '';
    if (!status) {
      BODY.appendChild(section('Reading system state…'));
      return;
    }

    // power
    BODY.appendChild(section('Power'));
    const batts = (status.battery && status.battery.batteries) || [];
    const ac = status.battery && status.battery.ac;
    if (batts.length) {
      batts.forEach((b) => {
        const label = (b.status === 'charging' ? 'Charging' :
                       b.status === 'discharging' ? 'On battery' :
                       b.status === 'full' ? 'Fully charged' : b.status) + ' — ' + b.pct + '%';
        BODY.appendChild(row(label, ac ? 'plugged in' : '', null));
      });
    } else {
      BODY.appendChild(row(ac ? 'AC power' : 'No battery detected', '', null));
    }

    // network
    BODY.appendChild(section('Network'));
    const net = status.network || {};
    const connected = net.connections && net.connections.length
      ? net.connections.map((c) => c.name).join(', ') : 'Not connected';
    BODY.appendChild(row('Network: ' + connected, net.wifi_on ? 'Wi-Fi on' : 'Wi-Fi off', null));
    BODY.appendChild(row(net.wifi_on ? 'Turn Wi-Fi off' : 'Turn Wi-Fi on', '', () =>
      act('wifitoggle', () => post('/api/wifi/toggle', { on: !net.wifi_on }))));
    if (net.wifi_on) {
      const nets = net.networks || [];
      if (!nets.length) {
        BODY.appendChild(row('Scanning…', '', null, 'muted'));
      }
      nets.slice(0, 12).forEach((n) => {
        const label = n.ssid + '  (' + n.signal + '%)' + (n.security && n.security !== '--' ? ' 🔒' : '');
        BODY.appendChild(row(label, n.active ? 'connected' : '', () => {
          if (n.active) return;
          const pass = promptForPassword(n);
          if (pass === null) return;
          act('wifi' + n.ssid, async () => {
            WM.toast('Connecting to ' + n.ssid + '…');
            return post('/api/wifi/connect', { ssid: n.ssid, pass: pass });
          });
        }));
      });
    }

    // bluetooth
    BODY.appendChild(section('Bluetooth'));
    const bt = status.bluetooth || {};
    if (!bt.adapter) {
      BODY.appendChild(row('No Bluetooth adapter', '', null, 'muted'));
    } else {
      BODY.appendChild(row('Bluetooth ' + (bt.powered ? 'on' : 'off'), '', () =>
        act('bttoggle', () => post('/api/bluetooth/toggle', { on: !bt.powered }))));
      if (bt.powered) {
        const devs = bt.devices || [];
        if (!devs.length) BODY.appendChild(row('No devices known', '', null, 'muted'));
        devs.forEach((d) => {
          BODY.appendChild(row(d.name, d.connected ? 'connected' : 'connect', () => {
            if (d.connected) return;
            act('bt' + d.mac, async () => {
              WM.toast('Connecting to ' + d.name + '…');
              return post('/api/bluetooth/connect', { mac: d.mac });
            });
          }));
        });
        BODY.appendChild(row('Scan for devices', '', () =>
          act('btscan', async () => { WM.toast('Scanning…'); return post('/api/bluetooth/scan', {}); })));
      }
    }
  }

  function promptForPassword(n) {
    if (!n.security || n.security === '--') return '';
    const v = window.prompt('Password for ' + n.ssid);
    return v === null ? null : v;
  }

  async function post(url, data) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    return r.json();
  }

  function close() { MENU.hidden = true; }
  window.nosSysTrayClose = close;

  BATTERY.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  WIFI.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  BT.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  MENU.addEventListener('click', (e) => e.stopPropagation());

  function toggle() {
    if (!MENU.hidden) { close(); return; }
    const tm = $('tray-menu');
    if (tm && !tm.hidden) { tm.hidden = true; }
    MENU.hidden = false;
    renderMenu();
    poll();
  }

  document.addEventListener('click', () => { if (!MENU.hidden) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  poll();
  setInterval(poll, 30000);
})();
