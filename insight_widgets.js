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
    whyEmerging: '為什麼升溫？',
    reasonTitle: '升溫依據',
    relatedEvents: '關聯事件',
    eventCount: '{count} 個事件',
    sourceCount: '{count} 個來源',
    historyDays: '{count} 日',
    baselineChange: '較近期基線 {change}%',
    preliminary: '初步訊號',
    full: '完整趨勢',
    viewEvent: '查看事件',
    close: '收合',
    supported: '事件支持',
    potential: '可能傳導',
    supportedBody: '目前資料中有事件直接支持這一段關聯。',
    potentialBody: '此段是規則式「可能傳導」路徑，目前沒有直接事件證據；用於標示值得追蹤的下一步，不代表因果已經發生。',
    evidence: '支持事件',
    noDirectEvidence: '目前無直接事件證據',
    nodeDetail: '節點說明',
    nodeType: '節點類型',
    relationDetail: '傳導依據',
    impactNote: '實線代表有事件支持；虛線代表規則式「可能傳導」，不是已發生的因果宣稱。',
    anchor: '查看錨定事件 →',
    archiveSummary: '當日全球重要事件摘要。'
  },
  en: {
    collectingTitle: 'Building trend history',
    collectingBody: 'Emerging signals require at least {min} complete report days; {days} are currently available.',
    shortWindow: 'Short-window trend · {days} complete days',
    fullWindow: 'Unusual acceleration over the past {days} days',
    whyEmerging: 'Why is it rising?',
    reasonTitle: 'Why this signal is emerging',
    relatedEvents: 'Related events',
    eventCount: '{count} events',
    sourceCount: '{count} sources',
    historyDays: '{count} days',
    baselineChange: '{change}% vs recent baseline',
    preliminary: 'Preliminary signal',
    full: 'Full-window trend',
    viewEvent: 'View event',
    close: 'Collapse',
    supported: 'Event-supported',
    potential: 'Potential transmission',
    supportedBody: 'Current report data contains an event that directly supports this relationship.',
    potentialBody: 'This is a rule-based potential transmission path with no direct event evidence yet. It marks what to watch next, not observed causality.',
    evidence: 'Supporting events',
    noDirectEvidence: 'No direct event evidence yet',
    nodeDetail: 'Node details',
    nodeType: 'Node type',
    relationDetail: 'Why these nodes are connected',
    impactNote: 'Solid connectors are event-supported; dashed connectors are rule-based potential transmission, not claims of observed causality.',
    anchor: 'View anchor event →',
    archiveSummary: 'Key global events for that day.'
  },
  'vi-VN': {
    collectingTitle: 'Đang tích lũy dữ liệu xu hướng',
    collectingBody: 'Tín hiệu mới nổi cần ít nhất {min} ngày báo cáo hoàn chỉnh; hiện có {days} ngày.',
    shortWindow: 'Xu hướng ngắn hạn · {days} ngày dữ liệu hoàn chỉnh',
    fullWindow: 'Tăng tốc bất thường trong {days} ngày qua',
    whyEmerging: 'Vì sao đang tăng?',
    reasonTitle: 'Cơ sở của tín hiệu tăng nhiệt',
    relatedEvents: 'Sự kiện liên quan',
    eventCount: '{count} sự kiện',
    sourceCount: '{count} nguồn',
    historyDays: '{count} ngày',
    baselineChange: '{change}% so với đường cơ sở gần đây',
    preliminary: 'Tín hiệu sơ bộ',
    full: 'Xu hướng đủ cửa sổ',
    viewEvent: 'Xem sự kiện',
    close: 'Thu gọn',
    supported: 'Có sự kiện hỗ trợ',
    potential: 'Truyền dẫn tiềm năng',
    supportedBody: 'Dữ liệu báo cáo hiện tại có sự kiện trực tiếp hỗ trợ mối liên hệ này.',
    potentialBody: 'Đây là đường truyền dẫn tiềm năng theo quy tắc, hiện chưa có bằng chứng sự kiện trực tiếp; dùng để chỉ ra điều cần theo dõi tiếp theo, không phải quan hệ nhân quả đã xảy ra.',
    evidence: 'Sự kiện hỗ trợ',
    noDirectEvidence: 'Hiện chưa có bằng chứng sự kiện trực tiếp',
    nodeDetail: 'Chi tiết nút',
    nodeType: 'Loại nút',
    relationDetail: 'Vì sao các nút được nối',
    impactNote: 'Đường liền biểu thị có sự kiện hỗ trợ; đường đứt biểu thị truyền dẫn tiềm năng theo quy tắc, không phải quan hệ nhân quả đã quan sát.',
    anchor: 'Xem sự kiện neo →',
    archiveSummary: 'Các sự kiện toàn cầu quan trọng trong ngày.'
  }
};

