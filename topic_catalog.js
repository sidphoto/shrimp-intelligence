const textOf = signal => [
  signal?.title,
  signal?.what_happened,
  signal?.why_important,
  signal?.source_label
].filter(Boolean).join(' ');

export const TOPIC_DEFINITIONS = [
  {slug:'world-news',en:'World News',zh:'全球要聞',icon:'🌐',color:'#2f86dd',categories:[],patterns:[],all:true},
  {slug:'geopolitics',en:'Geopolitics',zh:'地緣政治',icon:'🏛️',color:'#ef6b6a',categories:['politics','policy','geopolitics','defense','security','military','trade'],patterns:[/geopolit/i,/sanction/i,/tariff/i,/trade barrier/i,/war\b/i,/strike\b/i,/military/i,/iran/i,/israel/i,/venezuela/i,/g20/i,/trump/i,/中國|美國|伊朗|以色列|委內瑞拉|制裁|關稅|軍事|戰爭/]},
  {slug:'economy-markets',en:'Economy & Markets',zh:'經濟與市場',icon:'📈',color:'#2ea66f',categories:['economy','markets','finance','trade'],patterns:[/market/i,/econom/i,/inflation/i,/interest rate/i,/central bank/i,/federal reserve/i,/\bfed\b/i,/currency/i,/yen/i,/經濟|市場|金融|利率|央行|通膨|匯率|日圓/]},
  {slug:'ai-models',en:'AI Models',zh:'AI 模型',icon:'🧠',color:'#8f68d8',categories:['ai','ai-model','models'],patterns:[/artificial intelligence/i,/\bAI\b/,/OpenAI/i,/Anthropic/i,/Gemini/i,/人工智慧|生成式 AI|模型/]},
  {slug:'dev-open-source',en:'Dev & Open Source',zh:'開發與開源',icon:'⌘',color:'#7d72d9',categories:['agent','developer','github','open-source'],patterns:[/github/i,/open.?source/i,/developer/i,/coding/i,/agentic/i,/開源|開發者|程式|Agent/]},
  {slug:'tech-semiconductor',en:'Tech & Semiconductor',zh:'科技與半導體',icon:'💾',color:'#2a9bb0',categories:['technology','semiconductor','ai-infrastructure'],patterns:[/semiconductor/i,/chip\b/i,/nvidia/i,/tsmc/i,/data cent(?:er|re)/i,/technology/i,/半導體|晶片|台積電|資料中心|科技/]},
  {slug:'supply-chain',en:'Supply Chain',zh:'產業與供應鏈',icon:'🏭',color:'#e38a2a',categories:['industry','supply-chain','logistics'],patterns:[/supply chain/i,/manufactur/i,/factory/i,/logistics/i,/shipping/i,/rare earth/i,/供應鏈|製造|工廠|物流|航運|稀土/]},
  {slug:'energy-commodities',en:'Energy & Commodities',zh:'能源與原物料',icon:'💧',color:'#ed9a35',categories:['energy','commodities','raw-materials'],patterns:[/\boil\b/i,/crude/i,/brent/i,/natural gas/i,/\bLNG\b/i,/opec/i,/commodity/i,/gold/i,/rare earth/i,/原油|石油|天然氣|能源|黃金|原物料|稀土/]},
  {slug:'science-climate',en:'Science & Climate',zh:'科學與氣候',icon:'🧪',color:'#67a65b',categories:['science','research','climate','biotech','space'],patterns:[/research/i,/science/i,/climate/i,/biotech/i,/space/i,/nasa/i,/科學|研究|氣候|生技|太空/]},
  {slug:'business-transform',en:'Business Transform',zh:'商業變革',icon:'🏢',color:'#d65b98',categories:['business','automation','productivity'],patterns:[/business/i,/enterprise/i,/acquisition/i,/merger/i,/productivity/i,/automation/i,/\bCEO\b/i,/deal\b/i,/企業|商業|併購|自動化|生產力/]},
  {slug:'society',en:'Society',zh:'社會趨勢',icon:'👥',color:'#3c86d7',categories:['society','demographics','labor','health','education','migration'],patterns:[/society/i,/population/i,/demograph/i,/labor/i,/employment/i,/migration/i,/health/i,/education/i,/社會|人口|勞動|就業|移民|健康|教育/]},
  {slug:'taiwan',en:'Taiwan',zh:'台灣相關',icon:'🇹🇼',color:'#22a8bc',categories:['taiwan'],patterns:[/\btaiwan\b/i,/taipei/i,/tsmc/i,/台灣|臺灣|台北|臺北|台積電/]}
];

const BY_SLUG = new Map(TOPIC_DEFINITIONS.map(x => [x.slug, x]));
const BY_EN = new Map(TOPIC_DEFINITIONS.map(x => [x.en.toLowerCase(), x]));

export function topicDefinition(slug){ return BY_SLUG.get(slug) || null; }
export function topicSlug(topic){
  if (!topic) return null;
  if (topic.slug && BY_SLUG.has(topic.slug)) return topic.slug;
  return BY_EN.get(String(topic.en || '').trim().toLowerCase())?.slug || null;
}
export function matchesTopic(signal, slug){
  const def = topicDefinition(slug);
  if (!def || !signal) return false;
  if (def.all) return true;
  const categories = Array.isArray(signal.categories) ? signal.categories : [];
  if (categories.some(category => def.categories.includes(category))) return true;
  const text = textOf(signal);
  return def.patterns.some(pattern => pattern.test(text));
}
export function topicSignals(signals, slug){ return (signals || []).filter(signal => matchesTopic(signal, slug)); }
export function deriveTopicCards(summary, signals){
  const summaryBySlug = new Map();
  for (const topic of summary || []) {
    const slug = topicSlug(topic);
    if (slug) summaryBySlug.set(slug, topic);
  }
  return TOPIC_DEFINITIONS.map(def => {
    const source = summaryBySlug.get(def.slug) || {};
    return {...def,...source,slug:def.slug,en:def.en,zh:def.zh,icon:source.icon||def.icon,color:source.color||def.color,count:topicSignals(signals,def.slug).length};
  });
}
export function topicBreakdown(signals, slug, classifySeverity, effectiveRegions){
  const matched = topicSignals(signals, slug);
  const severity = {critical:0,important:0,emerging:0};
  const regions = new Map();
  const sources = new Map();
  for (const signal of matched) {
    const level = classifySeverity(signal.score);
    if (Object.hasOwn(severity, level)) severity[level] += 1;
    for (const region of effectiveRegions(signal)) regions.set(region,(regions.get(region)||0)+1);
    const source = signal.source_class || 'UNVERIFIED';
    sources.set(source,(sources.get(source)||0)+1);
  }
  const rank = map => [...map.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
  return {total:matched.length,severity,regions:rank(regions),sources:rank(sources)};
}
