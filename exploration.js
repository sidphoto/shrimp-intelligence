import {
  applyLocalizedOverlay,
  categoryLabel,
  getLocale,
  loadLocalizedOverlay,
  regionLabel,
  severityLabel,
  sourceClassLabel,
  topicName
} from './i18n.js';
import {
  QUICK_SEVERITIES,
  applyQuickSeverityFilter,
  normalizeQuickSeverities
} from './quick_filters.js';
import {
  deriveTopicCards,
  topicBreakdown,
  topicDefinition,
  topicSignals
} from './topic_catalog.js';

const COPY = {
  'zh-TW': {
    focusTitle:'今日全球焦點分布', focusSub:'依目前訊號與快速篩選', focusEmpty:'目前沒有可顯示的地區訊號。',
    topicBack:'← 返回今日總覽', topicSignals:'相關訊號', topicDescription:'從主題查看事件、地區、來源與重要度分布。',
    total:'訊號總數', regions:'主要地區', sources:'來源結構', importance:'重要度', empty:'這個主題目前沒有符合快速篩選的訊號。',
    quickFiltered:'快速篩選後 {shown} / {total} 項', count:'{count} 項訊號 →'
  },
  en: {
    focusTitle:'Today’s Global Focus', focusSub:'Based on current signals and quick filters', focusEmpty:'No regional signals are currently visible.',
    topicBack:'← Back to Today', topicSignals:'Related signals', topicDescription:'Explore events, regions, sources, and importance within this topic.',
    total:'Total signals', regions:'Top regions', sources:'Source mix', importance:'Importance', empty:'No signals in this topic match the current quick filters.',
    quickFiltered:'{shown} / {total} after quick filters', count:'{count} signals →'
  },
  'vi-VN': {
    focusTitle:'Phân bố trọng tâm toàn cầu hôm nay', focusSub:'Theo tín hiệu hiện tại và bộ lọc nhanh', focusEmpty:'Hiện không có tín hiệu khu vực để hiển thị.',
    topicBack:'← Quay lại tổng quan hôm nay', topicSignals:'Tín hiệu liên quan', topicDescription:'Xem sự kiện, khu vực, nguồn và mức độ quan trọng theo chủ đề.',
    total:'Tổng số tín hiệu', regions:'Khu vực chính', sources:'Cơ cấu nguồn', importance:'Mức độ quan trọng', empty:'Không có tín hiệu trong chủ đề này phù hợp với bộ lọc nhanh hiện tại.',
    quickFiltered:'{shown} / {total} sau bộ lọc nhanh', count:'{count} tín hiệu →'
  }
};

const TOPIC_LABELS = {
  'zh-TW': {
    'world-news':'全球要聞','geopolitics':'地緣政治','economy-markets':'經濟與市場','ai-models':'AI 模型',
    'dev-open-source':'開發與開源','tech-semiconductor':'科技與半導體','supply-chain':'產業與供應鏈',
    'energy-commodities':'能源與原物料','science-climate':'科學與氣候','business-transform':'商業變革',
    'society':'社會趨勢','taiwan':'台灣相關'
  },
  en: {
    'world-news':'World News','geopolitics':'Geopolitics','economy-markets':'Economy & Markets','ai-models':'AI Models',
    'dev-open-source':'Dev & Open Source','tech-semiconductor':'Tech & Semiconductor','supply-chain':'Supply Chain',
    'energy-commodities':'Energy & Commodities','science-climate':'Science & Climate','business-transform':'Business Transformation',
    'society':'Society','taiwan':'Taiwan'
  },
  'vi-VN': {
    'world-news':'Tin thế giới','geopolitics':'Địa chính trị','economy-markets':'Kinh tế & Thị trường','ai-models':'Mô hình AI',
    'dev-open-source':'Phát triển & Mã nguồn mở','tech-semiconductor':'Công nghệ & Chất bán dẫn','supply-chain':'Công nghiệp & Chuỗi cung ứng',
    'energy-commodities':'Năng lượng & Hàng hóa','science-climate':'Khoa học & Khí hậu','business-transform':'Chuyển đổi kinh doanh',
    'society':'Xu hướng xã hội','taiwan':'Đài Loan'
  }
};

