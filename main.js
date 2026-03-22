/* ========================================
   easy-split — Main Application Logic
   ======================================== */

(function () {
  'use strict';

  // ---- DOM References ----
  const totalAmountInput = document.getElementById('totalAmount');
  const excludedAmountInput = document.getElementById('excludedAmount');
  const participantsList = document.getElementById('participantsList');
  const addParticipantBtn = document.getElementById('addParticipant');
  const organizerMode = document.getElementById('organizerMode');
  const organizerSettings = document.getElementById('organizerSettings');
  const organizerSelect = document.getElementById('organizerSelect');
  const organizerAmountInput = document.getElementById('organizerAmount');
  const calculateBtn = document.getElementById('calculateBtn');
  const resultSection = document.getElementById('resultSection');
  const resultList = document.getElementById('resultList');
  const resultTotal = document.getElementById('resultTotal');
  const copyBtn = document.getElementById('copyBtn');
  const historyToggle = document.getElementById('historyToggle');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const roundingRadios = document.querySelectorAll('input[name="roundingMode"]');
  const roundingHint = document.getElementById('roundingHint');
  const themeBtns = document.querySelectorAll('.theme-btn');

  // ---- State ----
  let participants = [];
  let participantIdCounter = 0;

  // ---- LocalStorage Keys ----
  const LS_THEME = 'easysplit_theme';
  const LS_HISTORY = 'easysplit_history';
  const LS_HISTORY_ON = 'easysplit_history_on';
  const LS_NAMES = 'easysplit_names';
  const LS_INITIALIZED = 'easysplit_initialized';

  // ---- Init ----
  function init() {
    loadTheme();
    loadHistoryToggle();

    // Always start with 3 default participants
    totalAmountInput.value = 6000;
    addParticipant('Aさん', 1.0);
    addParticipant('Bさん', 1.0);
    addParticipant('Cさん', 1.0);

    renderHistory();
    bindEvents();
    updateOrganizerSelect();
  }

  // ---- Theme ----
  function loadTheme() {
    const saved = localStorage.getItem(LS_THEME) || 'dark';
    setTheme(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LS_THEME, theme);
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  // ---- Participants ----
  function addParticipant(name, weight) {
    const id = participantIdCounter++;
    participants.push({ id, name: name || '', weight: weight || 1.0 });
    renderParticipants();
    updateOrganizerSelect();
  }

  function removeParticipant(id) {
    if (participants.length <= 1) return;
    participants = participants.filter(p => p.id !== id);
    renderParticipants();
    updateOrganizerSelect();
  }

  function renderParticipants() {
    participantsList.innerHTML = '';
    const savedNames = getSavedNames();

    participants.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'participant-row';

      // Name input
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'participant-name';
      nameInput.placeholder = '名前';
      nameInput.value = p.name;
      nameInput.setAttribute('list', 'nameList-' + p.id);
      nameInput.addEventListener('input', () => {
        p.name = nameInput.value;
        updateOrganizerSelect();
      });
      nameInput.addEventListener('blur', () => {
        saveName(p.name);
      });

      // Datalist for autocomplete
      const datalist = document.createElement('datalist');
      datalist.id = 'nameList-' + p.id;
      savedNames.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        datalist.appendChild(opt);
      });

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => removeParticipant(p.id));

      // Weight group
      const weightGroup = document.createElement('div');
      weightGroup.className = 'participant-weight-group';

      const weightLabel = document.createElement('label');
      weightLabel.textContent = '係数';

      const slider = document.createElement('input');
      slider.type = 'range';
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

      weightGroup.appendChild(weightLabel);
      weightGroup.appendChild(slider);
      weightGroup.appendChild(weightValue);

      row.appendChild(nameInput);
      row.appendChild(datalist);
      row.appendChild(removeBtn);
      row.appendChild(weightGroup);

      participantsList.appendChild(row);
    });
  }

  function updateOrganizerSelect() {
    const currentValue = organizerSelect.value;
    organizerSelect.innerHTML = '';
    participants.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || '(名前なし)';
      organizerSelect.appendChild(opt);
    });
    // Restore selection if still valid
    if ([...organizerSelect.options].some(o => o.value === currentValue)) {
      organizerSelect.value = currentValue;
    }
  }

  // ---- Name Autocomplete ----
  function getSavedNames() {
    try {
      return JSON.parse(localStorage.getItem(LS_NAMES)) || [];
    } catch {
      return [];
    }
  }

  function saveName(name) {
    if (!name || !name.trim()) return;
    const names = getSavedNames();
    const trimmed = name.trim();
    if (!names.includes(trimmed)) {
      names.push(trimmed);
      if (names.length > 50) names.shift();
      localStorage.setItem(LS_NAMES, JSON.stringify(names));
    }
  }

  // ---- Calculation ----
  function calculate() {
    const totalAmount = parseInt(totalAmountInput.value) || 0;
    const excludedAmount = parseInt(excludedAmountInput.value) || 0;
    const splittableAmount = totalAmount - excludedAmount;

    if (splittableAmount <= 0 || participants.length === 0) {
      alert('合計金額と参加者を確認してください。');
      return;
    }

    // Filter out participants with no name
    const validParticipants = participants.map(p => ({
      ...p,
      name: p.name.trim() || '(名前なし)'
    }));

    let results;

    if (organizerMode.checked) {
      const organizerId = parseInt(organizerSelect.value);
      const organizerAmount = parseInt(organizerAmountInput.value) || 0;
      results = calculateWithOrganizer(validParticipants, splittableAmount, organizerId, organizerAmount);
    } else {
      results = calculateNormal(validParticipants, splittableAmount);
    }

    displayResults(results, totalAmount, excludedAmount);
    saveHistory(results, totalAmount, excludedAmount);
  }

  function calculateNormal(people, amount) {
    const totalWeight = people.reduce((sum, p) => sum + p.weight, 0);
    const rawResults = people.map(p => ({
      name: p.name,
      raw: (amount * p.weight) / totalWeight,
      weight: p.weight
    }));

    return adjustRounding(rawResults, amount);
  }

  function calculateWithOrganizer(people, amount, organizerId, organizerAmount) {
    const organizer = people.find(p => p.id === organizerId);
    const others = people.filter(p => p.id !== organizerId);

    if (!organizer || others.length === 0) {
      return calculateNormal(people, amount);
    }

    const remainingAmount = amount - organizerAmount;
    const totalOtherWeight = others.reduce((sum, p) => sum + p.weight, 0);

    const rawResults = others.map(p => ({
      name: p.name,
      raw: (remainingAmount * p.weight) / totalOtherWeight,
      weight: p.weight
    }));

    const adjustedOthers = adjustRounding(rawResults, remainingAmount);

    // Insert organizer
    const result = [
      { name: organizer.name + ' (幹事)', amount: organizerAmount, weight: organizer.weight },
      ...adjustedOthers
    ];

    return result;
  }

  function getRoundingMode() {
    const checked = document.querySelector('input[name="roundingMode"]:checked');
    return checked ? checked.value : 'exact';
  }

  // Get the sig2 rounding unit for a given number (e.g. 2500→100, 12000→1000)
  function sig2Unit(n) {
    if (n === 0) return 1;
    const abs = Math.abs(n);
    const digits = Math.floor(Math.log10(abs)) + 1;
    if (digits <= 2) return 1;
    return Math.pow(10, digits - 2);
  }

  // Floor to 2 significant digits (e.g. 2592→2500, 12344→12000)
  function floorToSig2(n) {
    if (n === 0) return 0;
    const unit = sig2Unit(n);
    if (unit <= 1) return Math.floor(n);
    return Math.floor(n / unit) * unit;
  }

  function adjustRounding(rawResults, targetTotal) {
    const mode = getRoundingMode();

    if (mode === 'sig2') {
      return adjustRoundingSig2(rawResults, targetTotal);
    }

    // Exact mode: round to 1 yen, adjust max person
    const results = rawResults.map(r => ({
      name: r.name,
      amount: Math.round(r.raw),
      weight: r.weight
    }));

    const currentTotal = results.reduce((sum, r) => sum + r.amount, 0);
    const diff = targetTotal - currentTotal;

    if (diff !== 0 && results.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].amount > results[maxIdx].amount) {
          maxIdx = i;
        }
      }
      results[maxIdx].amount += diff;
    }

    return results;
  }

  function adjustRoundingSig2(rawResults, targetTotal) {
    // Step 1: Floor everyone to sig2
    const results = rawResults.map(r => {
      const floored = floorToSig2(r.raw);
      return {
        name: r.name,
        amount: floored,
        weight: r.weight,
        unit: sig2Unit(r.raw),           // rounding unit for this person
        fraction: r.raw - floored         // how much was cut off
      };
    });

    // Step 2: Calculate deficit
    let deficit = targetTotal - results.reduce((sum, r) => sum + r.amount, 0);

    // Step 3: Distribute deficit by bumping people up by their unit,
    //         prioritizing those with the largest fractional part (closest to rounding up)
    const indices = results.map((_, i) => i);
    indices.sort((a, b) => results[b].fraction - results[a].fraction);

    for (const idx of indices) {
      if (deficit <= 0) break;
      const unit = results[idx].unit;
      if (unit <= deficit) {
        results[idx].amount += unit;
        deficit -= unit;
      }
    }

    // Step 4: Any small remainder that can't be distributed in clean units
    //         goes to the person with the highest payment
    if (deficit !== 0 && results.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].amount > results[maxIdx].amount) {
          maxIdx = i;
        }
      }
      results[maxIdx].amount += deficit;
    }

    // Clean up temp fields
    return results.map(r => ({ name: r.name, amount: r.amount, weight: r.weight }));
  }

  // ---- Display Results ----
  let lastResults = null;
  let lastTotalAmount = 0;
  let lastExcludedAmount = 0;

  function displayResults(results, totalAmount, excludedAmount) {
    lastResults = results;
    lastTotalAmount = totalAmount;
    lastExcludedAmount = excludedAmount;

    resultSection.classList.remove('hidden');
    resultList.innerHTML = '';

    results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML =
        '<span class="result-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="result-amount">' + r.amount.toLocaleString() + ' 円</span>';
      resultList.appendChild(item);
    });

    const sum = results.reduce((s, r) => s + r.amount, 0);
    resultTotal.textContent = '合計: ' + sum.toLocaleString() + ' 円' +
      (excludedAmount > 0 ? ' (対象外: ' + excludedAmount.toLocaleString() + ' 円)' : '') +
      ' / 総額: ' + totalAmount.toLocaleString() + ' 円';

    copyBtn.textContent = '📋 結果をコピー（LINE・メール用）';
    copyBtn.classList.remove('copied');

    // Scroll to results
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Copy ----
  function buildShareText(results, totalAmount, excludedAmount) {
    const sum = results.reduce((s, r) => s + r.amount, 0);
    const lines = ['【割り勘清算】', ''];
    results.forEach(r => {
      lines.push(r.name + '：' + r.amount.toLocaleString() + '円');
    });
    lines.push('');
    lines.push('─'.repeat(16));
    lines.push('合計　　：' + sum.toLocaleString() + '円');
    if (excludedAmount > 0) {
      lines.push('対象外　：' + excludedAmount.toLocaleString() + '円');
      lines.push('総額　　：' + totalAmount.toLocaleString() + '円');
    }
    lines.push('');
    lines.push('※ easy-split で計算しました');
    return lines.join('\n');
  }

  function copyResults() {
    if (!lastResults) return;
    const text = buildShareText(lastResults, lastTotalAmount, lastExcludedAmount);
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅ コピーしました！';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = '📋 結果をコピー（LINE・メール用）';
        copyBtn.classList.remove('copied');
      }, 2500);
    }).catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = '✅ コピーしました！';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = '📋 結果をコピー（LINE・メール用）';
        copyBtn.classList.remove('copied');
      }, 2500);
    });
  }

  // ---- History ----
  function loadHistoryToggle() {
    const isOn = localStorage.getItem(LS_HISTORY_ON);
    historyToggle.checked = isOn === null ? true : isOn === '1';
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(LS_HISTORY)) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(results, totalAmount, excludedAmount) {
    if (!historyToggle.checked) return;

    const history = getHistory();
    history.unshift({
      date: new Date().toLocaleString('ja-JP'),
      totalAmount,
      excludedAmount,
      results: results.map(r => ({ name: r.name, amount: r.amount }))
    });

    // Keep max 5
    while (history.length > 5) history.pop();
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
      clearHistoryBtn.classList.add('hidden');
      return;
    }

    clearHistoryBtn.classList.remove('hidden');

    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';

      let html = '<div class="history-date">' + escapeHtml(entry.date) + ' — 合計: ' +
        (entry.totalAmount || 0).toLocaleString() + '円</div>';

      (entry.results || []).forEach(r => {
        html += '<div class="history-detail"><span>' + escapeHtml(r.name) +
          '</span><span>' + (r.amount || 0).toLocaleString() + '円</span></div>';
      });

      item.innerHTML = html;
      historyList.appendChild(item);
    });
  }

  // ---- Events ----
  function bindEvents() {
    addParticipantBtn.addEventListener('click', () => addParticipant('', 1.0));
    calculateBtn.addEventListener('click', calculate);
    copyBtn.addEventListener('click', copyResults);

    organizerMode.addEventListener('change', () => {
      organizerSettings.classList.toggle('hidden', !organizerMode.checked);
    });

    historyToggle.addEventListener('change', () => {
      localStorage.setItem(LS_HISTORY_ON, historyToggle.checked ? '1' : '0');
      if (!historyToggle.checked) {
        localStorage.removeItem(LS_HISTORY);
        renderHistory();
      }
    });

    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem(LS_HISTORY);
      renderHistory();
    });

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });

    roundingRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        roundingHint.textContent = radio.value === 'sig2'
          ? '上位2桁でキリよく丸めます（例: 12,344→12,000）'
          : '1円単位で計算します';
      });
    });
  }

  // ---- Utility ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Start ----
  document.addEventListener('DOMContentLoaded', init);
})();