let scheduled = false;

function esc(value = '') {
  return String(value).replace(/[&<>"'`]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'
  }[ch]));
}

function fmt(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function copy() {
  return COPY[getLocale()] || COPY['zh-TW'];
}

async function localizedReport() {
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

function iconSvg(name, className = '') {
  const paths = {
    trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    percent: '<circle cx="7.5" cy="7.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/><path d="M6 18L18 6"/>',
    landmark: '<path d="M3 10h18"/><path d="M5 10V20"/><path d="M9 10V20"/><path d="M15 10V20"/><path d="M19 10V20"/><path d="M2 20h20"/><path d="M12 3l9 5H3z"/>',
    layers: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 5h10l-1.5 3L15 11H5"/>',
    exchange: '<path d="M7 7h11"/><path d="M15 4l3 3-3 3"/><path d="M17 17H6"/><path d="M9 14l-3 3 3 3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    factory: '<path d="M3 21V10l6 3V9l6 4V8l6 4v9z"/><path d="M7 17h2"/><path d="M13 17h2"/><path d="M19 17h2"/>',
    boxes: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/>',
    shield: '<path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-5"/>',
    route: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h4c3 0 3 5 0 5H9c-3 0-3 5 0 5h8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/>',
    radar: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/><path d="M12 12l7-7"/>'
  };
  return `<svg class="insight-icon ${esc(className)}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.radar}</svg>`;
}

function emergingIcon(item) {
  const key = `${item?.id || ''} ${item?.name || ''}`.toLowerCase();
  if (/finance|rate|利率|金融/.test(key)) return 'percent';
  if (/econom|policy|政策|經濟/.test(key)) return 'landmark';
  if (/supply|chain|供應/.test(key)) return 'boxes';
  if (/industry|製造|產業/.test(key)) return 'factory';
  return 'trending';
}

function nodeIcon(node, index) {
  const label = `${node?.type || ''} ${localizedLabel(node)}`.toLowerCase();
  if (/policy|event|政策|事件/.test(label)) return 'flag';
  if (/yen|fx|currency|日圓|匯/.test(label)) return 'exchange';
  if (/flow|global|asia|資金流|亞洲/.test(label)) return 'globe';
  if (/market|equity|股|市場/.test(label)) return 'chart';
  if (/supply|chain|供應/.test(label)) return 'boxes';
  if (/industry|manufactur|產業|製造/.test(label)) return 'factory';
  return ['flag','exchange','globe','chart'][index] || 'radar';
}

function signalMap(report) {
  return new Map((report.signals || []).map(signal => [signal.id, signal]));
}

function renderRelatedEvents(ids, report, limit = 3) {
  const c = copy();
  const byId = signalMap(report);
  const rows = (ids || []).map(id => byId.get(id)).filter(Boolean).slice(0, limit);
  if (!rows.length) return `<div class="insight-no-evidence">${iconSvg('info')}<span>${esc(c.noDirectEvidence)}</span></div>`;
  return rows.map(signal => `<button class="insight-event-link" type="button" data-insight-open-signal="${esc(signal.id)}"><span>${iconSvg('file')}</span><span class="insight-event-title">${esc(signal.title)}</span><span class="insight-event-action">${esc(c.viewEvent)} →</span></button>`).join('');
}

function renderEmergingCard(item, report, index) {
  const c = copy();
  const change = Number(item.change || 0);
  const eventCount = Number(item.event_count || item.signal_ids?.length || 0);
  const sourceCount = Number(item.source_count || 0);
  const days = Number(item.window_days || report.trend_meta?.available_history_days || 0);
  const status = item.status === 'full_window' ? c.full : c.preliminary;
  const series = Array.isArray(item.series) && item.series.length ? item.series : [0,0];
  const max = Math.max(...series), min = Math.min(...series), range = max - min || 1;
  const points = series.map((value, i) => `${4 + i * 112 / Math.max(1, series.length - 1)},${30 - ((value-min)/range)*24}`).join(' ');
  return `<article class="emerging-insight" data-emerging-card="${esc(item.id || index)}">
    <div class="emerging-insight-head">
      <div class="signal-icon-modern">${iconSvg(emergingIcon(item))}</div>
      <div class="emerging-insight-name">
        <b>${esc(localizedLabel(item))}</b>
        <span>${esc(localizedReason(item))}</span>
      </div>
      <div class="emerging-change">
        <strong>▲ ${esc(change)}%</strong>
        <small>${esc(status)}</small>
      </div>
    </div>
    <div class="emerging-spark-wrap">
      <svg class="emerging-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="currentColor" stroke-width="2" points="${esc(points)}"/>
        <circle cx="${esc(4 + (series.length-1)*112/Math.max(1, series.length-1))}" cy="${esc(30 - ((series[series.length-1]-min)/range)*24)}" r="2.6" fill="currentColor"/>
      </svg>
    </div>
    <div class="emerging-evidence-strip">
      <span>${iconSvg('trending')}${esc(fmt(c.baselineChange,{change:change >= 0 ? `+${change}` : change}))}</span>
      <span>${iconSvg('file')}${esc(fmt(c.eventCount,{count:eventCount}))}</span>
      <span>${iconSvg('layers')}${esc(fmt(c.sourceCount,{count:sourceCount}))}</span>
      <span>${iconSvg('clock')}${esc(fmt(c.historyDays,{count:days}))}</span>
    </div>
    <button class="insight-disclosure" type="button" aria-expanded="false" data-emerging-toggle="${esc(item.id || index)}">
      <span>${iconSvg('info')}${esc(c.whyEmerging)}</span><span class="insight-chevron">⌄</span>
    </button>
    <div class="emerging-reason-panel" hidden>
      <div class="insight-panel-title">${esc(c.reasonTitle)}</div>
      <p>${esc(localizedReason(item))}</p>
      <div class="insight-panel-title">${esc(c.relatedEvents)}</div>
      <div class="insight-event-list">${renderRelatedEvents(item.signal_ids, report)}</div>
    </div>
  </article>`;
}

function bindSignalLinks(root = document) {
  root.querySelectorAll('[data-insight-open-signal]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      location.hash = `#/signal/${event.currentTarget.dataset.insightOpenSignal}`;
    });
  });
}