const REGION_PATTERNS = {
  taiwan:[/\btaiwan\b/i,/taipei/i,/tsmc/i,/台灣|臺灣|台北|臺北|台積電|đài loan/i],
  us:[/\bu\.?s\.?\b/i,/united states/i,/america(?:n)?/i,/washington/i,/federal reserve/i,/\bfed\b/i,/美國|美方|hoa kỳ/i],
  china:[/\bchina\b/i,/chinese/i,/beijing/i,/中國|北京|中方|trung quốc/i],
  japan:[/\bjapan\b/i,/japanese/i,/tokyo/i,/bank of japan/i,/\bboj\b/i,/日本|東京|日圓|日銀|nhật bản/i],
  vietnam:[/\bvietnam\b/i,/vietnamese/i,/hanoi/i,/越南|việt nam/i],
  asia:[/\basia\b/i,/asian/i,/asia-pacific/i,/apac/i,/亞洲|亞太|châu á/i],
  europe:[/\beurope\b/i,/european/i,/歐洲|châu âu/i],
  eu:[/european union/i,/\beu\b/i,/\becb\b/i,/歐盟|liên minh châu âu/i],
  'middle-east':[/middle east/i,/iran/i,/iranian/i,/israel/i,/gulf/i,/hormuz/i,/中東|伊朗|以色列|trung đông/i]
};

let baseReportPromise;
let scheduled = false;

function copy(){ return COPY[getLocale()] || COPY['zh-TW']; }
function fmt(template, values){ return template.replace(/\{(\w+)\}/g,(_,key)=>values[key] ?? ''); }
function esc(value=''){ return String(value).replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;','`':'&#96;'}[ch])); }
function scoreClass(score){ return Number(score)>=95?'critical':Number(score)>=85?'important':'emerging'; }
function localizedTopicName(topic){ return TOPIC_LABELS[getLocale()]?.[topic?.slug] || topicName(topic); }

function currentQuickSeverities(){
  try { return normalizeQuickSeverities(JSON.parse(localStorage.getItem('sharbo:quick-severities'))); }
  catch { return [...QUICK_SEVERITIES]; }
}

function focusRegions(signal){
  const regions = new Set((signal?.regions || []).filter(x=>x !== 'global' && x !== 'taiwan' && REGION_PATTERNS[x]));
  const text = [signal?.title,signal?.what_happened,signal?.source_label].filter(Boolean).join(' ');
  for (const [region,patterns] of Object.entries(REGION_PATTERNS)) if (patterns.some(pattern=>pattern.test(text))) regions.add(region);
  if (!regions.size) regions.add('global');
  return [...regions];
}

async function baseReport(){
  if (!baseReportPromise) baseReportPromise = fetch('./data/latest.json',{cache:'no-store'}).then(r=>r.json());
  return baseReportPromise;
}

async function localizedReport(){
  const base = await baseReport();
  const overlay = await loadLocalizedOverlay(getLocale(),base.date);
  return applyLocalizedOverlay(base,overlay);
}

function regionDistribution(signals){
  const counts = new Map();
  for (const signal of signals) for (const region of focusRegions(signal)) counts.set(region,(counts.get(region)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5);
}

function renderFocusDistribution(report){
  const target = document.querySelector('.watercolor-map');
  if (!target || target.dataset.functional === '1') return;
  const visible = applyQuickSeverityFilter(report.signals || [],currentQuickSeverities());
  const regions = regionDistribution(visible);
  const max = Math.max(1,...regions.map(([,count])=>count));
  const c = copy();
  target.dataset.functional='1';
  target.classList.add('focus-distribution');
  target.setAttribute('aria-label',c.focusTitle);
  target.innerHTML=`<div class="focus-dist-inner"><div class="focus-dist-head"><div><b>${esc(c.focusTitle)}</b><small>${esc(c.focusSub)}</small></div><span>${visible.length}</span></div><div class="focus-dist-list">${regions.map(([region,count])=>`<button class="focus-region" data-focus-region="${esc(region)}"><span class="focus-region-name">${esc(regionLabel(region))}</span><span class="focus-region-bar"><i style="width:${Math.max(8,Math.round(count/max*100))}%"></i></span><strong>${count}</strong></button>`).join('') || `<div class="focus-dist-empty">${esc(c.focusEmpty)}</div>`}</div></div>`;
  target.querySelectorAll('[data-focus-region]').forEach(button=>button.onclick=()=>{
    sessionStorage.setItem('sharbo:pending-region',button.dataset.focusRegion);
    location.hash='#/radar';
  });
}

function enhanceTopicCards(report){
  const cards=[...document.querySelectorAll('.topic-card')];
  if (!cards.length) return;
  const topics=deriveTopicCards(report.topic_summary || [],report.signals || []);
  const c=copy();
  cards.forEach((card,index)=>{
    const topic=topics[index];
    if (!topic || card.dataset.topicSlug) return;
    const label=localizedTopicName(topic);
    card.dataset.topicSlug=topic.slug;
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label',`${label} · ${fmt(c.count,{count:topic.count})}`);
    const title=card.querySelector('.topic-head b');
    if(title) title.textContent=label;
    const count=card.querySelector('.topic-count');
    if(count) count.textContent=fmt(c.count,{count:topic.count});
    const open=()=>{ location.hash=`#/topic/${topic.slug}`; };
    card.onclick=open;
    card.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();open();} };
  });
}

