import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  applyLocalizedOverlay,
  categoryLabel,
  formatDate,
  formatDateTime,
  getLocale,
  initI18n,
  loadLocalizedOverlay,
  marketName,
  persistLocaleInUrl,
  regionLabel,
  resolveLocale,
  setLocale as activateLocale,
  severityLabel,
  sourceClassLabel,
  t,
  topicName
} from './i18n.js';
import { REGION_CATALOG, effectiveRegions, personalizedSignals } from './personalization.js';
import {
  QUICK_SEVERITIES,
  applyQuickSeverityFilter,
  normalizeQuickSeverities,
  quickAllowsSignal,
  quickSeverityMode
} from './quick_filters.js';

const app = document.querySelector('#app');
const initialLocale = resolveLocale(
  new URLSearchParams(location.search).get('lang'),
  localStorage.getItem('sharbo:locale'),
  navigator.language,
  DEFAULT_LOCALE
);

function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{return fallback} }
function save(key,val){ localStorage.setItem(key, JSON.stringify(val)); }

const state = {
  baseReport: null,
  report: null,
  index: null,
  locale: initialLocale,
  localizedContentAvailable: initialLocale === DEFAULT_LOCALE,
  route: location.hash || '#/today',
  filters: { q:'', category:'all', region:'all', emerging:false },
  quickSeverities: normalizeQuickSeverities(loadJSON('sharbo:quick-severities', QUICK_SEVERITIES)),
  prefs: loadJSON('shrimp:prefs', { topics:['geopolitics','economy','ai','semiconductor','business','taiwan'], regions:['taiwan','us','china','japan'], minScore:75 }),
  bookmarks: loadJSON('shrimp:bookmarks', []),
  theme: localStorage.getItem('shrimp:theme') || 'light',
  archiveDigests: {},
  archiveLoading: null
};

document.documentElement.dataset.theme = state.theme === 'night' ? 'night' : '';

