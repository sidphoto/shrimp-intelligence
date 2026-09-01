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

const app = document.querySelector('#app');
const initialLocale = resolveLocale(
  new URLSearchParams(location.search).get('lang'),
  localStorage.getItem('sharbo:locale'),
  navigator.language,
  DEFAULT_LOCALE
);

const state = {
  baseReport: null,
  report: null,
  index: null,
  locale: initialLocale,
  localizedContentAvailable: initialLocale === DEFAULT_LOCALE,
  route: location.hash || '#/today',
  filters: { q:'', category:'all', region:'all', severity:'all', emerging:false },
  prefs: loadJSON('shrimp:prefs', { topics:['geopolitics','economy','ai','semiconductor','business','taiwan'], regions:['global','taiwan','us','china'], minScore:75 }),
  bookmarks: loadJSON('shrimp:bookmarks', []),
  theme: localStorage.getItem('shrimp:theme') || 'light'
};

document.documentElement.dataset.theme = state.theme === 'night' ? 'night' : '';

function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{return fallback} }
function save(key,val){ localStorage.setItem(key, JSON.stringify(val)); }
function esc(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function route(path){ location.hash = path; }
function currentView(){ return (location.hash || '#/today').replace('#/','').split('/')[0] || 'today'; }
function signalById(id){ return state.report?.signals.find(x=>x.id===id); }
function scoreClass(s){ return s>=95?'critical':s>=85?'important':'emerging'; }
function formatTime(s){ return s ? formatDateTime(s) : t('common.unavailable'); }

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

function navItems(){return[
  ['today','⌂','nav.today'],
  ['radar','◎','nav.radar'],
  ['emerging','↗','nav.emerging'],
  ['business','▣','nav.business'],
  ['my-radar','◌','nav.myRadar'],
  ['archive','▤','nav.archive']
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
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">🦐</div><div><strong>SharBo Globo</strong><small>${esc(t('brand.subtitle'))}</small></div></div>
    <nav class="nav">${navItems().map(([id,ic,key])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><span>${ic}</span><span>${esc(t(key))}</span></button>`).join('')}</nav>
    <div class="sidebar-section"><h4>${esc(t('quick.title'))}</h4><div class="quick-filter">
      ${['critical','important','emerging'].map(v=>`<label class="checkline"><input type="checkbox" data-sev="${v}" ${state.filters.severity==='all'||state.filters.severity===v?'checked':''}><span class="dot ${v}"></span>${esc(severityLabel(v))}</label>`).join('')}
    </div></div>
    <div class="window-card"><b>${esc(t('window.title'))}</b>${esc(r.window.start)}<br>→ ${esc(r.window.end)}<br><span style="color:var(--good)">${esc(t('window.verified',{value:r.quality.window_verified?t('common.yes'):t('common.no')}))}</span></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="top-meta"><div class="date">📅 ${esc(formatDate(r.date))}</div><div class="data-window">${esc(t('window.dataWindow',{start:r.window.start,end:r.window.end}))}</div>${fallback}</div><div class="top-actions"><label class="locale-control"><span class="sr-only">${esc(t('language.label'))}</span><span aria-hidden="true">🌐</span><select id="localeSelect" aria-label="${esc(t('language.label'))}">${localeOptions()}</select></label><button class="icon-btn" id="themeToggle" aria-label="Theme">${state.theme==='night'?'☀️':'🌙'}</button><button class="pill-btn" data-route="#/my-radar">👤 ${esc(t('nav.myRadar'))}</button></div></header>
    <div class="content">${content}<footer class="footer">${esc(t('footer.disclaimer'))}</footer></div>
  </main>
  <nav class="mobile-nav">${navItems().slice(0,5).map(([id,ic,key])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><b>${ic}</b>${esc(t(key))}</button>`).join('')}</nav>`
}

function bindCommon(){
  document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>route(el.dataset.route.replace('#','')));
  const theme=document.querySelector('#themeToggle');
  if(theme) theme.onclick=()=>{state.theme=state.theme==='night'?'light':'night';localStorage.setItem('shrimp:theme',state.theme);document.documentElement.dataset.theme=state.theme==='night'?'night':'';render()};
  const locale=document.querySelector('#localeSelect');
  if(locale) locale.onchange=()=>changeLocale(locale.value);
  document.querySelectorAll('[data-sev]').forEach(el=>el.onchange=()=>{state.filters.severity=state.filters.severity===el.dataset.sev?'all':el.dataset.sev;render()});
  document.querySelectorAll('[data-signal]').forEach(el=>el.onclick=()=>route(`/signal/${el.dataset.signal}`));
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

function today(){
  const r=state.report, top=topSignals(r);
  const topics=r.topic_summary||[];
  return layout(`<div class="grid hero-grid">
    <section class="card hero"><div class="hero-copy"><div class="eyeline">${esc(t('hero.eyeline'))}</div><h1>${esc(t('hero.title'))}</h1><div class="summary">${esc(r.world_summary)}</div><div class="status-row"><div class="status"><span class="dot critical"></span>${r.counts.critical} ${esc(severityLabel('critical'))}</div><div class="status"><span class="dot important"></span>${r.counts.important} ${esc(severityLabel('important'))}</div><div class="status"><span class="dot emerging"></span>${r.counts.emerging} ${esc(severityLabel('emerging'))}</div></div></div><div class="watercolor-map" aria-label="${esc(t('hero.mapAria'))}"><i class="route r1"></i><i class="route r2"></i><i class="pin p1"></i><i class="pin p2"></i><i class="pin p3"></i><i class="pin p4"></i></div></section>
    <div class="grid"><section class="card card-pad"><div class="section-title"><h2>${esc(t('emerging.title'))}</h2><span class="sub">${esc(t('emerging.subtitle'))}</span></div><div class="emerging-list">${(r.emerging_signals||[]).map(x=>`<div class="emerging-row"><div class="signal-icon">${x.icon}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.label||x.reason||'')}</small></div>${sparkline(x.series||[0,0])}<div class="trend">▲ ${x.change||0}%</div></div>`).join('')}</div></section>
    <section class="card card-pad"><div class="section-title"><h2>${esc(t('impact.title'))}</h2><span class="sub">${esc(t('impact.subtitle'))}</span></div>${impactChain(r.impact_chain||[])}</section></div>
  </div>
  <section class="card" style="margin-top:16px"><div class="card-pad" style="padding-bottom:8px"><div class="section-title"><h2>${esc(t('top5.title'))}</h2><button class="pill-btn" data-route="#/radar">${esc(t('common.viewAll'))}</button></div></div><div class="signal-list">${top.map((s,i)=>signalRow(s,i+1)).join('')}</div></section>
  <div class="section-title" style="margin-top:18px"><h2>${esc(t('topics.title'))}</h2></div><section class="grid topic-grid">${topics.map(topicCard).join('')}</section>
  <section class="grid lower-grid" style="margin-top:16px"><div class="card card-pad">${focusStory(r.signals[0])}</div><div class="card card-pad">${marketView(r.market||[])}</div><div class="card card-pad"><div class="section-title"><h2>${esc(t('taiwan.title'))}</h2><span class="sub">${esc(t('taiwan.subtitle'))}</span></div>${(r.taiwan_radar||[]).map(x=>`<div style="padding:9px 0;border-top:1px solid var(--line);font-size:12px">• ${esc(x)}</div>`).join('')}</div></section>`)
}

function signalRow(s,rank){return `<div class="signal-row" data-signal="${s.id}"><div class="rank">${rank}</div><div class="score" style="color:${s.score>=95?'var(--critical)':s.score>=85?'var(--important)':'var(--emerging)'}">${s.score}</div><div class="signal-main"><h3>${esc(s.title)}</h3><div class="tags">${s.categories.map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}</div></div><div class="signal-meta">${esc(s.source_label)}<br>${esc(formatTime(s.observed_at))}</div></div>`}
function impactChain(chain){return `<div class="impact-chain">${chain.map((x,i)=>`${i?'<span class="arrow">→</span>':''}<div class="impact-node"><div class="bubble">${x.icon}</div>${esc(x.label)}</div>`).join('')}</div>`}
function topicCard(topic){return `<article class="topic-card" style="--accent:${topic.color}"><div class="topic-head"><div class="topic-icon">${topic.icon}</div><div><b>${esc(topicName(topic))}</b></div></div><div class="topic-count">${esc(t('topics.count',{count:topic.count}))}</div></article>`}
function focusStory(s){if(!s)return `<div class="empty">${esc(t('radar.empty'))}</div>`;return `<div class="section-title"><h2>${esc(t('focus.title'))}</h2><span class="quality">${esc(sourceClassLabel(s.source_class))} · ${esc(t('focus.windowVerified'))}</span></div><div class="focus-story"><div class="story-art"></div><div class="story-body"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))}</span><h3>${esc(s.title)}</h3><p>${esc(s.what_happened)}</p><button class="pill-btn" data-signal="${s.id}">${esc(t('focus.readFull'))}</button></div></div>`}
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
  return `<div class="section-title"><h2>${esc(t('market.title'))}</h2><span class="sub">${esc(subtitle)}</span></div><div class="market-grid">${m.map(x=>`<div class="metric"><small>${esc(marketName(x.name))}</small><b>${esc(x.value)}</b><span class="${x.direction==='up'?'up':x.direction==='down'?'down':'flat'}">${esc(marketChange(x.change))}</span></div>`).join('')}</div>`
}

function radar(){
  const vals=filteredSignals();
  return layout(`<div class="page-title"><div><h1>${esc(t('radar.title'))}</h1><p>${esc(t('radar.description'))}</p></div><div>${vals.length} ${esc(t('common.signals'))}</div></div>
  <div class="toolbar"><input id="searchInput" placeholder="${esc(t('radar.searchPlaceholder'))}" value="${esc(state.filters.q)}"><select id="catFilter"><option value="all">${esc(t('radar.allTopics'))}</option>${unique(state.report.signals.flatMap(x=>x.categories)).map(x=>`<option value="${esc(x)}" ${state.filters.category===x?'selected':''}>${esc(categoryLabel(x))}</option>`).join('')}</select><select id="regionFilter"><option value="all">${esc(t('radar.allRegions'))}</option>${unique(state.report.signals.flatMap(x=>x.regions)).map(x=>`<option value="${esc(x)}" ${state.filters.region===x?'selected':''}>${esc(regionLabel(x))}</option>`).join('')}</select><select id="sevFilter"><option value="all">${esc(t('radar.allSeverity'))}</option>${['critical','important','emerging'].map(x=>`<option value="${x}" ${state.filters.severity===x?'selected':''}>${esc(severityLabel(x))}</option>`).join('')}</select></div>
  <div class="radar-grid">${vals.map(radarCard).join('') || `<div class="card empty">${esc(t('radar.empty'))}</div>`}</div>`)
}
function unique(a){return [...new Set(a)].sort()}
function filteredSignals(){return state.report.signals.filter(s=>{
  const q=state.filters.q.trim().toLowerCase();
  return (!q || JSON.stringify(s).toLowerCase().includes(q)) && (state.filters.category==='all'||s.categories.includes(state.filters.category)) && (state.filters.region==='all'||s.regions.includes(state.filters.region)) && (state.filters.severity==='all'||scoreClass(s.score)===state.filters.severity)
}).sort((a,b)=>b.score-a.score)}
function radarCard(s){const marked=state.bookmarks.includes(s.id);return `<article class="radar-card" data-signal="${s.id}"><div class="radar-top"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))} · ${s.score}</span><button class="bookmark" data-bookmark="${s.id}" aria-label="${esc(t('common.bookmark'))}">${marked?'★':'☆'}</button></div><h3>${esc(s.title)}</h3><p>${esc(s.why_important)}</p><div class="tags">${s.categories.map(x=>`<span class="tag">${esc(categoryLabel(x))}</span>`).join('')}<span class="tag">${esc(sourceClassLabel(s.source_class))}</span></div></article>`}

function emerging(){const r=state.report;return layout(`<div class="page-title"><div><h1>${esc(t('emerging.title'))}</h1><p>${esc(t('emerging.description'))}</p></div></div><section class="card card-pad"><div class="emerging-list">${(r.emerging_signals||[]).map(x=>`<div class="emerging-row" style="grid-template-columns:50px 1fr minmax(160px,320px) 80px"><div class="signal-icon">${x.icon}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.reason||x.label||'')}</small></div>${sparkline(x.series||[0,0])}<div class="trend">▲ ${x.change||0}%</div></div>`).join('')}</div></section>`)}
function business(){const cases=state.report.business_cases||[];return layout(`<div class="page-title"><div><h1>${esc(t('business.title'))}</h1><p>${esc(t('business.description'))}</p></div></div><div class="radar-grid">${cases.map(c=>`<article class="radar-card"><div class="radar-top"><span class="tag">${esc(c.category)}</span><span class="quality">${esc(c.evidence)}</span></div><h3>${esc(c.company)}｜${esc(c.title)}</h3><p><b>${esc(t('business.problem'))}：</b>${esc(c.problem)}</p><p><b>${esc(t('business.change'))}：</b>${esc(c.change)}</p><p><b>${esc(t('business.result'))}：</b>${esc(c.result)}</p><p><b>${esc(t('business.lesson'))}：</b>${esc(c.lesson)}</p></article>`).join('')}</div>`)}
function myRadar(){const topicOptions=unique(state.report.signals.flatMap(x=>x.categories)), regionOptions=unique(state.report.signals.flatMap(x=>x.regions));return layout(`<div class="page-title"><div><h1>${esc(t('myRadar.title'))}</h1><p>${esc(t('myRadar.description'))}</p></div></div><div class="profile-grid"><div class="setting-group"><h3>${esc(t('myRadar.topics'))}</h3><div class="option-grid">${topicOptions.map(x=>`<button class="toggle-chip ${state.prefs.topics.includes(x)?'selected':''}" data-pref-topic="${x}">${esc(categoryLabel(x))}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.regions'))}</h3><div class="option-grid">${regionOptions.map(x=>`<button class="toggle-chip ${state.prefs.regions.includes(x)?'selected':''}" data-pref-region="${x}">${esc(regionLabel(x))}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.minScore'))}</h3><div class="option-grid">${[70,75,80,85,90].map(x=>`<button class="toggle-chip ${state.prefs.minScore===x?'selected':''}" data-pref-score="${x}">≥ ${x}</button>`).join('')}</div></div><div class="setting-group"><h3>${esc(t('myRadar.summary'))}</h3>${personalSignals().map(x=>`<div style="padding:8px 0;border-top:1px solid var(--line);font-size:12px" data-signal="${x.id}">• ${esc(x.title)}</div>`).join('')||`<div class="empty">${esc(t('myRadar.empty'))}</div>`}</div></div>`)}
function personalSignals(){return state.report.signals.filter(s=>s.score>=state.prefs.minScore && (s.categories.some(x=>state.prefs.topics.includes(x))||s.regions.some(x=>state.prefs.regions.includes(x)))).sort((a,b)=>b.score-a.score)}
function archive(){return layout(`<div class="page-title"><div><h1>${esc(t('archive.title'))}</h1><p>${esc(t('archive.description'))}</p></div></div><div class="archive-list">${state.index.reports.map(x=>`<div class="archive-item"><div><b>${esc(formatDate(x.date))}</b><small>　${esc(x.summary)}</small></div><span>${x.signals} ${esc(t('common.signals'))}</span></div>`).join('')}</div>`)}
function signalDetail(id){const s=signalById(id); if(!s)return layout(`<div class="card empty">${esc(t('radar.empty'))}</div>`);return layout(`<div class="page-title"><div><button class="pill-btn" data-route="#/radar">${esc(t('common.backRadar'))}</button><h1 style="margin-top:14px">${esc(s.title)}</h1><p>${s.score} / 100 · ${esc(sourceClassLabel(s.source_class))} · ${esc(formatTime(s.observed_at))}</p></div><button class="bookmark" aria-label="${esc(t('common.bookmark'))}" data-bookmark="${s.id}">${state.bookmarks.includes(s.id)?'★':'☆'}</button></div><div class="detail-layout"><section class="card"><div class="detail-section"><span class="severity ${scoreClass(s.score)}">${esc(severityLabel(scoreClass(s.score)))}</span></div>${[[t('detail.whatHappened'),s.what_happened],[t('detail.whyNow'),s.why_now],[t('detail.whyImportant'),s.why_important],[t('detail.winnersLosers'),s.winners_losers],[t('detail.taiwanImpact'),s.taiwan_impact],[t('detail.whatNext'),s.what_next]].map(([h,p])=>`<div class="detail-section"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}<div class="detail-section"><h3>${esc(t('impact.chain'))}</h3>${impactChain(s.impact_chain||[])}</div></section><aside class="grid"><section class="card card-pad"><div class="section-title"><h2>${esc(t('source.title'))}</h2></div>${s.sources.map(src=>`<div class="source-row"><span class="source-badge">${esc(sourceClassLabel(src.class))}</span><div><b style="font-size:12px">${esc(src.name)}</b><div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(t('source.published'))} ${esc(src.published_at?formatDateTime(src.published_at):t('source.timeUncertain'))}<br>${esc(src.note||'')}</div></div></div>`).join('')}</section><section class="card card-pad"><div class="section-title"><h2>${esc(t('quality.title'))}</h2></div><p style="font-size:12px;color:var(--muted);line-height:1.7">${esc(t('quality.windowVerified'))}: <b>${s.window_verified?esc(t('common.yes')):esc(t('common.no'))}</b><br>${esc(t('quality.sourceClass'))}: <b>${esc(sourceClassLabel(s.source_class))}</b><br>${esc(s.quality_note||'')}</p></section></aside></div>`)}

function render(){ if(!state.report)return; const hash=(location.hash||'#/today').replace('#/',''); const [view,id]=hash.split('/'); let html;
  if(view==='today')html=today(); else if(view==='radar')html=radar(); else if(view==='emerging')html=emerging(); else if(view==='business')html=business(); else if(view==='my-radar')html=myRadar(); else if(view==='archive')html=archive(); else if(view==='signal')html=signalDetail(id); else html=today();
  app.innerHTML=html; bindCommon(); bindView(view);
}
function bindView(view){
  if(view==='radar'){
    const q=document.querySelector('#searchInput'),c=document.querySelector('#catFilter'),r=document.querySelector('#regionFilter'),s=document.querySelector('#sevFilter');
    q.oninput=()=>{state.filters.q=q.value;render()}; c.onchange=()=>{state.filters.category=c.value;render()}; r.onchange=()=>{state.filters.region=r.value;render()}; s.onchange=()=>{state.filters.severity=s.value;render()};
  }
  if(view==='my-radar'){
    document.querySelectorAll('[data-pref-topic]').forEach(el=>el.onclick=()=>togglePref('topics',el.dataset.prefTopic));
    document.querySelectorAll('[data-pref-region]').forEach(el=>el.onclick=()=>togglePref('regions',el.dataset.prefRegion));
    document.querySelectorAll('[data-pref-score]').forEach(el=>el.onclick=()=>{state.prefs.minScore=Number(el.dataset.prefScore);save('shrimp:prefs',state.prefs);render()});
  }
}
function togglePref(key,val){state.prefs[key]=state.prefs[key].includes(val)?state.prefs[key].filter(x=>x!==val):[...state.prefs[key],val];save('shrimp:prefs',state.prefs);render()}

boot();