function enhanceEmerging(report) {
  const lists = [...document.querySelectorAll('.emerging-list')];
  if (!lists.length) return;
  const items = report.emerging_signals || [];
  const meta = report.trend_meta || {};
  const c = copy();
  const locale = getLocale();
  const signature = `${locale}:${meta.status || 'none'}:${meta.available_history_days || 0}:${items.map(x=>x.id).join(',')}`;

  for (const list of lists) {
    if (list.dataset.insightSignature === signature) continue;
    list.dataset.insightSignature = signature;

    if (!items.length) {
      const days = Number(meta.available_history_days || 0);
      const min = Number(meta.min_history_days || 2);
      list.innerHTML = `<div class="insight-empty"><b>${esc(c.collectingTitle)}</b><span>${esc(fmt(c.collectingBody,{days,min}))}</span><div class="history-progress"><i style="width:${Math.min(100, Math.round(days / Math.max(1,min) * 100))}%"></i></div></div>`;
      const subtitle = list.closest('.card')?.querySelector('.section-title .sub');
      if (subtitle) subtitle.textContent = fmt(c.shortWindow,{days});
      continue;
    }

    list.innerHTML = items.map((item,index) => renderEmergingCard(item, report, index)).join('');
    list.querySelectorAll('[data-emerging-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const card = button.closest('.emerging-insight');
        const panel = card?.querySelector('.emerging-reason-panel');
        if (!panel) return;
        const opening = panel.hidden;
        panel.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
        button.querySelector('.insight-chevron').textContent = opening ? '⌃' : '⌄';
      });
    });
    bindSignalLinks(list);

    const subtitle = list.closest('.card')?.querySelector('.section-title .sub');
    if (subtitle) {
      const days = Number(meta.available_history_days || items[0]?.window_days || 0);
      subtitle.textContent = meta.status === 'full_window'
        ? fmt(c.fullWindow,{days})
        : fmt(c.shortWindow,{days});
    }
  }
}

function renderImpactNode(node, index) {
  return `<button type="button" class="impact-node impact-node-modern" data-impact-node="${esc(node.id || index)}">
    <span class="impact-step">${index + 1}</span>
    <span class="impact-icon-ring">${iconSvg(nodeIcon(node,index))}</span>
    <span class="impact-node-label">${esc(localizedLabel(node))}</span>
  </button>`;
}

function renderImpactConnector(edge, index) {
  const relation = String(edge?.relation || 'POTENTIAL').toUpperCase();
  const supported = relation === 'SUPPORTED';
  return `<button type="button" class="impact-connector ${supported ? 'supported' : 'potential'}" data-impact-edge="${index}" aria-label="${esc(supported ? copy().supported : copy().potential)}">
    <span class="connector-line"></span>
    <span class="connector-arrow">→</span>
    <span class="connector-badge">${supported ? iconSvg('shield') : iconSvg('route')}</span>
  </button>`;
}