function esc(s=''){return String(s).replace(/[&<>"'`]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[m]))}
function route(path){ location.hash = path; }
function currentView(){ return (location.hash || '#/today').replace('#/','').split('/')[0] || 'today'; }
function signalById(id){ return state.report?.signals.find(x=>x.id===id); }
function scoreClass(s){ return s>=95?'critical':s>=85?'important':'emerging'; }
function formatTime(s){ return s ? formatDateTime(s) : t('common.unavailable'); }
function quickSignals(signals){ return applyQuickSeverityFilter(signals, state.quickSeverities); }
function quickCount(){ return quickSignals(state.report?.signals || []).length; }
function allQuickSelected(){ return state.quickSeverities.length === QUICK_SEVERITIES.length; }

async function applyCurrentLocale(){
  const overlay = await loadLocalizedOverlay(state.locale, state.baseReport?.date);
  state.localizedContentAvailable = state.locale === DEFAULT_LOCALE || Boolean(overlay);
  state.report = applyLocalizedOverlay(state.baseReport, overlay);
}

async function changeLocale(locale){
  const normalized = resolveLocale(locale);
  await activateLocale(normalized);
  state.locale = normalized;
  localStorage.setItem('sharbo:locale', normalized);
  persistLocaleInUrl(normalized);
  await applyCurrentLocale();
  render();
}

async function boot(){
  try{
    await initI18n(state.locale);
    state.locale = getLocale();
    const [report,index] = await Promise.all([
      fetch('./data/latest.json',{cache:'no-store'}).then(r=>r.json()),
      fetch('./data/index.json',{cache:'no-store'}).then(r=>r.json())
    ]);
    state.baseReport = report;
    state.index = index;
    await applyCurrentLocale();
    render();
  }catch(err){
    app.innerHTML=`<main class="content"><div class="card card-pad"><h1>${esc(t('common.loadingErrorTitle'))}</h1><p>${esc(err.message)}</p><p>${esc(t('common.loadingErrorHelp'))}</p></div></main>`;
  }
}

window.addEventListener('hashchange',()=>{state.route=location.hash;render();scrollTo(0,0)});

function uiIcon(name, className = ''){
  const paths={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9z"/>',
    trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    business:'<path d="M3 21V10l6 3V9l6 4V8l6 4v9z"/><path d="M7 17h2M13 17h2M19 17h2"/>',
    radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>',
    archive:'<path d="M4 6h16v14H4z"/><path d="M3 4h18v3H3zM8 11h8M8 15h6"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9S9.5 5.7 12 3z"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.9-3.1 3.4-4.8 7.5-4.8s6.6 1.7 7.5 4.8"/>',
    bookmark:'<path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21z"/>'
  };
  return `<svg class="ui-icon ${esc(className)}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.radar}</svg>`;
}

function navItems(){return[
  ['today','home','nav.today'],
  ['radar','globe','nav.radar'],
  ['emerging','trend','nav.emerging'],
  ['business','business','nav.business'],
  ['my-radar','radar','nav.myRadar'],
  ['archive','archive','nav.archive']
]}

function localeOptions(){
  return SUPPORTED_LOCALES.map(locale=>`<option value="${locale}" ${state.locale===locale?'selected':''}>${esc(t(`language.${locale}`))}</option>`).join('');
}

function layout(content){
  const view=currentView();
  const r=state.report;
  const fallback = state.locale !== DEFAULT_LOCALE && !state.localizedContentAvailable
    ? `<span class="locale-fallback">${esc(t('common.sourceFallback'))}</span>`
    : '';
  const totalSignals = r.signals?.length || 0;
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">🦐</div><div><strong>SharBo Globo</strong><small>${esc(t('brand.subtitle'))}</small></div></div>
    <nav class="nav">${navItems().map(([id,ic,key])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><span class="nav-icon">${uiIcon(ic)}</span><span>${esc(t(key))}</span></button>`).join('')}</nav>
    <div class="sidebar-section">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h4>${esc(t('quick.title'))}</h4><button class="pill-btn" data-sev-all style="padding:4px 8px;font-size:10px">${esc(t('quick.all'))}</button></div>
      <div class="quick-filter">
        ${QUICK_SEVERITIES.map(v=>`<label class="checkline"><input type="checkbox" data-sev="${v}" ${state.quickSeverities.includes(v)?'checked':''}><span class="dot ${v}"></span>${esc(severityLabel(v))}</label>`).join('')}
      </div>
      <div class="sub" style="margin-top:8px">${esc(t('quick.showing',{shown:quickCount(),total:totalSignals}))}</div>
    </div>
    <div class="window-card"><b>${esc(t('window.title'))}</b>${esc(r.window.start)}<br>→ ${esc(r.window.end)}<br><span style="color:var(--good)">${esc(t('window.verified',{value:r.quality.window_verified?t('common.yes'):t('common.no')}))}</span></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="top-meta"><div class="date">${uiIcon('calendar')}<span>${esc(formatDate(r.date))}</span></div><div class="data-window">${esc(t('window.dataWindow',{start:r.window.start,end:r.window.end}))}</div>${fallback}</div><div class="top-actions"><label class="locale-control"><span class="sr-only">${esc(t('language.label'))}</span>${uiIcon('language')}<select id="localeSelect" aria-label="${esc(t('language.label'))}">${localeOptions()}</select></label><button class="icon-btn" id="themeToggle" aria-label="Theme">${uiIcon(state.theme==='night'?'sun':'moon')}</button><button class="pill-btn" data-route="#/my-radar">${uiIcon('user')}<span>${esc(t('nav.myRadar'))}</span></button></div></header>
    <div class="content" data-home-dashboard-layout="v3">${content}<footer class="footer">${esc(t('footer.disclaimer'))}</footer></div>
  </main>
  <nav class="mobile-nav">${navItems().slice(0,5).map(([id,ic,key])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><b>${uiIcon(ic)}</b>${esc(t(key))}</button>`).join('')}</nav>`
}

function toggleQuickSeverity(severity){
  state.quickSeverities = state.quickSeverities.includes(severity)
    ? state.quickSeverities.filter(x=>x!==severity)
    : QUICK_SEVERITIES.filter(x=>x===severity || state.quickSeverities.includes(x));
  save('sharbo:quick-severities', state.quickSeverities);
  render();
}

function setQuickSeverityMode(mode){
  if(mode==='all') state.quickSeverities=[...QUICK_SEVERITIES];
  else if(QUICK_SEVERITIES.includes(mode)) state.quickSeverities=[mode];
  save('sharbo:quick-severities', state.quickSeverities);
  render();
}

function bindCommon(){
  document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>route(el.dataset.route.replace('#','')));
  const theme=document.querySelector('#themeToggle');
  if(theme) theme.onclick=()=>{state.theme=state.theme==='night'?'light':'night';localStorage.setItem('shrimp:theme',state.theme);document.documentElement.dataset.theme=state.theme==='night'?'night':'';render()};
  const locale=document.querySelector('#localeSelect');
  if(locale) locale.onchange=()=>changeLocale(locale.value);
  document.querySelectorAll('[data-sev]').forEach(el=>el.onchange=()=>toggleQuickSeverity(el.dataset.sev));
  document.querySelectorAll('[data-sev-all]').forEach(el=>el.onclick=()=>setQuickSeverityMode('all'));
  document.querySelectorAll('[data-signal]').forEach(el=>{
    el.onclick=()=>route(`/signal/${el.dataset.signal}`);
    if(el.getAttribute('role')==='button') el.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click()}};
  });
  document.querySelectorAll('[data-bookmark]').forEach(el=>el.onclick=(e)=>{e.stopPropagation();const id=el.dataset.bookmark;state.bookmarks=state.bookmarks.includes(id)?state.bookmarks.filter(x=>x!==id):[...state.bookmarks,id];save('shrimp:bookmarks',state.bookmarks);render()});
}

function sparkline(vals){
  const w=120,h=30,p=2,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const pts=vals.map((v,i)=>`${p+i*(w-p*2)/(vals.length-1)},${h-p-(v-min)*(h-p*2)/range}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--blue)" stroke-width="1.6" points="${pts}"/></svg>`
}

function topSignals(r){
  const byId=new Map(r.signals.map(s=>[s.id,s]));
  const ranked=(r.top5_ids||[]).map(id=>byId.get(id)).filter(Boolean);
  return ranked.length===5?ranked:r.signals.slice().sort((a,b)=>b.score-a.score).slice(0,5);
}

function taiwanSignals(r){
  return (r.signals||[]).filter(signal=>Array.isArray(signal.regions) && signal.regions.includes('taiwan'));
}

function taiwanIcon(item=''){
  const text=String(item).toLowerCase();
  if(/投資|產業|供應|貿易|投資|investment|supply|trade/.test(text)) return uiIcon('business','taiwan-row-icon-svg');
  if(/匯率|利率|金融|市場|currency|rate|market|finance/.test(text)) return uiIcon('trend','taiwan-row-icon-svg');
  return uiIcon('radar','taiwan-row-icon-svg');
}

function todaySummary(r){
  const focusCount=topSignals(r).length;
  const emergingCount=(r.emerging_signals||[]).length;
  const taiwanCount=taiwanSignals(r).length;
  const verified=r.quality?.window_verified ? t('common.yes') : t('common.no');
  return `<section class="card card-pad daily-summary" aria-labelledby="today-summary-title">
    <div class="section-title"><div><h2 id="today-summary-title">${esc(t('todaySummary.title'))}</h2><span class="sub">${esc(t('todaySummary.subtitle'))}</span></div><time class="summary-date" datetime="${esc(r.date||'')}">${esc(formatDate(r.date))}</time></div>
    <dl class="summary-metrics">
      <div class="summary-metric"><dt>${esc(t('todaySummary.signals'))}</dt><dd>${esc(r.signals?.length||0)}</dd></div>
      <div class="summary-metric"><dt>${esc(t('todaySummary.focus'))}</dt><dd>${esc(focusCount)}</dd></div>
      <div class="summary-metric"><dt>${esc(t('todaySummary.emerging'))}</dt><dd>${esc(emergingCount)}</dd></div>
      <div class="summary-metric"><dt>${esc(t('todaySummary.quality'))}</dt><dd>${esc(r.quality?.grade||t('common.unavailable'))}</dd></div>
    </dl>
    <div class="summary-meta">
      <div><span>${esc(t('todaySummary.taiwan'))}</span><b>${esc(t('todaySummary.count',{count:taiwanCount}))}</b></div>
      <div><span>${esc(t('todaySummary.window'))}</span><b>${esc(verified)}</b></div>
    </div>
  </section>`;
}

function taiwanRadar(r){
  const items=r.taiwan_radar||[];
  return `<section class="card card-pad today-panel taiwan-panel" aria-labelledby="taiwan-radar-title">
    <div class="section-title"><div><h2 id="taiwan-radar-title">${esc(t('taiwan.title'))}</h2><span class="sub">${esc(t('taiwan.subtitle'))}</span></div><span class="summary-inline"><b>${esc(taiwanSignals(r).length)}</b> ${esc(t('common.signals'))}</span></div>
    <div class="taiwan-radar-layout"><div class="taiwan-visual" aria-hidden="true"><svg viewBox="0 0 160 160" fill="none"><circle cx="80" cy="80" r="58"/><circle cx="80" cy="80" r="39"/><circle cx="80" cy="80" r="20"/><path d="M80 22v116M22 80h116M39 39l82 82M121 39 39 121"/><path class="taiwan-sweep" d="M80 80 126 45"/><circle class="taiwan-pulse" cx="80" cy="80" r="6"/></svg><span>${esc(t('taiwan.title'))}</span></div><div class="taiwan-list">${items.map((item,index)=>`<div class="taiwan-row"><span class="taiwan-index">${String(index+1).padStart(2,'0')}</span><span class="taiwan-row-icon">${taiwanIcon(item)}</span><p>${esc(item)}</p></div>`).join('')||`<div class="empty">${esc(t('todaySummary.noTaiwan'))}</div>`}</div></div>
  </section>`;
}

function personalRadarSummary(personal){
  const topicCounts=new Map();
  personal.forEach(signal=>{
    (signal.categories||[]).filter(category=>state.prefs.topics.includes(category)).forEach(category=>topicCounts.set(category,(topicCounts.get(category)||0)+1));
  });
  const topics=[...topicCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4);
  const focus=personal[0];
  return `<section class="card card-pad today-panel my-radar-panel" aria-labelledby="my-radar-summary-title">
    <div class="section-title"><div><h2 id="my-radar-summary-title">${esc(t('myRadar.title'))}</h2><span class="sub">${esc(t('myRadar.summary'))}</span></div><button class="pill-btn" data-route="#/my-radar">${esc(t('common.viewAll'))}</button></div>
    <p class="personal-summary-lead"><strong>${esc(personal.length)}</strong> ${esc(t('todaySummary.matches'))}</p>
    <div class="personal-summary-stats">${topics.map(([category,count])=>`<div><span>${esc(categoryLabel(category))}</span><b>${esc(count)}</b></div>`).join('')||`<div class="empty">${esc(t('myRadar.empty'))}</div>`}</div>
    ${focus?`<div class="personal-summary-focus"><span>${esc(t('todaySummary.focusLabel'))}</span><button data-signal="${esc(focus.id)}">${esc(focus.title)} <span aria-hidden="true">→</span></button></div>`:''}
  </section>`;
}

function heroStatusLabel(severity){
  return t(`hero.${severity}`) || severityLabel(severity);
}

function heroStatusCount(r,severity){
  if(severity==='emerging') return r.emerging_signals?.length || 0;
  return r.counts?.[severity] ?? r.signals.filter(s=>scoreClass(s.score)===severity).length;
}

function today(){
  const r=state.report;
  const top=quickSignals(topSignals(r));
  const personal=quickSignals(personalSignals());
  const focus=quickSignals(r.signals).sort((a,b)=>b.score-a.score)[0];
  const topics=r.topic_summary||[];
  return layout(`<div class="grid hero-grid">
    <section class="card hero"><div class="hero-copy"><div class="eyeline">${esc(t('hero.eyeline'))}</div><h1>${esc(t('hero.title'))}</h1><div class="summary">${esc(r.world_summary)}</div><div class="status-row">${QUICK_SEVERITIES.map(v=>`<div class="status" style="opacity:${state.quickSeverities.includes(v)?1:.4}"><span class="dot ${v}"></span><b>${heroStatusCount(r,v)}</b> ${esc(heroStatusLabel(v))}</div>`).join('')}</div></div><div class="watercolor-map" aria-label="${esc(t('hero.mapAria'))}"><i class="route r1"></i><i class="route r2"></i><i class="pin p1"></i><i class="pin p2"></i><i class="pin p3"></i><i class="pin p4"></i></div></section>
    ${todaySummary(r)}
  </div>
  <section class="card today-panel top5-panel"><div class="card-pad" style="padding-bottom:8px"><div class="section-title"><h2>${esc(t('top5.title'))}</h2><button class="pill-btn" data-route="#/radar">${esc(t('common.viewAll'))}</button></div></div><div class="signal-list">${top.map((s,i)=>signalRow(s,i+1)).join('')||`<div class="empty">${esc(t('quick.empty'))}</div>`}</div></section>
  <section class="grid home-grid insight-grid">
    <section class="card card-pad today-panel"><div class="section-title"><h2>${esc(t('emerging.title'))}</h2><span class="sub">${esc(t('emerging.subtitle'))}</span></div><div class="emerging-list">${(r.emerging_signals||[]).map(x=>`<div class="emerging-row"><div class="signal-icon">${esc(x.icon)}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.label||x.reason||'')}</small></div>${sparkline(x.series||[0,0])}<div class="trend">▲ ${x.change||0}%</div></div>`).join('')}</div></section>
    <section class="card card-pad today-panel"><div class="section-title"><h2>${esc(t('impact.title'))}</h2><span class="sub">${esc(t('impact.subtitle'))}</span></div>${impactChain(r.impact_chain||[])}</section>
  </section>
  <section class="grid home-grid context-grid">
    ${taiwanRadar(r)}
    <section class="card card-pad today-panel market-panel">${marketView(r.market||[])}</section>
  </section>
  <section class="card card-pad today-panel focus-panel">${focusStory(focus)}</section>
  ${personalRadarSummary(personal)}
  <section class="topics-block"><div class="section-title"><h2>${esc(t('topics.title'))}</h2></div><section class="grid topic-grid">${topics.map(topicCard).join('')}</section></section>`)
}

