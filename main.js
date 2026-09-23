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
  const organizerSelect = $('organizerSelect');
  const organizerFixedToggle = $('organizerFixed');
  const organizerSettings = $('organizerSettings');
  const organizerAmountInput = $('organizerAmount');
  const unitRadios = document.querySelectorAll('input[name="unit"]');
  const unitHint = $('unitHint');
  const formError = $('formError');
  const calculateBtn = $('calculateBtn');
  const resetBtn = $('resetBtn');
  const resultSection = $('resultSection');
  const resultList = $('resultList');
  const resultNote = $('resultNote');
  const resultTotal = $('resultTotal');
  const shareBtn = $('shareBtn');
  const copyBtn = $('copyBtn');
  const historyToggle = $('historyToggle');
  const historyList = $('historyList');
  const clearHistoryBtn = $('clearHistory');
  const themeBtns = document.querySelectorAll('.theme-btn');

  const LS_THEME = 'easysplit_theme';
  const LS_HISTORY = 'easysplit_history';
  const LS_HISTORY_ON = 'easysplit_history_on';
  const LS_NAMES = 'easysplit_names';
  const LS_DRAFT = 'easysplit_draft';

  const COPY_LABEL = '📋 コピー';
  const SHARE_LABEL = '📤 共有';

  const defaultState = () => ({
    total: 6000,
    excluded: 0,
    participants: [
      { id: 0, name: 'Aさん', weight: 1.0 },
      { id: 1, name: 'Bさん', weight: 1.0 },
      { id: 2, name: 'Cさん', weight: 1.0 }
    ],
    nextId: 3,
    organizerId: 0,
    organizerFixed: false,
    organizerAmount: 0,
    unit: 'auto'
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

  // ---- Draft (survives the tab being killed while switching to LINE) ----
  function loadDraft() {
    const d = lsJson(LS_DRAFT, null);
    if (!d || !Array.isArray(d.participants) || d.participants.length === 0) return defaultState();
    return Object.assign(defaultState(), d);
  }

  function saveDraft() {
    lsSet(LS_DRAFT, JSON.stringify(state));
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
  }

  function applyStateToForm() {
    totalAmountInput.value = state.total || '';
    excludedAmountInput.value = state.excluded || 0;
    organizerFixedToggle.checked = state.organizerFixed;
    organizerSettings.classList.toggle('hidden', !state.organizerFixed);
    organizerAmountInput.value = state.organizerAmount || 0;
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
  function addParticipant() {
    state.participants.push({ id: state.nextId++, name: '', weight: 1.0 });
    renderParticipants();
    updateOrganizerSelect();
    saveDraft();
    const inputs = participantsList.querySelectorAll('.participant-name');
    inputs[inputs.length - 1].focus();
  }

  function removeParticipant(id) {
    if (state.participants.length <= 1) return;
    state.participants = state.participants.filter(p => p.id !== id);
    renderParticipants();
    updateOrganizerSelect();
    saveDraft();
  }

  function renderParticipants() {
    participantsList.innerHTML = '';

    const datalist = document.createElement('datalist');
    datalist.id = 'savedNames';
    lsJson(LS_NAMES, []).forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      datalist.appendChild(opt);
    });
    participantsList.appendChild(datalist);

    state.participants.forEach((p, i) => {
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

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', (p.name || (i + 1) + '人目') + 'を削除');
      removeBtn.addEventListener('click', () => removeParticipant(p.id));

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
      weightValue.textContent = Number(p.weight).toFixed(1);

      slider.addEventListener('input', () => {
        p.weight = parseFloat(slider.value);
        weightValue.textContent = p.weight.toFixed(1);
      });

      weightGroup.append(weightLabel, slider, weightValue);
      row.append(nameInput, removeBtn, weightGroup);
      participantsList.appendChild(row);
    });
  }

  function updateOrganizerSelect() {
    if (!state.participants.some(p => p.id === state.organizerId)) {
      state.organizerId = state.participants[0].id;
    }
    organizerSelect.innerHTML = '';
    state.participants.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || '(名前なし)';
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

  // ---- Calculation ----
  function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function showError(message) {
    formError.textContent = message;
    formError.classList.remove('hidden');
    resultSection.classList.add('hidden');
    formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function calculate() {
    const res = EasySplit.computeSplit({
      total: state.total,
      excluded: state.excluded,
      people: state.participants.map(p => ({ id: p.id, name: p.name.trim() || '(名前なし)', weight: p.weight })),
      organizerId: state.organizerId,
      organizerFixedAmount: state.organizerFixed ? state.organizerAmount : null,
      unit: state.unit
    });

    if (res.error) {
      showError(res.error);
      return;
    }

    formError.classList.add('hidden');
    lastResult = Object.assign({ total: state.total, excluded: state.excluded }, res);
    displayResults(lastResult);
    saveHistory(lastResult);
  }

  function unitLabel(unit) {
    return unit === 1 ? '1円単位' : unit.toLocaleString() + '円単位';
  }

  function resultNoteText(r) {
    let text = unitLabel(r.unit) + 'で計算しました。';
    if (r.remainder > 0) {
      const absorber = r.results.find(x => x.id === r.absorberId);
      text += '端数 ' + r.remainder.toLocaleString() + '円 は ' + absorber.name +
        (absorber.isOrganizer ? '（幹事）' : '') + ' が負担します。';
    }
    return text;
  }

  function displayResults(r) {
    resultSection.classList.remove('hidden');
    resultList.innerHTML = '';

    r.results.forEach(x => {
      const item = document.createElement('div');
      item.className = 'result-item';

      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = x.name;
      if (x.isOrganizer) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '幹事';
        name.appendChild(badge);
      }

      const amount = document.createElement('span');
      amount.className = 'result-amount';
      amount.textContent = x.amount.toLocaleString() + ' 円';

      item.append(name, amount);
      resultList.appendChild(item);
    });

    resultNote.textContent = resultNoteText(r);

    const sum = r.results.reduce((s, x) => s + x.amount, 0);
    resultTotal.textContent = '合計: ' + sum.toLocaleString() + ' 円' +
      (r.excluded > 0 ? ' (対象外: ' + r.excluded.toLocaleString() + ' 円)' : '') +
      ' / 総額: ' + r.total.toLocaleString() + ' 円';

    copyBtn.textContent = COPY_LABEL;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Share / Copy ----
  function buildShareText(r) {
    const sum = r.results.reduce((s, x) => s + x.amount, 0);
    const lines = ['【割り勘清算】', ''];
    r.results.forEach(x => {
      lines.push(x.name + (x.isOrganizer ? '（幹事）' : '') + '：' + x.amount.toLocaleString() + '円');
    });
    lines.push('', '─'.repeat(16), '合計：' + sum.toLocaleString() + '円');
    if (r.excluded > 0) {
      lines.push('対象外：' + r.excluded.toLocaleString() + '円');
      lines.push('総額：' + r.total.toLocaleString() + '円');
    }
    lines.push('', '※' + unitLabel(r.unit) + 'で計算' + (r.remainder > 0 ? '（端数は調整済み）' : ''));
    lines.push('※ easy-split で計算しました');
    return lines.join('\n');
  }

  function flashCopyLabel(label) {
    copyBtn.textContent = label;
    setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, 2500);
  }

  function shareResults() {
    if (!lastResult) return;
    navigator.share({ title: '割り勘清算', text: buildShareText(lastResult) }).catch(() => {});
  }

  function copyResults() {
    if (!lastResult) return;
    const text = buildShareText(lastResult);
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
  function saveHistory(r) {
    if (!historyToggle.checked) return;
    const history = lsJson(LS_HISTORY, []);
    history.unshift({
      date: new Date().toLocaleString('ja-JP'),
      totalAmount: r.total,
      excludedAmount: r.excluded,
      results: r.results.map(x => ({ name: x.name, amount: x.amount }))
    });
    lsSet(LS_HISTORY, JSON.stringify(history.slice(0, 5)));
    renderHistory();
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

      historyList.appendChild(item);
    });
  }

  // ---- Events ----
  function bindEvents() {
    totalAmountInput.addEventListener('input', () => { state.total = toInt(totalAmountInput.value); });
    excludedAmountInput.addEventListener('input', () => { state.excluded = toInt(excludedAmountInput.value); });
    organizerAmountInput.addEventListener('input', () => { state.organizerAmount = toInt(organizerAmountInput.value); });

    organizerSelect.addEventListener('change', () => { state.organizerId = Number(organizerSelect.value); });

    organizerFixedToggle.addEventListener('change', () => {
      state.organizerFixed = organizerFixedToggle.checked;
      organizerSettings.classList.toggle('hidden', !state.organizerFixed);
    });

    unitRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        state.unit = radio.value === 'auto' ? 'auto' : Number(radio.value);
        updateUnitHint();
      });
    });

    // Element-level listeners above run first, then this persists the updated state.
    const main = document.querySelector('main');
    main.addEventListener('input', saveDraft);
    main.addEventListener('change', saveDraft);

    addParticipantBtn.addEventListener('click', addParticipant);
    calculateBtn.addEventListener('click', calculate);
    shareBtn.addEventListener('click', shareResults);
    copyBtn.addEventListener('click', copyResults);

    resetBtn.addEventListener('click', () => {
      if (!confirm('入力内容をリセットしますか？')) return;
      state = defaultState();
      lastResult = null;
      saveDraft();
      applyStateToForm();
      formError.classList.add('hidden');
      resultSection.classList.add('hidden');
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
