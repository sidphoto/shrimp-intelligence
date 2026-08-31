const app = document.querySelector('#app');
const state = {
  report: null,
  index: null,
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
function formatTime(s){ if(!s) return '—'; return s.replace('T',' ').slice(0,16)+' Taipei'; }

async function boot(){
  try{
    const [report,index] = await Promise.all([
      fetch('./data/latest.json',{cache:'no-store'}).then(r=>r.json()),
      fetch('./data/index.json',{cache:'no-store'}).then(r=>r.json())
    ]);
    state.report=report; state.index=index; render();
  }catch(err){
    app.innerHTML=`<main class="content"><div class="card card-pad"><h1>資料載入失敗</h1><p>${esc(err.message)}</p><p>請使用 HTTP server 或 GitHub Pages 開啟，不要直接以 file:// 雙擊 index.html。</p></div></main>`
  }
}

window.addEventListener('hashchange',()=>{state.route=location.hash;render();scrollTo(0,0)});

function navItems(){return[
  ['today','⌂','今日總覽','Today'],['radar','◎','全球雷達','Radar'],['emerging','↗','新興訊號','Emerging'],['business','▣','商業變革','Business'],['my-radar','◌','我的雷達','My Radar'],['archive','▤','歷史存檔','Archive']
]}

function layout(content){
  const view=currentView();
  const r=state.report;
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">🦐</div><div><strong>Shrimp Intelligence</strong><small>Global Intelligence Radar</small></div></div>
    <nav class="nav">${navItems().map(([id,ic,zh,en])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><span>${ic}</span><span>${zh}<small>${en}</small></span></button>`).join('')}</nav>
    <div class="sidebar-section"><h4>快速篩選</h4><div class="quick-filter">
      ${[['critical','Critical'],['important','Important'],['emerging','Emerging']].map(([v,l])=>`<label class="checkline"><input type="checkbox" data-sev="${v}" ${state.filters.severity==='all'||state.filters.severity===v?'checked':''}><span class="dot ${v}"></span>${l}</label>`).join('')}
    </div></div>
    <div class="window-card"><b>資料視窗（Asia/Taipei）</b>${r.window.start}<br>→ ${r.window.end}<br><span style="color:var(--good)">已驗證：${r.quality.window_verified?'是 ✓':'否'}</span></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="top-meta"><div class="date">📅 ${r.date}</div><div class="data-window">資料視窗：${r.window.start} → ${r.window.end}</div></div><div class="top-actions"><button class="icon-btn" id="themeToggle">${state.theme==='night'?'☀️':'🌙'}</button><button class="pill-btn" data-route="#/my-radar">👤 我的雷達</button></div></header>
    <div class="content">${content}<footer class="footer">Shrimp Intelligence MVP · 情報為輔助判讀，不取代官方公告、專業財務或法律意見。</footer></div>
  </main>
  <nav class="mobile-nav">${navItems().slice(0,5).map(([id,ic,zh])=>`<button data-route="#/${id}" class="${view===id?'active':''}"><b>${ic}</b>${zh}</button>`).join('')}</nav>`
}

function bindCommon(){
  document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>route(el.dataset.route.replace('#','')));
  const theme=document.querySelector('#themeToggle'); if(theme) theme.onclick=()=>{state.theme=state.theme==='night'?'light':'night';localStorage.setItem('shrimp:theme',state.theme);document.documentElement.dataset.theme=state.theme==='night'?'night':'';render()};
  document.querySelectorAll('[data-signal]').forEach(el=>el.onclick=()=>route(`/signal/${el.dataset.signal}`));
  document.querySelectorAll('[data-bookmark]').forEach(el=>el.onclick=(e)=>{e.stopPropagation();const id=el.dataset.bookmark;state.bookmarks=state.bookmarks.includes(id)?state.bookmarks.filter(x=>x!==id):[...state.bookmarks,id];save('shrimp:bookmarks',state.bookmarks);render()});
}

function sparkline(vals){
  const w=120,h=30,p=2,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const pts=vals.map((v,i)=>`${p+i*(w-p*2)/(vals.length-1)},${h-p-(v-min)*(h-p*2)/range}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--blue)" stroke-width="1.6" points="${pts}"/></svg>`
}

function today(){
  const r=state.report, top=r.signals.slice().sort((a,b)=>b.score-a.score).slice(0,5);
  const topics=r.topic_summary;
  return layout(`<div class="grid hero-grid">
    <section class="card hero"><div class="hero-copy"><div class="eyeline">一句話世界總結</div><h1>全球情報雷達</h1><div class="summary">${esc(r.world_summary)}</div><div class="status-row"><div class="status"><span class="dot critical"></span>${r.counts.critical} Critical</div><div class="status"><span class="dot important"></span>${r.counts.important} Important</div><div class="status"><span class="dot emerging"></span>${r.counts.emerging} Emerging</div></div></div><div class="watercolor-map" aria-label="柔和水彩風全球情報示意圖"><i class="route r1"></i><i class="route r2"></i><i class="pin p1"></i><i class="pin p2"></i><i class="pin p3"></i><i class="pin p4"></i></div></section>
    <div class="grid"><section class="card card-pad"><div class="section-title"><h2>新興訊號</h2><span class="sub">過去 7 日異常升溫</span></div><div class="emerging-list">${r.emerging_signals.map(x=>`<div class="emerging-row"><div class="signal-icon">${x.icon}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.label)}</small></div>${sparkline(x.series)}<div class="trend">▲ ${x.change}%</div></div>`).join('')}</div></section>
    <section class="card card-pad"><div class="section-title"><h2>影響鏈</h2><span class="sub">事件連鎖影響</span></div>${impactChain(r.impact_chain)}</section></div>
  </div>
  <section class="card" style="margin-top:16px"><div class="card-pad" style="padding-bottom:8px"><div class="section-title"><h2>全球 Top 5 Signals</h2><button class="pill-btn" data-route="#/radar">查看全部 →</button></div></div><div class="signal-list">${top.map((s,i)=>signalRow(s,i+1)).join('')}</div></section>
  <div class="section-title" style="margin-top:18px"><h2>探索主題</h2></div><section class="grid topic-grid">${topics.map(topicCard).join('')}</section>
  <section class="grid lower-grid" style="margin-top:16px"><div class="card card-pad">${focusStory(r.signals[0])}</div><div class="card card-pad">${marketView(r.market)}</div><div class="card card-pad"><div class="section-title"><h2>台灣雷達</h2><span class="sub">外部風險傳導</span></div>${r.taiwan_radar.map(x=>`<div style="padding:9px 0;border-top:1px solid var(--line);font-size:12px">• ${esc(x)}</div>`).join('')}</div></section>`)
}

function signalRow(s,rank){return `<div class="signal-row" data-signal="${s.id}"><div class="rank">${rank}</div><div class="score" style="color:${s.score>=95?'var(--critical)':s.score>=85?'var(--important)':'var(--emerging)'}">${s.score}</div><div class="signal-main"><h3>${esc(s.title)}</h3><div class="tags">${s.categories.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div></div><div class="signal-meta">${esc(s.source_label)}<br>${formatTime(s.observed_at)}</div></div>`}
function impactChain(chain){return `<div class="impact-chain">${chain.map((x,i)=>`${i?'<span class="arrow">→</span>':''}<div class="impact-node"><div class="bubble">${x.icon}</div>${esc(x.label)}</div>`).join('')}</div>`}
function topicCard(t){return `<article class="topic-card" style="--accent:${t.color}"><div class="topic-head"><div class="topic-icon">${t.icon}</div><div><b>${esc(t.zh)}</b><small>${esc(t.en)}</small></div></div><div class="topic-count">${t.count} signals →</div></article>`}
function focusStory(s){return `<div class="section-title"><h2>今日重點事件</h2><span class="quality">${s.source_class} · Window verified</span></div><div class="focus-story"><div class="story-art"></div><div class="story-body"><span class="severity ${scoreClass(s.score)}">${scoreClass(s.score)}</span><h3>${esc(s.title)}</h3><p>${esc(s.what_happened)}</p><button class="pill-btn" data-signal="${s.id}">閱讀完整分析 →</button></div></div>`}
function marketView(m){return `<div class="section-title"><h2>市場快覽</h2><span class="sub">最近可驗證收盤 / 指標</span></div><div class="market-grid">${m.map(x=>`<div class="metric"><small>${esc(x.name)}</small><b>${esc(x.value)}</b><span class="${x.direction==='up'?'up':'down'}">${x.change}</span></div>`).join('')}</div>`}

function radar(){
  const vals=filteredSignals();
  return layout(`<div class="page-title"><div><h1>全球雷達</h1><p>用主題、地區、重要程度與關鍵字縮小世界。</p></div><div>${vals.length} signals</div></div>
  <div class="toolbar"><input id="searchInput" placeholder="搜尋 OpenAI、Fed、台灣、Hormuz…" value="${esc(state.filters.q)}"><select id="catFilter"><option value="all">全部主題</option>${unique(state.report.signals.flatMap(x=>x.categories)).map(x=>`<option ${state.filters.category===x?'selected':''}>${x}</option>`).join('')}</select><select id="regionFilter"><option value="all">全部地區</option>${unique(state.report.signals.flatMap(x=>x.regions)).map(x=>`<option ${state.filters.region===x?'selected':''}>${x}</option>`).join('')}</select><select id="sevFilter"><option value="all">全部重要度</option><option value="critical" ${state.filters.severity==='critical'?'selected':''}>Critical</option><option value="important" ${state.filters.severity==='important'?'selected':''}>Important</option><option value="emerging" ${state.filters.severity==='emerging'?'selected':''}>Emerging</option></select></div>
  <div class="radar-grid">${vals.map(radarCard).join('') || '<div class="card empty">沒有符合條件的訊號。</div>'}</div>`)
}
function unique(a){return [...new Set(a)].sort()}
function filteredSignals(){return state.report.signals.filter(s=>{
  const q=state.filters.q.trim().toLowerCase();
  return (!q || JSON.stringify(s).toLowerCase().includes(q)) && (state.filters.category==='all'||s.categories.includes(state.filters.category)) && (state.filters.region==='all'||s.regions.includes(state.filters.region)) && (state.filters.severity==='all'||scoreClass(s.score)===state.filters.severity)
}).sort((a,b)=>b.score-a.score)}
function radarCard(s){const marked=state.bookmarks.includes(s.id);return `<article class="radar-card" data-signal="${s.id}"><div class="radar-top"><span class="severity ${scoreClass(s.score)}">${scoreClass(s.score)} · ${s.score}</span><button class="bookmark" data-bookmark="${s.id}" aria-label="收藏">${marked?'★':'☆'}</button></div><h3>${esc(s.title)}</h3><p>${esc(s.why_important)}</p><div class="tags">${s.categories.map(x=>`<span class="tag">${x}</span>`).join('')}<span class="tag">${s.source_class}</span></div></article>`}

function emerging(){const r=state.report;return layout(`<div class="page-title"><div><h1>新興訊號</h1><p>偵測最近數日明顯升溫的議題，不把單篇熱門文章誤判成趨勢。</p></div></div><section class="card card-pad"><div class="emerging-list">${r.emerging_signals.map(x=>`<div class="emerging-row" style="grid-template-columns:50px 1fr minmax(160px,320px) 80px"><div class="signal-icon">${x.icon}</div><div class="emerging-name"><b>${esc(x.name)}</b><small>${esc(x.reason)}</small></div>${sparkline(x.series)}<div class="trend">▲ ${x.change}%</div></div>`).join('')}</div></section>`)}
function business(){const cases=state.report.business_cases;return layout(`<div class="page-title"><div><h1>Business Transformation</h1><p>把新聞抽象成「問題 → 改造 → 結果 → 可轉用的管理原則」。</p></div></div><div class="radar-grid">${cases.map(c=>`<article class="radar-card"><div class="radar-top"><span class="tag">${esc(c.category)}</span><span class="quality">${c.evidence}</span></div><h3>${esc(c.company)}｜${esc(c.title)}</h3><p><b>Problem：</b>${esc(c.problem)}</p><p><b>Change：</b>${esc(c.change)}</p><p><b>Result：</b>${esc(c.result)}</p><p><b>Lesson：</b>${esc(c.lesson)}</p></article>`).join('')}</div>`)}
function myRadar(){const topicOptions=unique(state.report.signals.flatMap(x=>x.categories)), regionOptions=unique(state.report.signals.flatMap(x=>x.regions));return layout(`<div class="page-title"><div><h1>我的雷達</h1><p>設定存在你的瀏覽器 LocalStorage，不登入也能保留。</p></div></div><div class="profile-grid"><div class="setting-group"><h3>關注主題</h3><div class="option-grid">${topicOptions.map(x=>`<button class="toggle-chip ${state.prefs.topics.includes(x)?'selected':''}" data-pref-topic="${x}">${x}</button>`).join('')}</div></div><div class="setting-group"><h3>關注地區</h3><div class="option-grid">${regionOptions.map(x=>`<button class="toggle-chip ${state.prefs.regions.includes(x)?'selected':''}" data-pref-region="${x}">${x}</button>`).join('')}</div></div><div class="setting-group"><h3>最低情報分數</h3><div class="option-grid">${[70,75,80,85,90].map(x=>`<button class="toggle-chip ${state.prefs.minScore===x?'selected':''}" data-pref-score="${x}">≥ ${x}</button>`).join('')}</div></div><div class="setting-group"><h3>我的摘要</h3>${personalSignals().map(x=>`<div style="padding:8px 0;border-top:1px solid var(--line);font-size:12px" data-signal="${x.id}">• ${esc(x.title)}</div>`).join('')||'<div class="empty">目前沒有符合你的雷達設定。</div>'}</div></div>`)}
function personalSignals(){return state.report.signals.filter(s=>s.score>=state.prefs.minScore && (s.categories.some(x=>state.prefs.topics.includes(x))||s.regions.some(x=>state.prefs.regions.includes(x)))).sort((a,b)=>b.score-a.score)}
function archive(){return layout(`<div class="page-title"><div><h1>歷史存檔</h1><p>每日資料窗固定封存，方便回查當時可觀察到的世界，而不是用事後資訊回填。</p></div></div><div class="archive-list">${state.index.reports.map(x=>`<div class="archive-item"><div><b>${x.date}</b><small>　${esc(x.summary)}</small></div><span>${x.signals} signals</span></div>`).join('')}</div>`)}
function signalDetail(id){const s=signalById(id); if(!s)return layout('<div class="card empty">找不到此訊號。</div>');return layout(`<div class="page-title"><div><button class="pill-btn" data-route="#/radar">← 回全球雷達</button><h1 style="margin-top:14px">${esc(s.title)}</h1><p>${s.score} / 100 · ${s.source_class} · ${formatTime(s.observed_at)}</p></div><button class="bookmark" data-bookmark="${s.id}">${state.bookmarks.includes(s.id)?'★':'☆'}</button></div><div class="detail-layout"><section class="card"><div class="detail-section"><span class="severity ${scoreClass(s.score)}">${scoreClass(s.score)}</span></div>${[['What happened',s.what_happened],['Why now',s.why_now],['Why important',s.why_important],['Who wins / loses',s.winners_losers],['Taiwan impact',s.taiwan_impact],['What next',s.what_next]].map(([h,p])=>`<div class="detail-section"><h3>${h}</h3><p>${esc(p)}</p></div>`).join('')}<div class="detail-section"><h3>Impact chain</h3>${impactChain(s.impact_chain)}</div></section><aside class="grid"><section class="card card-pad"><div class="section-title"><h2>來源與驗證</h2></div>${s.sources.map(src=>`<div class="source-row"><span class="source-badge">${src.class}</span><div><b style="font-size:12px">${esc(src.name)}</b><div style="font-size:10px;color:var(--muted);margin-top:3px">Published ${src.published_at||'time uncertain'}<br>${src.note||''}</div></div></div>`).join('')}</section><section class="card card-pad"><div class="section-title"><h2>資料品質</h2></div><p style="font-size:12px;color:var(--muted);line-height:1.7">Window verified: <b>${s.window_verified?'YES':'NO'}</b><br>Source class: <b>${s.source_class}</b><br>${esc(s.quality_note||'')}</p></section></aside></div>`)}

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