function signalRow(s,rank){return `<div class="signal-row" role="button" tabindex="0" aria-label="${esc(s.title)}" data-signal="${s.id}"><div class="rank">${String(rank).padStart(2,'0')}</div><div class="score" style="color:${s.score>=95?'var(--critical)':s.score>=85?'var(--important)':'var(--emerging)'}">${s.score}</div><div class="signal-main"><h3>${esc(s.title)}</h3><div class="tags">${s.categories.map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}</div></div><div class="signal-meta">${esc(s.source_label)}<br>${esc(formatTime(s.observed_at))}</div><span class="signal-open-hint">${esc(t('top5.open'))} →</span></div>`}
function personalSignalRow(s,rank){const regions=effectiveRegions(s).filter(x=>state.prefs.regions.includes(x));return `<div class="signal-row" data-signal="${s.id}"><div class="rank">${rank}</div><div class="score" style="color:${s.score>=95?'var(--critical)':s.score>=85?'var(--important)':'var(--emerging)'}">${s.score}</div><div class="signal-main"><h3>${esc(s.title)}</h3><div class="tags">${s.categories.filter(x=>state.prefs.topics.includes(x)).slice(0,3).map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}${regions.slice(0,3).map(x=>`<span class="tag">${esc(regionLabel(x))}</span>`).join('')}</div></div><div class="signal-meta">${esc(s.source_label)}<br>${esc(formatTime(s.observed_at))}</div></div>`}
function impactChain(chain){return `<div class="impact-chain">${chain.map((x,i)=>`${i?'<span class="arrow">→</span>':''}<div class="impact-node"><div class="bubble">${esc(x.icon)}</div>${esc(x.label)}</div>`).join('')}</div>`}
function topicCard(topic){return `<article class="topic-card" style="--accent:${topic.color}"><div class="topic-head"><div class="topic-icon">${esc(topic.icon)}</div><div><b>${esc(topicName(topic))}</b></div></div><div class="topic-count">${esc(t('topics.count',{count:topic.count}))}</div></article>`}
function focusStory(s){
  if(!s)return `<div class="section-title"><h2>${esc(t('focus.title'))}</h2></div><div class="empty">${esc(t('quick.empty'))}</div>`;
  return `<div class="section-title"><div><h2>${esc(t('focus.title'))}</h2><span class="sub">${esc(t('focus.subtitle'))}</span></div><span class="quality">${esc(sourceClassLabel(s.source_class))} · ${esc(t('focus.windowVerified'))}</span></div><div class="focus-story"><div class="story-art" aria-hidden="true"><span class="story-art-kicker">${esc(t('focus.eyeline'))}</span><i></i><i></i><i></i></div><div class="story-body"><div class="focus-kicker"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))}</span><span class="focus-score">${esc(s.score)} / 100</span></div><h3>${esc(s.title)}</h3><p class="story-summary">${esc(s.what_happened)}</p><div class="focus-why"><b>${esc(t('focus.whyImportant'))}</b><p>${esc(s.why_important)}</p></div><div class="focus-source"><span>${esc(s.source_label)}</span><time datetime="${esc(s.observed_at||'')}">${esc(formatTime(s.observed_at))}</time></div><button class="pill-btn" data-signal="${s.id}">${esc(t('focus.readFull'))}</button></div></div>`;
}
function marketChange(change=''){
  const raw=String(change||'').trim();
  if(!raw)return '';
  if(raw.startsWith('較前值'))return `${t('market.vsPrevious')} ${raw.slice(3).trim()}`;
  if(raw.startsWith('較開盤'))return `${t('market.vsOpen')} ${raw.slice(3).trim()}`;
  return raw;
}
function marketView(m){
  const captured=state.report.market_meta?.captured_at;
  const subtitle=captured?t('market.asOf',{time:formatDateTime(captured)}):t('market.subtitle');
  return `<div class="section-title"><div><h2>${esc(t('market.title'))}</h2><span class="sub">${esc(subtitle)}</span></div><span class="market-source-note">${esc(t('market.sourceNote'))}</span></div><div class="market-grid">${m.map(x=>`<div class="metric"><small>${esc(marketName(x.name))}</small><b>${esc(x.value)}</b><span class="metric-change ${x.direction==='up'?'up':x.direction==='down'?'down':'flat'}"><i aria-hidden="true">${x.direction==='up'?'▲':x.direction==='down'?'▼':'—'}</i>${esc(marketChange(x.change))}</span></div>`).join('')}</div>`
}