function statPill(label,value){ return `<div class="topic-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }

function topicSignalCard(signal){
  const regions=focusRegions(signal).slice(0,3);
  return `<article class="radar-card topic-signal-card" data-explore-signal="${esc(signal.id)}"><div class="radar-top"><span class="severity ${scoreClass(signal.score)}">${esc(severityLabel(scoreClass(signal.score)))} · ${signal.score}</span><span class="quality">${esc(sourceClassLabel(signal.source_class))}</span></div><h3>${esc(signal.title)}</h3><p>${esc(signal.why_important || signal.what_happened || '')}</p><div class="tags">${(signal.categories||[]).slice(0,4).map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}${regions.map(x=>`<span class="tag">${esc(regionLabel(x))}</span>`).join('')}</div></article>`;
}

function renderTopicPage(report,slug){
  const content=document.querySelector('.content');
  if(!content || content.querySelector(`[data-topic-page="${slug}"]`)) return;
  const def=topicDefinition(slug);
  if(!def) return;
  const topic=deriveTopicCards(report.topic_summary || [],report.signals || []).find(x=>x.slug===slug) || def;
  const all=topicSignals(report.signals || [],slug).sort((a,b)=>b.score-a.score);
  const visible=applyQuickSeverityFilter(all,currentQuickSeverities());
  const breakdown=topicBreakdown(visible,slug,scoreClass,focusRegions);
  const c=copy();
  const regionText=breakdown.regions.slice(0,4).map(([region,count])=>`${regionLabel(region)} ${count}`).join(' · ') || '—';
  const sourceText=breakdown.sources.slice(0,4).map(([source,count])=>`${sourceClassLabel(source)} ${count}`).join(' · ') || '—';
  const importance=`${severityLabel('critical')} ${breakdown.severity.critical} · ${severityLabel('important')} ${breakdown.severity.important} · ${severityLabel('emerging')} ${breakdown.severity.emerging}`;
  const footer=content.querySelector('.footer')?.outerHTML || '';
  content.innerHTML=`<div class="topic-detail" data-topic-page="${esc(slug)}"><button class="pill-btn topic-back">${esc(c.topicBack)}</button><div class="topic-detail-hero" style="--accent:${esc(topic.color)}"><div class="topic-detail-icon">${esc(topic.icon)}</div><div><div class="eyeline">${esc(c.topicSignals)}</div><h1>${esc(localizedTopicName(topic))}</h1><p>${esc(c.topicDescription)}</p><small>${esc(fmt(c.quickFiltered,{shown:visible.length,total:all.length}))}</small></div></div><div class="topic-stats">${statPill(c.total,String(visible.length))}${statPill(c.importance,importance)}${statPill(c.regions,regionText)}${statPill(c.sources,sourceText)}</div><div class="radar-grid topic-results">${visible.map(topicSignalCard).join('') || `<div class="card empty">${esc(c.empty)}</div>`}</div></div>${footer}`;
  content.querySelector('.topic-back').onclick=()=>{location.hash='#/today';};
  content.querySelectorAll('[data-explore-signal]').forEach(card=>card.onclick=()=>{location.hash=`#/signal/${card.dataset.exploreSignal}`;});
}

function applyPendingRegion(){
  if(!location.hash.startsWith('#/radar')) return;
  const pending=sessionStorage.getItem('sharbo:pending-region');
  const select=document.querySelector('#regionFilter');
  if(!pending || !select || ![...select.options].some(x=>x.value===pending)) return;
  sessionStorage.removeItem('sharbo:pending-region');
  if(select.value===pending) return;
  select.value=pending;
  select.dispatchEvent(new Event('change',{bubbles:true}));
}

async function enhance(){
  const report=await localizedReport();
  const match=(location.hash || '#/today').match(/^#\/topic\/([^/?]+)/);
  if(match){ renderTopicPage(report,decodeURIComponent(match[1])); return; }
  if((location.hash || '#/today').startsWith('#/today')){
    renderFocusDistribution(report);
    enhanceTopicCards(report);
  }
  applyPendingRegion();
}

function schedule(){
  if(scheduled) return;
  scheduled=true;
  queueMicrotask(async()=>{scheduled=false;try{await enhance();}catch(error){console.warn('[exploration]',error);}});
}

new MutationObserver(schedule).observe(document.querySelector('#app'),{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('popstate',schedule);
schedule();
