/* ========================================
   easy-split — UI / State
   ======================================== */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const totalAmountInput = $('totalAmount');
  const excludedAmountInput = $('excludedAmount');
  const participantsList = $('participantsList');
  const addParticipantBtn = $('addParticipant');
  const addParticipantBottomBtn = $('addParticipantBottom');
  const removeLastBtn = $('removeLast');
  const countLabel = $('countLabel');
  const organizerSelect = $('organizerSelect');
  const unitRadios = document.querySelectorAll('input[name="unit"]');
  const unitHint = $('unitHint');
  const formError = $('formError');
  const resultBody = $('resultBody');
  const resultList = $('resultList');
  const resultNote = $('resultNote');
  const resultTotal = $('resultTotal');
  const collectSummary = $('collectSummary');
  const lineBtn = $('lineBtn');
  const shareBtn = $('shareBtn');
  const copyBtn = $('copyBtn');
  const resetBtn = $('resetBtn');
  const historyToggle = $('historyToggle');
  const historyList = $('historyList');
  const clearHistoryBtn = $('clearHistory');
  const themeBtns = document.querySelectorAll('.theme-btn');

  const LS_THEME = 'easysplit_theme';
  const LS_HISTORY = 'easysplit_history';
  const LS_HISTORY_ON = 'easysplit_history_on';
  const LS_NAMES = 'easysplit_names';
  const LS_DRAFT = 'easysplit_draft';

  const APP_URL = 'https://youheioonuki.github.io/easy-split/';
  const COPY_LABEL = '📋 コピー';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const PRESETS = [['上司', 1.5], ['標準', 1.0], ['飲まない', 0.8], ['若手', 0.7], ['遅刻', 0.5]];

  const person = (id, name) => ({ id, name, weight: 1.0, fixed: null });

  const defaultState = () => ({
    total: 6000,
    excluded: 0,
    participants: [person(0, 'Aさん'), person(1, 'Bさん'), person(2, 'Cさん')],
    nextId: 3,
    organizerId: 0,
    unit: 'auto',
    paid: {}
  });

  let state;
  let lastResult = null;

  // ---- Storage helpers (storage can throw in private mode) ----
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  function lsJson(key, fallback) {
    try { return JSON.parse(lsGet(key)) || fallback; } catch { return fallback; }
  }

  // ---- State ----
  function normalizeState(d) {
    const s = Object.assign(defaultState(), d);
    s.participants = s.participants.map(p => ({
      id: p.id,
      name: p.name || '',
      weight: Number(p.weight) || 1.0,
      fixed: Number.isInteger(p.fixed) ? p.fixed : null
    }));
    // Drafts saved before per-person fixed amounts existed
    if (d.organizerFixed) {
      const o = s.participants.find(p => p.id === s.organizerId);
      if (o) o.fixed = d.organizerAmount || 0;
    }
    delete s.organizerFixed;
    delete s.organizerAmount;
    s.nextId = Math.max(s.nextId || 0, ...s.participants.map(p => p.id + 1));
    if (!s.paid || typeof s.paid !== 'object') s.paid = {};
    return s;
  }

  function loadDraft() {
    const d = lsJson(LS_DRAFT, null);
    if (!d || !Array.isArray(d.participants) || d.participants.length === 0) return defaultState();
    return normalizeState(d);
  }

  function saveDraft() {
    lsSet(LS_DRAFT, JSON.stringify(state));
  }

  function changed() {
    recalc();
    saveDraft();
  }

  // ---- Init ----
  function init() {
    loadTheme();
    historyToggle.checked = lsGet(LS_HISTORY_ON) !== '0';
    shareBtn.classList.toggle('hidden', !navigator.share);

    state = loadDraft();
    applyStateToForm();
    renderHistory();
    bindEvents();
    recalc();
  }

  function applyStateToForm() {
    totalAmountInput.value = state.total || '';
    excludedAmountInput.value = state.excluded || 0;
    unitRadios.forEach(r => { r.checked = r.value === String(state.unit); });
    updateUnitHint();
    renderParticipants();
    updateOrganizerSelect();
  }

  // ---- Theme ----
  function loadTheme() {
    setTheme(lsGet(LS_THEME) || 'dark');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    lsSet(LS_THEME, theme);
    themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
  }

  // ---- Participants ----
  function nextName() {
    const used = new Set(state.participants.map(p => p.name));
    for (const L of LETTERS) if (!used.has(L + 'さん')) return L + 'さん';
    return '参加者' + (state.participants.length + 1);
  }

  function addParticipant() {
    state.participants.push(person(state.nextId++, nextName()));
    renderParticipants();
    updateOrganizerSelect();
    changed();
  }

  function removeParticipant(id) {
    if (state.participants.length <= 1) return;
    state.participants = state.participants.filter(p => p.id !== id);
    delete state.paid[id];
    renderParticipants();
    updateOrganizerSelect();
    changed();
  }

  const displayName = p => p.name.trim() || '(名前なし)';

  function renderParticipants() {
    participantsList.innerHTML = '';
    countLabel.textContent = state.participants.length + '人';
    removeLastBtn.disabled = state.participants.length <= 1;

    const datalist = document.createElement('datalist');
    datalist.id = 'savedNames';
    lsJson(LS_NAMES, []).forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      datalist.appendChild(opt);
    });
    participantsList.appendChild(datalist);

    state.participants.forEach((p, i) => participantsList.appendChild(participantRow(p, i)));
  }

  function participantRow(p, i) {
    const label = p.name || (i + 1) + '人目';
    const row = document.createElement('div');
    row.className = 'participant-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'participant-name';
    nameInput.placeholder = '名前';
    nameInput.value = p.name;
    nameInput.setAttribute('list', 'savedNames');
    nameInput.setAttribute('aria-label', (i + 1) + '人目の名前');
    nameInput.addEventListener('input', () => {
      p.name = nameInput.value;
      updateOrganizerSelect();
    });
    nameInput.addEventListener('blur', () => saveName(p.name));

    const isFixed = p.fixed !== null;
    const fixedBtn = document.createElement('button');
    fixedBtn.className = 'btn-fixed' + (isFixed ? ' active' : '');
    fixedBtn.textContent = '固定';
    fixedBtn.setAttribute('aria-pressed', String(isFixed));
    fixedBtn.setAttribute('aria-label', label + 'の金額を固定');
    fixedBtn.addEventListener('click', () => {
      p.fixed = p.fixed === null ? 0 : null;
      renderParticipants();
      changed();
      const input = $('fixed-' + p.id);
      if (input) input.focus();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', label + 'を削除');
    removeBtn.addEventListener('click', () => removeParticipant(p.id));

    row.append(nameInput, fixedBtn, removeBtn);
    if (isFixed) row.appendChild(fixedGroup(p));
    else row.append(...weightControls(p));
    return row;
  }

  function fixedGroup(p) {
    const group = document.createElement('div');
    group.className = 'amount-input-group sub fixed-group';

    const lbl = document.createElement('label');
    lbl.htmlFor = 'fixed-' + p.id;
    lbl.textContent = '固定額';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'fixed-' + p.id;
    input.inputMode = 'numeric';
    input.min = '0';
    input.step = '100';
    input.value = p.fixed;
    input.addEventListener('input', () => { p.fixed = toInt(input.value); });

    const cur = document.createElement('span');
    cur.className = 'currency';
    cur.textContent = '円';

    group.append(lbl, input, cur);
    return group;
  }

  function weightControls(p) {
    const weightGroup = document.createElement('div');
    weightGroup.className = 'participant-weight-group';

    const sliderId = 'weight-' + p.id;
    const weightLabel = document.createElement('label');
    weightLabel.textContent = '係数';
    weightLabel.htmlFor = sliderId;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = sliderId;
    slider.className = 'weight-slider';
    slider.min = '0.5';
    slider.max = '2.0';
    slider.step = '0.1';
    slider.value = p.weight;

    const weightValue = document.createElement('span');
    weightValue.className = 'weight-value';

    const presetRow = document.createElement('div');
    presetRow.className = 'preset-row';

    const sync = () => {
      weightValue.textContent = p.weight.toFixed(1);
      presetRow.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', Number(c.dataset.w) === p.weight));
    };

    PRESETS.forEach(([name, w]) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset.w = w;
      chip.textContent = name + ' ' + w.toFixed(1);
      chip.addEventListener('click', () => {
        p.weight = w;
        slider.value = w;
        sync();
        changed();
      });
      presetRow.appendChild(chip);
    });

    slider.addEventListener('input', () => {
      p.weight = parseFloat(slider.value);
      sync();
    });

    sync();
    weightGroup.append(weightLabel, slider, weightValue);
    return [weightGroup, presetRow];
  }

  function updateOrganizerSelect() {
    if (!state.participants.some(p => p.id === state.organizerId)) {
      state.organizerId = state.participants[0].id;
    }
    organizerSelect.innerHTML = '';
    state.participants.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = displayName(p);
      organizerSelect.appendChild(opt);
    });
    organizerSelect.value = String(state.organizerId);
  }

  function saveName(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const names = lsJson(LS_NAMES, []);
    if (names.includes(trimmed)) return;
    names.push(trimmed);
    if (names.length > 50) names.shift();
    lsSet(LS_NAMES, JSON.stringify(names));
  }

  // ---- Unit ----
  function updateUnitHint() {
    unitHint.textContent = state.unit === 'auto'
      ? '1人あたりの金額に合わせて自動で選びます（約3,000円なら100円単位）'
      : state.unit.toLocaleString() + '円単位で集金します';
  }

  // ---- Calculation (runs on every change) ----
  function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function recalc() {
    const res = EasySplit.computeSplit({
      total: state.total,
      excluded: state.excluded,
      people: state.participants.map(p => ({ id: p.id, name: displayName(p), weight: p.weight, fixed: p.fixed })),
      organizerId: state.organizerId,
      unit: state.unit
    });

    formError.classList.toggle('hidden', !res.error);
    resultBody.classList.toggle('hidden', !!res.error);
    if (res.error) {
      formError.textContent = res.error;
      lastResult = null;
      return;
    }

    lastResult = Object.assign({ total: state.total, excluded: state.excluded }, res);
    renderResults(lastResult);
  }

  const yen = n => n.toLocaleString() + '円';
  const unitLabel = unit => (unit === 1 ? '1円単位' : yen(unit) + '単位');

  function absorberText(r) {
    const a = r.results.find(x => x.id === r.absorberId);
    return a.isOrganizer ? '幹事' : a.name;
  }

  function renderResults(r) {
    resultList.innerHTML = '';

    r.results.forEach(x => {
      // The organizer collects the money, so only the others get a check mark.
      const collectable = !x.isOrganizer;
      const paid = collectable && !!state.paid[x.id];
      const item = document.createElement(collectable ? 'button' : 'div');
      item.className = 'result-item' + (paid ? ' paid' : '');

      const check = document.createElement('span');
      check.className = 'check' + (collectable ? '' : ' none');
      check.textContent = paid ? '✓' : '';

      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = x.name;
      if (x.isOrganizer) name.appendChild(badge('幹事'));
      if (x.isFixed) name.appendChild(badge('固定', 'badge-muted'));

      const amount = document.createElement('span');
      amount.className = 'result-amount';
      amount.textContent = x.amount.toLocaleString() + ' 円';

      item.append(check, name, amount);

      if (collectable) {
        item.setAttribute('aria-pressed', String(paid));
        item.setAttribute('aria-label', x.name + ' ' + yen(x.amount) + (paid ? ' 集金済み' : ' 未集金'));
        item.addEventListener('click', () => {
          if (state.paid[x.id]) delete state.paid[x.id];
          else state.paid[x.id] = true;
          saveDraft();
          renderResults(lastResult);
        });
      }
      resultList.appendChild(item);
    });

    if (r.absorberId === null) {
      resultNote.textContent = '全員の金額が固定されています。';
    } else {
      resultNote.textContent = unitLabel(r.unit) + 'で計算しました。' +
        (r.remainder > 0 ? '端数 ' + yen(r.remainder) + ' は ' + absorberText(r) + ' が負担します。' : '');
    }

    const sum = r.results.reduce((s, x) => s + x.amount, 0);
    resultTotal.textContent = '合計: ' + sum.toLocaleString() + ' 円' +
      (r.excluded > 0 ? ' (対象外: ' + r.excluded.toLocaleString() + ' 円)' : '') +
      ' / 総額: ' + r.total.toLocaleString() + ' 円';

    renderCollectSummary(r);
  }

  function badge(text, extra) {
    const b = document.createElement('span');
    b.className = 'badge' + (extra ? ' ' + extra : '');
    b.textContent = text;
    return b;
  }

  function renderCollectSummary(r) {
    const payers = r.results.filter(x => !x.isOrganizer);
    const paidCount = payers.filter(x => state.paid[x.id]).length;
    const unpaid = payers.filter(x => !state.paid[x.id]).reduce((s, x) => s + x.amount, 0);

    collectSummary.classList.toggle('done', payers.length > 0 && paidCount === payers.length);
    if (payers.length === 0) collectSummary.textContent = '';
    else if (paidCount === payers.length) collectSummary.textContent = '✅ 全員の集金が完了しました';
    else if (paidCount === 0) collectSummary.textContent = '名前をタップすると集金済みにできます（未集金 ' + yen(unpaid) + '）';
    else collectSummary.textContent = '集金済み ' + paidCount + '/' + payers.length + '人 ・ 未集金 ' + yen(unpaid);
  }

  // ---- Share / Copy / LINE ----
  function appUrl() {
    return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : APP_URL;
  }

  function buildShareText(r) {
    const sum = r.results.reduce((s, x) => s + x.amount, 0);
    const lines = ['【割り勘清算】', ''];
    r.results.forEach(x => {
      lines.push(x.name + (x.isOrganizer ? '（幹事）' : '') + '：' + yen(x.amount));
    });
    lines.push('', '─'.repeat(16), '合計：' + yen(sum));
    if (r.excluded > 0) {
      lines.push('対象外：' + yen(r.excluded));
      lines.push('総額：' + yen(r.total));
    }
    if (r.absorberId !== null) {
      lines.push('', '※' + unitLabel(r.unit) + 'で計算' + (r.remainder > 0 ? '（端数は' + absorberText(r) + 'が調整）' : ''));
    }
    lines.push('', '▼ easy-split で計算', appUrl());
    return lines.join('\n');
  }

  // Sending or copying marks the result as final, so it is recorded in history.
  function withShareText(fn) {
    return () => {
      if (!lastResult) return;
      saveHistory(lastResult);
      fn(buildShareText(lastResult));
    };
  }

  function sendLine(text) {
    window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  function shareNative(text) {
    navigator.share({ title: '割り勘清算', text }).catch(() => {});
  }

  function flashCopyLabel(label) {
    copyBtn.textContent = label;
    setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, 2500);
  }

  function copyText(text) {
    const fallback = () => flashCopyLabel(execCopy(text) ? '✅ コピーしました' : '❌ コピーできませんでした');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => flashCopyLabel('✅ コピーしました'), fallback);
    } else {
      fallback();
    }
  }

  function execCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;background:transparent;font-size:16px;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  // ---- History ----
  function snapshotInput() {
    return {
      total: state.total,
      excluded: state.excluded,
      participants: state.participants.map(p => Object.assign({}, p)),
      organizerId: state.organizerId,
      unit: state.unit
    };
  }

  function saveHistory(r) {
    if (!historyToggle.checked) return;
    const history = lsJson(LS_HISTORY, []);
    const input = snapshotInput();
    if (history[0] && JSON.stringify(history[0].input) === JSON.stringify(input)) return;
    history.unshift({
      date: new Date().toLocaleString('ja-JP'),
      totalAmount: r.total,
      excludedAmount: r.excluded,
      results: r.results.map(x => ({ name: x.name, amount: x.amount })),
      input
    });
    lsSet(LS_HISTORY, JSON.stringify(history.slice(0, 5)));
    renderHistory();
  }

  function restoreHistory(entry) {
    if (!confirm('この内容を入力に復元しますか？（今の入力は上書きされます）')) return;
    state = normalizeState(Object.assign({}, entry.input, { paid: {} }));
    applyStateToForm();
    changed();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderHistory() {
    const history = lsJson(LS_HISTORY, []);
    historyList.innerHTML = '';
    clearHistoryBtn.classList.toggle('hidden', history.length === 0);

    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const date = document.createElement('div');
      date.className = 'history-date';
      date.textContent = entry.date + ' — 合計: ' + (entry.totalAmount || 0).toLocaleString() + '円';
      item.appendChild(date);

      (entry.results || []).forEach(x => {
        const row = document.createElement('div');
        row.className = 'history-detail';
        const n = document.createElement('span');
        n.textContent = x.name;
        const a = document.createElement('span');
        a.textContent = (x.amount || 0).toLocaleString() + '円';
        row.append(n, a);
        item.appendChild(row);
      });

      if (entry.input && Array.isArray(entry.input.participants)) {
        const restore = document.createElement('button');
        restore.className = 'btn-restore';
        restore.textContent = '↩ この内容を復元';
        restore.addEventListener('click', () => restoreHistory(entry));
        item.appendChild(restore);
      }

      historyList.appendChild(item);
    });
  }

  // ---- Events ----
  function bindEvents() {
    totalAmountInput.addEventListener('input', () => { state.total = toInt(totalAmountInput.value); });
    excludedAmountInput.addEventListener('input', () => { state.excluded = toInt(excludedAmountInput.value); });
    organizerSelect.addEventListener('change', () => { state.organizerId = Number(organizerSelect.value); });

    unitRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        state.unit = radio.value === 'auto' ? 'auto' : Number(radio.value);
        updateUnitHint();
      });
    });

    // Element-level listeners above update state first; this recalculates and persists.
    const inputs = document.querySelectorAll('#totalAmount, #excludedAmount, #participantsList, #organizerSelect, input[name="unit"]');
    inputs.forEach(el => {
      el.addEventListener('input', changed);
      el.addEventListener('change', changed);
    });

    addParticipantBtn.addEventListener('click', addParticipant);
    addParticipantBottomBtn.addEventListener('click', addParticipant);
    removeLastBtn.addEventListener('click', () => {
      removeParticipant(state.participants[state.participants.length - 1].id);
    });

    lineBtn.addEventListener('click', withShareText(sendLine));
    shareBtn.addEventListener('click', withShareText(shareNative));
    copyBtn.addEventListener('click', withShareText(copyText));

    resetBtn.addEventListener('click', () => {
      if (!confirm('入力内容をリセットしますか？')) return;
      state = defaultState();
      applyStateToForm();
      changed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    historyToggle.addEventListener('change', () => {
      lsSet(LS_HISTORY_ON, historyToggle.checked ? '1' : '0');
      if (!historyToggle.checked) {
        lsRemove(LS_HISTORY);
        renderHistory();
      }
    });

    clearHistoryBtn.addEventListener('click', () => {
      if (!confirm('履歴をすべて削除しますか？')) return;
      lsRemove(LS_HISTORY);
      renderHistory();
    });

    themeBtns.forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