function radar(){
  const vals=filteredSignals();
  const mode=quickSeverityMode(state.quickSeverities);
  return layout(`<div class="page-title"><div><h1>${esc(t('radar.title'))}</h1><p>${esc(t('radar.description'))}</p></div><div>${vals.length} ${esc(t('common.signals'))}</div></div>
  <div class="toolbar"><input id="searchInput" placeholder="${esc(t('radar.searchPlaceholder'))}" value="${esc(state.filters.q)}"><select id="catFilter"><option value="all">${esc(t('radar.allTopics'))}</option>${unique(state.report.signals.flatMap(x=>x.categories)).map(x=>`<option value="${esc(x)}" ${state.filters.category===x?'selected':''}>${esc(categoryLabel(x))}</option>`).join('')}</select><select id="regionFilter"><option value="all">${esc(t('radar.allRegions'))}</option>${REGION_CATALOG.map(x=>`<option value="${esc(x)}" ${state.filters.region===x?'selected':''}>${esc(regionLabel(x))}</option>`).join('')}</select><select id="sevFilter">${mode==='custom'?`<option value="custom" selected disabled>${esc(t('radar.customSeverity'))}</option>`:''}<option value="all" ${mode==='all'?'selected':''}>${esc(t('radar.allSeverity'))}</option>${QUICK_SEVERITIES.map(x=>`<option value="${x}" ${mode===x?'selected':''}>${esc(severityLabel(x))}</option>`).join('')}</select></div>
  <div class="radar-grid">${vals.map(radarCard).join('') || `<div class="card empty">${esc(t('radar.empty'))}</div>`}</div>`)
}
function unique(a){return [...new Set(a)].sort()}
function filteredSignals(){return state.report.signals.filter(s=>{
  const q=state.filters.q.trim().toLowerCase();
  return quickAllowsSignal(s,state.quickSeverities) && (!q || JSON.stringify(s).toLowerCase().includes(q)) && (state.filters.category==='all'||s.categories.includes(state.filters.category)) && (state.filters.region==='all'||effectiveRegions(s).includes(state.filters.region));
}).sort((a,b)=>b.score-a.score)}
function radarCard(s){const marked=state.bookmarks.includes(s.id);return `<article class="radar-card" data-signal="${s.id}"><div class="radar-top"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))} · ${s.score}</span><button class="bookmark" data-bookmark="${s.id}" aria-label="${esc(t('common.bookmark'))}">${marked?'★':'☆'}</button></div><h3>${esc(s.title)}</h3><p>${esc(s.why_important)}</p><div class="tags">${s.categories.map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}${effectiveRegions(s).slice(0,3).map(x=>`<span class="tag">${esc(regionLabel(x))}</span>`).join('')}<span class="tag">${esc(sourceClassLabel(s.source_class))}</span></div></article>`}

