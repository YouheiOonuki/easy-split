/* easy-split スマホ版（yorozu-plans ROADMAP 7.41.3 K176）: 縦 1 画面で 合計・人数・丸め → 1 人あたりと、端数の調整で額が違う人。計算は ../split.js（EasySplit.computeSplit）
   送る文に名前は入らない（入れる欄が無い）。値は合計・人数・1 人あたり・額の違う人だけ。URL に値を入れない（D218）。保存しない */
(function (root) {
  'use strict';

  /**
   * 計算（split.js をそのまま呼ぶ。端数は split.js の配り方のまま: 単位ずつ、幹事から先に足す）。
   * 返りは { ok, each（いちばん多くの人が払う額）, extra: [{ amount, n, organizer }]（それ以外の額）, total, count, unit } か { ok:false, message }
   */
  function quickSplit(S, total, count, unit) {
    const people = Array.from({ length: count }, (_, i) => ({ id: i, name: '', weight: 1 }));
    const r = S.computeSplit({ total, people, organizerId: 0, unit });
    if (r.error) return { ok: false, message: r.error };
    const by = new Map();
    for (const p of r.results) {
      const g = by.get(p.amount) || { amount: p.amount, n: 0, organizer: false };
      g.n++;
      if (p.isOrganizer) g.organizer = true;
      by.set(p.amount, g);
    }
    const groups = [...by.values()].sort((a, b) => b.n - a.n || a.amount - b.amount);
    return { ok: true, each: groups[0].amount, extra: groups.slice(1), total, count, unit: r.unit };
  }

  const yen = (n) => n.toLocaleString('ja-JP') + ' 円';
  /** 端数の調整で額が違う人の行（例「3,400 円の人が 2 人（幹事を含む）」） */
  const extraLine = (g) => `${yen(g.amount)}の人が ${g.n} 人${g.organizer ? '（幹事を含む）' : ''}`;
  /** LINE などに送る文。名前は入らない */
  function shareText(q) {
    return [`1 人 ${yen(q.each)}（合計 ${yen(q.total)}・${q.count} 人）`, ...q.extra.map(extraLine)].join('\n');
  }

  if (typeof module === 'object' && module.exports) { module.exports = { quickSplit, shareText }; return; }

  const $ = (id) => document.getElementById(id);
  const S = root.EasySplit;
  const URL_SHARE = 'https://yorozu-craft.com/easy-split/quick/';
  let digits = '';
  let count = 4;
  const unit = () => Number(document.querySelector('input[name=qunit]:checked').value);

  function render() {
    $('qTotal').textContent = digits ? yen(Number(digits)) : '0 円';
    $('qCount').textContent = count + ' 人';
    const total = Number(digits);
    if (!total) { $('qEach').textContent = '—'; $('qOrg').textContent = ''; $('qSend').disabled = true; return; }
    const q = quickSplit(S, total, count, unit());
    if (!q.ok) { $('qEach').textContent = '—'; $('qOrg').textContent = q.message; $('qSend').disabled = true; return; }
    $('qEach').textContent = yen(q.each);
    $('qOrg').textContent = q.extra.length ? q.extra.map(extraLine).join('、') : '端数なし';
    $('qSend').disabled = false;
    $('qSend').dataset.text = shareText(q);
  }

  document.querySelectorAll('.qkey').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'del') digits = digits.slice(0, -1);
    else if (k === 'clr') digits = '';
    else if ((digits + k).length <= 8) digits = (digits + k).replace(/^0+/, '');
    render();
  }));
  $('qMinus').addEventListener('click', () => { if (count > 2) { count--; render(); } });
  $('qPlus').addEventListener('click', () => { if (count < 99) { count++; render(); } });
  document.querySelectorAll('input[name=qunit]').forEach((r) => r.addEventListener('change', render));
  $('qSend').addEventListener('click', () => {
    const text = $('qSend').dataset.text;
    if (navigator.share) { navigator.share({ text, url: URL_SHARE }).catch(() => {}); return; }
    const a = document.createElement('a');
    a.href = 'https://line.me/R/share?text=' + encodeURIComponent(text + '\n' + URL_SHARE);
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  });
  render();
})(this);
