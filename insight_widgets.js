import {
  applyLocalizedOverlay,
  getLocale,
  loadLocalizedOverlay
} from './i18n.js';

const COPY = {
  'zh-TW': {
    collectingTitle: '趨勢資料累積中',
    collectingBody: '新興訊號需要至少 {min} 個完整資料日才能判斷升溫，目前已有 {days} 個。',
    shortWindow: '短期趨勢 · {days} 個完整資料日',
    fullWindow: '過去 {days} 日異常升溫',
    impactNote: '第一段關係由目前事件支持；後續箭頭為規則式「可能傳導」，不是已發生的因果宣稱。',
    anchor: '查看錨定事件 →'
  },
  en: {
    collectingTitle: 'Building trend history',
    collectingBody: 'Emerging signals require at least {min} complete report days; {days} are currently available.',
    shortWindow: 'Short-window trend · {days} complete days',
    fullWindow: 'Unusual acceleration over the past {days} days',
    impactNote: 'The first relationship is supported by current evidence; downstream arrows are rule-based potential transmission, not claims of observed causality.',
    anchor: 'View anchor event →'
  },
  'vi-VN': {
    collectingTitle: 'Đang tích lũy dữ liệu xu hướng',
    collectingBody: 'Tín hiệu mới nổi cần ít nhất {min} ngày báo cáo hoàn chỉnh; hiện có {days} ngày.',
    shortWindow: 'Xu hướng ngắn hạn · {days} ngày dữ liệu hoàn chỉnh',
    fullWindow: 'Tăng tốc bất thường trong {days} ngày qua',
    impactNote: 'Quan hệ đầu tiên được hỗ trợ bởi bằng chứng hiện tại; các mũi tên sau là kịch bản truyền dẫn tiềm năng theo quy tắc, không phải quan hệ nhân quả đã quan sát.',
    anchor: 'Xem sự kiện neo →'
  }
};

let reportPromise;
let scheduled = false;

function esc(value = '') {
  return String(value).replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
}

function fmt(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function copy() {
  return COPY[getLocale()] || COPY['zh-TW'];
}

async function localizedReport() {
  // Refetch when the locale changes because the app updates the query string
  // and rerenders the DOM without reloading the page.
  const base = await fetch('./data/latest.json', {cache:'no-store'}).then(r => r.json());
  const overlay = await loadLocalizedOverlay(getLocale(), base.date);
  return applyLocalizedOverlay(base, overlay);
}

function localizedLabel(item) {
  const locale = getLocale();
  return item?.labels?.[locale] || item?.labels?.['zh-TW'] || item?.name || item?.label || '';
}

function localizedReason(item) {
  const locale = getLocale();
  return item?.reasons?.[locale] || item?.reason || item?.label || '';
}

function enhanceEmerging(report) {
  const lists = [...document.querySelectorAll('.emerging-list')];
  if (!lists.length) return;
  const items = report.emerging_signals || [];
  const meta = report.trend_meta || {};
  const c = copy();

  for (const list of lists) {
    if (!items.length) {
      const days = Number(meta.available_history_days || 0);
      const min = Number(meta.min_history_days || 2);
      list.innerHTML = `<div class="insight-empty"><b>${esc(c.collectingTitle)}</b><span>${esc(fmt(c.collectingBody,{days,min}))}</span><div class="history-progress"><i style="width:${Math.min(100, Math.round(days / Math.max(1,min) * 100))}%"></i></div></div>`;
      const subtitle = list.closest('.card')?.querySelector('.section-title .sub');
      if (subtitle) subtitle.textContent = fmt(c.shortWindow,{days});
      continue;
    }

    const rows = [...list.querySelectorAll('.emerging-row')];
    rows.forEach((row, index) => {
      const item = items[index];
      if (!item) return;
      const name = row.querySelector('.emerging-name b');
      const reason = row.querySelector('.emerging-name small');
      if (name) name.textContent = localizedLabel(item);
      if (reason) reason.textContent = localizedReason(item);
      if (item.signal_ids?.[0]) {
        row.dataset.insightSignal = item.signal_ids[0];
        row.setAttribute('role','button');
        row.setAttribute('tabindex','0');
        const open = () => { location.hash = `#/signal/${item.signal_ids[0]}`; };
        row.onclick = open;
        row.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        };
      }
    });
    const subtitle = list.closest('.card')?.querySelector('.section-title .sub');
    if (subtitle) {
      const days = Number(meta.available_history_days || items[0]?.window_days || 0);
      subtitle.textContent = meta.status === 'full_window'
        ? fmt(c.fullWindow,{days})
        : fmt(c.shortWindow,{days});
    }
  }
}

function enhanceImpact(report) {
  if (!(location.hash || '#/today').startsWith('#/today')) return;
  const container = document.querySelector('.impact-chain');
  if (!container) return;
  const nodes = report.impact_chain || [];
  if (!nodes.length) return;

  container.innerHTML = nodes.map((node,index) => `${index ? '<span class="arrow">→</span>' : ''}<div class="impact-node"><div class="bubble">${esc(node.icon || '•')}</div>${esc(localizedLabel(node))}</div>`).join('');

  const parent = container.parentElement;
  if (!parent) return;
  parent.querySelector('.impact-policy-note')?.remove();
  const c = copy();
  const featured = (report.impact_chains || []).find(item => item.id === report.featured_impact_chain_id) || report.impact_chains?.[0];
  const note = document.createElement('div');
  note.className = 'impact-policy-note';
  note.innerHTML = `<span>${esc(c.impactNote)}</span>${featured?.anchor_signal_id ? `<button class="pill-btn" data-impact-anchor="${esc(featured.anchor_signal_id)}">${esc(c.anchor)}</button>` : ''}`;
  parent.appendChild(note);
  note.querySelector('[data-impact-anchor]')?.addEventListener('click', event => {
    location.hash = `#/signal/${event.currentTarget.dataset.impactAnchor}`;
  });
}

async function enhance() {
  const report = await localizedReport();
  enhanceEmerging(report);
  enhanceImpact(report);
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(async () => {
    scheduled = false;
    try { await enhance(); }
    catch (error) { console.warn('[insight-widgets]', error); }
  });
}

new MutationObserver(schedule).observe(document.querySelector('#app'), {childList:true, subtree:true});
window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
schedule();
