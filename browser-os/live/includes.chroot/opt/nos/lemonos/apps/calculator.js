(function () {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/></svg>';

  function evaluateExpression(input) {
    let s = String(input || '').trim();
    if (!s) return { value: '', error: false };
    s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    if (!/^[0-9+\-*/().%\s]+$/.test(s)) return { value: 'Error', error: true };
    try {
      const out = Function('"use strict";return (' + s + ')')();
      if (typeof out !== 'number' || !Number.isFinite(out)) return { value: 'Error', error: true };
      return { value: Math.round(out * 1e12) / 1e12, error: false };
    } catch (e) {
      return { value: 'Error', error: true };
    }
  }

  function percentify(input) {
    return String(input).replace(/(\d+\.?\d*)$/, '($1/100)');
  }

  APPS.calculator = {
    id: 'calculator',
    name: 'Lemon Calculator',
    shortName: 'Calculator',
    icon: ICON,
    width: 340,
    height: 520,
    singleton: true,
    desktop: true,
    evaluate: evaluateExpression,
    percentify: percentify,

    mount(root, win) {
      const shell = UI.el('div', 'app calc');
      const display = UI.el('div', 'calc-display');
      const exprEl = UI.el('div', 'calc-expr', '');
      const resultEl = UI.el('div', 'calc-result', '0');
      display.append(exprEl, resultEl);
      const tape = UI.el('div', 'calc-tape');
      const pad = UI.el('div', 'calc-pad');
      shell.append(display, pad, tape);
      root.appendChild(shell);

      let input = '';
      const history = [];

      function paint() {
        exprEl.textContent = input || '';
        const r = evaluateExpression(input);
        resultEl.textContent = r.value === '' ? '0' : String(r.value);
        resultEl.classList.toggle('err', r.error);
      }

      function append(token) { input += token; paint(); }

      function equals() {
        const r = evaluateExpression(input);
        if (r.error) { paint(); return; }
        if (input === '') return;
        history.unshift({ expr: input, result: r.value });
        if (history.length > 30) history.pop();
        input = String(r.value);
        paint();
        renderTape();
      }

      function clearAll() { input = ''; paint(); }

      function backspace() { input = input.slice(0, -1); paint(); }

      function negate() {
        const m = input.match(/(\d+\.?\d*)$/);
        if (!m) { append('-'); return; }
        input = input.slice(0, m.index) + '(-' + m[1] + ')';
        paint();
      }

      function renderTape() {
        tape.textContent = '';
        if (!history.length) {
          tape.appendChild(UI.el('p', 'calc-tape-empty', 'History appears here.'));
          return;
        }
        history.forEach((h) => {
          const row = UI.el('button', 'calc-tape-row');
          row.type = 'button';
          row.appendChild(UI.el('span', 'calc-tape-expr', h.expr + ' ='));
          row.appendChild(UI.el('span', 'calc-tape-val', String(h.result)));
          row.addEventListener('click', () => { input += String(h.result); paint(); });
          tape.appendChild(row);
        });
      }

      const KEYS = [
        { label: 'C', kind: 'fn', action: clearAll },
        { label: '±', kind: 'fn', action: negate },
        { label: '%', kind: 'fn', action: () => { input = percentify(input); paint(); } },
        { label: '÷', kind: 'op', action: () => append('/') },
        { label: '7', kind: 'num', action: () => append('7') },
        { label: '8', kind: 'num', action: () => append('8') },
        { label: '9', kind: 'num', action: () => append('9') },
        { label: '×', kind: 'op', action: () => append('*') },
        { label: '4', kind: 'num', action: () => append('4') },
        { label: '5', kind: 'num', action: () => append('5') },
        { label: '6', kind: 'num', action: () => append('6') },
        { label: '−', kind: 'op', action: () => append('-') },
        { label: '1', kind: 'num', action: () => append('1') },
        { label: '2', kind: 'num', action: () => append('2') },
        { label: '3', kind: 'num', action: () => append('3') },
        { label: '+', kind: 'op', action: () => append('+') },
        { label: '0', kind: 'num', action: () => append('0') },
        { label: '.', kind: 'num', action: () => append('.') },
        { label: '⌫', kind: 'fn', action: backspace },
        { label: '=', kind: 'eq', action: equals }
      ];

      KEYS.forEach((k) => {
        const b = UI.el('button', 'calc-key calc-key-' + k.kind, k.label);
        b.type = 'button';
        b.addEventListener('click', () => { k.action(); root.querySelector('.calc').focus(); });
        pad.appendChild(b);
      });

      function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); append(e.key); return; }
        if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') { e.preventDefault(); append(e.key); return; }
        if (e.key === '(' || e.key === ')') { e.preventDefault(); append(e.key); return; }
        if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
        if (e.key === 'Delete' || e.key === 'Escape') { e.preventDefault(); clearAll(); return; }
        if (e.key === '%') { e.preventDefault(); input = percentify(input); paint(); }
      }

      shell.tabIndex = 0;
      shell.addEventListener('keydown', onKey);
      win.onClose(() => {});
      paint();
      renderTape();
      shell.focus();
    }
  };
})();