function renderImpactDetail(featured, report, selection) {
  const c = copy();
  if (!featured) return '';
  const nodes = featured.nodes || [];
  const edges = featured.edges || [];

  if (selection?.kind === 'edge') {
    const edge = edges[selection.index];
    if (!edge) return '';
    const from = nodes.find(node => node.id === edge.from);
    const to = nodes.find(node => node.id === edge.to);
    const supported = String(edge.relation || '').toUpperCase() === 'SUPPORTED';
    return `<div class="impact-detail-card ${supported ? 'supported' : 'potential'}">
      <div class="impact-detail-kicker">${iconSvg(supported ? 'shield' : 'route')}${esc(c.relationDetail)}</div>
      <div class="impact-detail-title">${esc(localizedLabel(from))} <span>→</span> ${esc(localizedLabel(to))}</div>
      <div class="impact-relation-status">${esc(supported ? c.supported : c.potential)}</div>
      <p>${esc(supported ? c.supportedBody : c.potentialBody)}</p>
      <div class="insight-panel-title">${esc(c.evidence)}</div>
      <div class="insight-event-list">${renderRelatedEvents(edge.evidence_signal_ids, report)}</div>
    </div>`;
  }

  const node = nodes[selection?.index ?? 0];
  if (!node) return '';
  return `<div class="impact-detail-card node">
    <div class="impact-detail-kicker">${iconSvg(nodeIcon(node, selection?.index ?? 0))}${esc(c.nodeDetail)}</div>
    <div class="impact-detail-title">${esc(localizedLabel(node))}</div>
    <div class="impact-node-type">${esc(c.nodeType)} · ${esc(node.type || 'signal')}</div>
  </div>`;
}

function enhanceImpact(report) {
  if (!(location.hash || '#/today').startsWith('#/today')) return;
  const container = document.querySelector('.impact-chain');
  if (!container) return;

  const featured = (report.impact_chains || []).find(item => item.id === report.featured_impact_chain_id) || report.impact_chains?.[0];
  const nodes = featured?.nodes || report.impact_chain || [];
  const edges = featured?.edges || [];
  if (!nodes.length) return;

  const signature = `${getLocale()}:${featured?.id || 'featured'}:${nodes.map((x,index)=>x.id || index).join(',')}`;
  if (container.dataset.insightSignature === signature) return;
  container.dataset.insightSignature = signature;

  container.innerHTML = `<div class="impact-track">${nodes.map((node,index) =>
    `${index ? renderImpactConnector(edges[index-1] || {relation:'POTENTIAL'}, index-1) : ''}${renderImpactNode(node,index)}`
  ).join('')}</div><div class="impact-detail-slot"></div>`;

  const detailSlot = container.querySelector('.impact-detail-slot');
  const showDetail = selection => {
    detailSlot.innerHTML = renderImpactDetail(featured, report, selection);
    bindSignalLinks(detailSlot);
  };

  container.querySelectorAll('[data-impact-node]').forEach((button,index) => {
    button.addEventListener('click', () => showDetail({kind:'node',index}));
  });
  container.querySelectorAll('[data-impact-edge]').forEach(button => {
    button.addEventListener('click', () => showDetail({kind:'edge',index:Number(button.dataset.impactEdge)}));
  });

  const parent = container.parentElement;
  if (!parent) return;
  parent.querySelector('.impact-policy-note')?.remove();
  const c = copy();
  const note = document.createElement('div');
  note.className = 'impact-policy-note';
  note.dataset.insightSignature = signature;
  note.innerHTML = `<span>${esc(c.impactNote)}</span>${featured?.anchor_signal_id ? `<button class="pill-btn" data-impact-anchor="${esc(featured.anchor_signal_id)}">${esc(c.anchor)}</button>` : ''}`;
  parent.appendChild(note);
  note.querySelector('[data-impact-anchor]')?.addEventListener('click', event => {
    location.hash = `#/signal/${event.currentTarget.dataset.impactAnchor}`;
  });
}

function enhanceArchive() {
  if (!(location.hash || '#/today').startsWith('#/archive')) return;
  const c = copy();
  document.querySelectorAll('.archive-item small').forEach(node => {
    node.textContent = `　${c.archiveSummary}`;
  });
}

async function enhance() {
  const report = await localizedReport();
  enhanceEmerging(report);
  enhanceImpact(report);
  enhanceArchive();
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
