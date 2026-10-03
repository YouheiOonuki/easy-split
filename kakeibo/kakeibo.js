/**
 * 家計簿テンプレート（kakeibo/index.html）の画面
 * 計算は ./kakeibo-calc.js。保存は localStorage の easysplit_kakeibo だけ
 */
(function () {
  'use strict';
  const K = window.Kakeibo;
  const KEY = 'easysplit_kakeibo';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => n.toLocaleString('ja-JP');
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth() + 1 };

  let st;
  try { st = K.normalize(JSON.parse(localStorage.getItem(KEY) || 'null'), today); } catch (e) { st = K.normalize(null, today); }
  let timer = 0;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }
  function flush() {
    clearTimeout(timer);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 保存できなくても動く */ }
  }
  // 閉じる・再読み込みの直前に、待っている保存を書く
  window.addEventListener('pagehide', flush);

  // 年と月の選択肢（前の年の 1 月〜次の年の 12 月）
  (function () {
    const o = [];
    for (let y = today.y - 1; y <= today.y + 1; y++) for (let m = 1; m <= 12; m++) o.push(`<option value="${y}-${m}">${y}年${m}月</option>`);
    $('ym').innerHTML = o.join('');
  })();

  function ratio() {
    return K.shareRatio(st.method, st.method === 'income' ? [st.incomeA, st.incomeB] : [st.percentA]);
  }
  function names() { return st.names; }

  function sync() {
    document.querySelector(`input[name="type"][value="${st.type}"]`).checked = true;
    const key = `${st.y}-${st.m}`;
    if (![...$('ym').options].some((o) => o.value === key)) $('ym').insertAdjacentHTML('afterbegin', `<option value="${key}">${st.y}年${st.m}月</option>`);
    $('ym').value = key;
    $('cats').value = st.cats;
    $('method').value = st.method;
    $('incomeA').value = st.incomeA; $('incomeB').value = st.incomeB; $('percentA').value = st.percentA;
    $('paidA').value = st.paidA; $('paidB').value = st.paidB;
    $('nameA').value = st.names[0]; $('nameB').value = st.names[1];
    $('unit').value = String(st.unit); $('holder').value = String(st.holder);
    $('budget').checked = st.budget; $('rows').value = String(st.rows); $('credit').checked = st.credit;
  }

  function render() {
    const [a, b] = names();
    ['lbl-incA', 'lbl-pctA', 'lbl-paidA'].forEach((id) => { $(id).textContent = a; });
    ['lbl-incB', 'lbl-paidB'].forEach((id) => { $(id).textContent = b; });
    $('holder').options[0].textContent = a; $('holder').options[1].textContent = b;
    $('f-cats').hidden = st.type !== 'month';
    $('f-method').hidden = st.type !== 'shared';
    $('opt-shared').hidden = st.type !== 'shared';
    $('f-income').hidden = st.method !== 'income';
    $('f-percent').hidden = st.method !== 'percent';
    $('ym').previousElementSibling.textContent = st.type === 'year' ? '年（月は使いません）' : '年と月';

    const r = ratio();
    $('ratio-out').textContent = r ? `${a} ${r[0]}%・${b} ${r[1]}%` : (st.method === 'income' ? '2 人の収入を入れると割合が出ます。' : '割合を入れてください。');

    let html = '';
    if (st.type === 'month') html = monthSheet();
    else if (st.type === 'shared') html = sharedSheet(r);
    else html = yearSheet();
    if (st.credit) html += '<p class="credit">yorozu-craft.com/easy-split/kakeibo/ で作成</p>';
    $('sheet').className = 'sheet ' + st.type;
    $('sheet').innerHTML = html;

    window.YorozuScreen.detailsSummary({
      'opt-more': `${a}・${b}・${st.unit} 円単位`,
      'opt-shared': st.paidA === '' && st.paidB === '' ? '入力なし' : '入力あり',
    });
    bar.set('印刷する（' + ({ month: `${st.y}年${st.m}月の家計簿`, shared: `${st.y}年${st.m}月の共通費 精算表`, year: `${st.y}年の収支` })[st.type] + '）');
  }

  function monthSheet() {
    const cats = K.parseCats(st.cats);
    const list = cats.length ? cats : K.DEFAULT_CATS;
    const days = K.monthDays(st.y, st.m);
    const head = '<tr><th class="col-d">日</th><th class="col-w">曜</th>' + list.map((c) => `<th>${esc(c)}</th>`).join('') + '<th>合計</th></tr>';
    const blanks = '<td></td>'.repeat(list.length + 1);
    const rows = days.map((x) => `<tr${x.w === 0 || x.w === 6 ? ' class="we"' : ''}><td class="d">${x.d}</td><td class="w">${x.wd}</td>${blanks}</tr>`).join('');
    const sums = ['合計'].concat(st.budget ? ['予算', '残り'] : []).map((t, i) => `<tr${i === 0 ? ' class="sum"' : ''}><th colspan="2">${t}</th>${blanks}</tr>`).join('');
    return `<h2>${st.y}年${st.m}月の家計簿</h2>` +
      '<p class="meta"><span>収入 <span class="blank">円</span></span><span>先月からの残り <span class="blank">円</span></span><span>貯金 <span class="blank">円</span></span></p>' +
      `<table><thead>${head}</thead><tbody>${rows}${sums}</tbody></table>`;
  }

  function sharedSheet(r) {
    const [a, b] = names();
    const ratioText = r ? `${esc(a)} ${r[0]}%・${esc(b)} ${r[1]}%（${({ half: '折半', income: '収入の比', percent: '決めた割合' })[st.method]}）` : `${esc(a)} ＿＿%・${esc(b)} ＿＿%`;
    const rows = Array.from({ length: st.rows }, () => `<tr><td></td><td></td><td></td><td class="w">${esc(a)}・${esc(b)}</td></tr>`).join('');
    let total = '', pa = '', pb = '', oa = '', ob = '', line = '＿＿＿ が ＿＿＿ に ＿＿＿＿ 円 渡す';
    if (st.paidA !== '' || st.paidB !== '') {
      const A = Number(st.paidA) || 0, B = Number(st.paidB) || 0;
      total = yen(A + B); pa = yen(A); pb = yen(B);
      const owe = r ? K.splitShared(A + B, r, st.unit, st.holder) : null;
      if (owe) {
        oa = yen(owe[0]); ob = yen(owe[1]);
        const s = K.settle([A, B], owe);
        line = s.amount === 0 ? '精算なし（ちょうど）' : `${esc(names()[s.from])} が ${esc(names()[s.to])} に ${yen(s.amount)} 円 渡す`;
      }
    }
    const cell = (v) => `<span class="blank">${v ? v + ' ' : ''}円</span>`;
    return `<h2>${st.y}年${st.m}月 共通費の精算表</h2>` +
      `<p class="meta"><span>負担の割合: ${ratioText}</span></p>` +
      '<table><thead><tr><th style="width:4.5em">日付</th><th>内容</th><th style="width:7em">金額</th><th style="width:8em">払った人（○）</th></tr></thead>' +
      `<tbody>${rows}</tbody></table>` +
      `<div class="box"><span class="line">共通費の合計 ${cell(total)}</span><span class="line"></span>` +
      `<span class="line">${esc(a)} が払った ${cell(pa)}</span><span class="line">${esc(b)} が払った ${cell(pb)}</span>` +
      `<span class="line">${esc(a)} の負担 ${cell(oa)}</span><span class="line">${esc(b)} の負担 ${cell(ob)}</span>` +
      `<span class="full">精算: ${line}</span></div>`;
  }

  function yearSheet() {
    const rows = Array.from({ length: 12 }, (_, i) => `<tr><td class="d">${i + 1}月</td><td></td><td></td><td></td><td></td></tr>`).join('');
    return `<h2>${st.y}年の収支</h2>` +
      '<table><thead><tr><th style="width:3.5em">月</th><th>収入</th><th>支出</th><th>収入 − 支出</th><th>メモ（特別な出費など）</th></tr></thead>' +
      `<tbody>${rows}<tr class="sum"><th>合計</th><td></td><td></td><td></td><td></td></tr></tbody></table>`;
  }

  function settleText() {
    if (st.type !== 'shared') return '';
    if (st.paidA === '' && st.paidB === '') return '';
    const r = ratio();
    if (!r) return '負担の割合を決めると、精算の額が出ます。';
    const A = Number(st.paidA) || 0, B = Number(st.paidB) || 0;
    const owe = K.splitShared(A + B, r, st.unit, st.holder);
    const s = K.settle([A, B], owe);
    return s.amount === 0 ? `合計 ${yen(A + B)} 円。精算なし（ちょうど）` : `合計 ${yen(A + B)} 円。${names()[s.from]} が ${names()[s.to]} に ${yen(s.amount)} 円 渡す`;
  }

  const bar = window.YorozuScreen.fixedBar({ bar: 'fixbar', watch: 'print', text: 'fixbar-text', onClick: () => window.print() });
  function update() { render(); $('settle-out').textContent = settleText(); save(); }

  document.querySelectorAll('input[name="type"]').forEach((el) => el.addEventListener('change', () => { st.type = el.value; update(); }));
  $('ym').addEventListener('change', () => { const [y, m] = $('ym').value.split('-').map(Number); st.y = y; st.m = m; update(); });
  $('cats').addEventListener('input', () => { st.cats = $('cats').value; update(); });
  $('method').addEventListener('change', () => { st.method = $('method').value; update(); });
  const num = (id, k) => $(id).addEventListener('input', () => { st[k] = $(id).value === '' ? '' : Math.max(0, Math.round(Number($(id).value))); update(); });
  num('incomeA', 'incomeA'); num('incomeB', 'incomeB'); num('paidA', 'paidA'); num('paidB', 'paidB');
  $('percentA').addEventListener('input', () => { st.percentA = $('percentA').value === '' ? '' : Math.max(0, Math.min(100, Math.round(Number($('percentA').value)))); update(); });
  $('nameA').addEventListener('input', () => { st.names[0] = $('nameA').value.slice(0, 8) || 'A'; update(); });
  $('nameB').addEventListener('input', () => { st.names[1] = $('nameB').value.slice(0, 8) || 'B'; update(); });
  $('unit').addEventListener('change', () => { st.unit = Number($('unit').value); update(); });
  $('holder').addEventListener('change', () => { st.holder = Number($('holder').value); update(); });
  $('budget').addEventListener('change', () => { st.budget = $('budget').checked; update(); });
  $('rows').addEventListener('change', () => { st.rows = Number($('rows').value); update(); });
  $('credit').addEventListener('change', () => { st.credit = $('credit').checked; update(); });
  $('print').addEventListener('click', () => window.print());

  // 書き出し・読み込み（サイト README「ツールを追加するとき」20）
  $('export').addEventListener('click', () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const json = JSON.stringify({ tool: 'easy-split', version: 1, exportedAt: d.toISOString(), data: { [KEY]: st } }, null, 1);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const el = document.createElement('a');
    el.href = url; el.download = `easy-split-backup-${ymd}.json`;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('save-msg').textContent = 'ファイルに書き出しました。';
  });
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async () => {
    const f = $('import-file').files[0];
    $('import-file').value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj || obj.tool !== 'easy-split' || !obj.data || !obj.data[KEY]) throw new Error('tool');
      if (!confirm('ファイルの内容で、いまの入力を上書きしますか？')) return;
      st = K.normalize(obj.data[KEY], today);
      sync(); update();
      $('save-msg').textContent = 'ファイルから読み込みました。';
    } catch (e) {
      $('save-msg').textContent = 'このファイルは読み込めません（家計簿テンプレートで書き出したファイルを選んでください）。';
    }
  });

  sync();
  render();
  $('settle-out').textContent = settleText();
})();