function emerging(){const r=state.report;return layout(`<div class="page-title"><div><h1>${esc(t('emerging.title'))}</h1><p>${esc(t('emerging.description'))}</p></div></div><section class="card card-pad"><div class="emerging-list">${(r.emerging_signals||[]).map(x=>`<div class="emerging-row" style="grid-template-columns:50px 1fr minmax(160px,320px) 80px"><div class="signal-icon">${esc(x.icon)}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.reason||x.label||'')}</small></div>${sparkline(x.series||[0,0])}<div class="trend">▲ ${x.change||0}%</div></div>`).join('')}</div></section>`)}
function business(){const cases=state.report.business_cases||[];return layout(`<div class="page-title"><div><h1>${esc(t('business.title'))}</h1><p>${esc(t('business.description'))}</p></div></div><div class="radar-grid">${cases.map(c=>`<article class="radar-card"><div class="radar-top"><span class="tag">${esc(c.category)}</span><span class="quality">${esc(c.evidence)}</span></div><h3>${esc(c.company)}｜${esc(c.title)}</h3><p><b>${esc(t('business.problem'))}：</b>${esc(c.problem)}</p><p><b>${esc(t('business.change'))}：</b>${esc(c.change)}</p><p><b>${esc(t('business.result'))}：</b>${esc(c.result)}</p><p><b>${esc(t('business.lesson'))}：</b>${esc(c.lesson)}</p></article>`).join('')}</div>`)}
function myRadar(){const topicOptions=unique(state.report.signals.flatMap(x=>x.categories));const personal=quickSignals(personalSignals());return layout(`<div class="page-title"><div><h1>${esc(t('myRadar.title'))}</h1><p>${esc(t('myRadar.description'))}</p></div></div><div class="profile-grid"><div class="setting-group"><h3>${esc(t('myRadar.topics'))}</h3><div class="option-grid">${topicOptions.map(x=>`<button class="toggle-chip ${state.prefs.topics.includes(x)?'selected':''}" data-pref-topic="${x}">${esc(categoryLabel(x))}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.regions'))}</h3><div class="option-grid">${REGION_CATALOG.map(x=>`<button class="toggle-chip ${state.prefs.regions.includes(x)?'selected':''}" data-pref-region="${x}">${esc(regionLabel(x))}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.minScore'))}</h3><div class="option-grid">${[70,75,80,85,90].map(x=>`<button class="toggle-chip ${state.prefs.minScore===x?'selected':''}" data-pref-score="${x}">≥ ${x}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.summary'))}</h3>${personal.map(x=>`<div style="padding:8px 0;border-top:1px solid var(--line);font-size:12px" data-signal="${x.id}">• ${esc(x.title)}<div class="tags" style="margin-top:5px">${effectiveRegions(x).filter(r=>state.prefs.regions.includes(r)).slice(0,3).map(r=>`<span class="tag">${esc(regionLabel(r))}</span>`).join('')}</div></div>`).join('')||`<div class="empty">${esc(t('myRadar.empty'))}</div>`}</div></div>`)}
function personalSignals(){return personalizedSignals(state.report.signals,state.prefs)}
function archive(){return layout(`<div class="page-title"><div><h1>${esc(t('archive.title'))}</h1><p>${esc(t('archive.description'))}</p></div></div><div class="archive-list">${state.index.reports.map(x=>`<div class="archive-item" data-route="#/day/${x.date}" style="cursor:pointer"><div><b>${esc(formatDate(x.date))}</b><small>　${esc(x.summary)}</small></div><span>${x.signals} ${esc(t('common.signals'))}</span></div>`).join('')}</div>`)}
function loadArchiveDigest(date){
  if(state.archiveDigests[date] || state.archiveLoading===date) return;
  state.archiveLoading=date;
  fetch(`./data/archive/${date}.json`,{cache:'no-store'})
    .then(r=>{ if(!r.ok) throw new Error('not found'); return r.json(); })
    .then(digest=>{ state.archiveDigests[date]=digest; })
    .catch(()=>{ state.archiveDigests[date]={error:true}; })
    .finally(()=>{ state.archiveLoading=null; render(); });
}
function dayView(date){
  const digest=state.archiveDigests[date];
  const back=`<button class="pill-btn" data-route="#/archive">${esc(t('archive.back'))}</button>`;
  if(!digest){ loadArchiveDigest(date); return layout(`<div class="page-title"><div>${back}<h1 style="margin-top:14px">${esc(formatDate(date))}</h1></div></div><div class="card card-pad">${esc(t('archive.loading'))}</div>`); }
  if(digest.error){ return layout(`<div class="page-title"><div>${back}<h1 style="margin-top:14px">${esc(formatDate(date))}</h1></div></div><div class="card card-pad empty">${esc(t('archive.notFound'))}</div>`); }
  const topics=(digest.topic_summary||[]).filter(x=>x.count>0);
  return layout(`<div class="page-title"><div>${back}<h1 style="margin-top:14px">${esc(formatDate(digest.date))}</h1><p>${esc(digest.world_summary||'')}</p></div></div>
    <section class="card card-pad"><p style="font-size:12px;color:var(--muted)">${esc(t('archive.notice'))}</p></section>
    <section class="card" style="margin-top:16px"><div class="card-pad" style="padding-bottom:8px"><div class="section-title"><h2>${esc(t('archive.topSignals'))}</h2></div></div><div class="signal-list">${(digest.top_signals||[]).map((s,i)=>`<div class="signal-row"><div class="rank">${i+1}</div><div class="score" style="color:${s.score>=95?'var(--critical)':s.score>=85?'var(--important)':'var(--emerging)'}">${s.score}</div><div class="signal-main"><h3>${esc(s.title)}</h3><div class="tags">${(s.categories||[]).map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}</div></div><div class="signal-meta">${esc(sourceClassLabel(s.source_class))}</div></div>`).join('')||`<div class="empty">${esc(t('quick.empty'))}</div>`}</div></section>
    ${digest.impact_chain_title?`<section class="card card-pad" style="margin-top:16px"><div class="section-title"><h2>${esc(t('archive.impactChain'))}</h2></div><p>${esc(digest.impact_chain_title)}</p></section>`:''}
    ${(digest.taiwan_radar||[]).length?`<section class="card card-pad" style="margin-top:16px"><div class="section-title"><h2>${esc(t('archive.taiwanRadar'))}</h2></div>${digest.taiwan_radar.map(x=>`<p>• ${esc(x)}</p>`).join('')}</section>`:''}
    ${(digest.market||[]).length?`<section class="card card-pad" style="margin-top:16px"><div class="section-title"><h2>${esc(t('archive.market'))}</h2></div><div class="market-grid">${digest.market.map(x=>`<div class="metric"><small>${esc(marketName(x.name))}</small><b>${esc(x.value)}</b><span class="${x.direction==='up'?'up':x.direction==='down'?'down':'flat'}">${x.direction==='up'?'▲':x.direction==='down'?'▼':''}</span></div>`).join('')}</div></section>`:''}
    ${topics.length?`<section class="card card-pad" style="margin-top:16px"><div class="section-title"><h2>${esc(t('archive.topics'))}</h2></div><div class="tags">${topics.map(x=>`<span class="tag">${esc(topicName(x))} · ${x.count}</span>`).join('')}</div></section>`:''}`);
}
function signalDetail(id){const s=signalById(id); if(!s)return layout(`<div class="card empty">${esc(t('radar.empty'))}</div>`);return layout(`<div class="page-title"><div><button class="pill-btn" data-route="#/radar">${esc(t('common.backRadar'))}</button><h1 style="margin-top:14px">${esc(s.title)}</h1><p>${s.score} / 100 · ${esc(sourceClassLabel(s.source_class))} · ${esc(formatTime(s.observed_at))}</p></div><button class="bookmark" aria-label="${esc(t('common.bookmark'))}" data-bookmark="${s.id}">${state.bookmarks.includes(s.id)?'★':'☆'}</button></div><div class="detail-layout"><section class="card"><div class="detail-section"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))}</span></div>${[[t('detail.whatHappened'),s.what_happened],[t('detail.whyNow'),s.why_now],[t('detail.whyImportant'),s.why_important],[t('detail.winnersLosers'),s.winners_losers],[t('detail.taiwanImpact'),s.taiwan_impact],[t('detail.whatNext'),s.what_next]].map(([h,p])=>`<div class="detail-section"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}<div class="detail-section"><h3>${esc(t('impact.chain'))}</h3>${impactChain(s.impact_chain||[])}</div></section><aside class="grid"><section class="card card-pad"><div class="section-title"><h2>${esc(t('source.title'))}</h2></div>${s.sources.map(src=>`<div class="source-row"><span class="source-badge">${esc(sourceClassLabel(src.class))}</span><div><b style="font-size:12px">${esc(src.name)}</b><div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(t('source.published'))} ${esc(src.published_at?formatDateTime(src.published_at):t('source.timeUncertain'))}<br>${esc(src.note||'')}</div></div></div>`).join('')}</section><section class="card card-pad"><div class="section-title"><h2>${esc(t('quality.title'))}</h2></div><p style="font-size:12px;color:var(--muted);line-height:1.7">${esc(t('quality.windowVerified'))}: <b>${s.window_verified?esc(t('common.yes')):esc(t('common.no'))}</b><br>${esc(t('quality.sourceClass'))}: <b>${esc(sourceClassLabel(s.source_class))}</b><br>${esc(s.quality_note||'')}</p></section></aside></div>`)}

function render(){ if(!state.report)return; const hash=(location.hash||'#/today').replace('#/',''); const [view,id]=hash.split('/'); let html;
  if(view==='today')html=today(); else if(view==='radar')html=radar(); else if(view==='emerging')html=emerging(); else if(view==='business')html=business(); else if(view==='my-radar')html=myRadar(); else if(view==='archive')html=archive(); else if(view==='day')html=dayView(id); else if(view==='signal')html=signalDetail(id); else html=today();
  app.innerHTML=html; bindCommon(); bindView(view);
}
function bindView(view){
  if(view==='radar'){
    const q=document.querySelector('#searchInput'),c=document.querySelector('#catFilter'),r=document.querySelector('#regionFilter'),s=document.querySelector('#sevFilter');
    q.oninput=()=>{state.filters.q=q.value;render()};
    c.onchange=()=>{state.filters.category=c.value;render()};
    r.onchange=()=>{state.filters.region=r.value;render()};
    s.onchange=()=>setQuickSeverityMode(s.value);
  }
  if(view==='my-radar'){
    document.querySelectorAll('[data-pref-topic]').forEach(el=>el.onclick=()=>togglePref('topics',el.dataset.prefTopic));
    document.querySelectorAll('[data-pref-region]').forEach(el=>el.onclick=()=>togglePref('regions',el.dataset.prefRegion));
    document.querySelectorAll('[data-pref-score]').forEach(el=>el.onclick=()=>{state.prefs.minScore=Number(el.dataset.prefScore);save('shrimp:prefs',state.prefs);render()});
  }
}
function togglePref(key,val){state.prefs[key]=state.prefs[key].includes(val)?state.prefs[key].filter(x=>x!==val):[...state.prefs[key],val];save('shrimp:prefs',state.prefs);render()}

boot();
