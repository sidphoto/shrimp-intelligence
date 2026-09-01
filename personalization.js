export const REGION_CATALOG = [
  'global',
  'taiwan',
  'us',
  'china',
  'japan',
  'vietnam',
  'asia',
  'europe',
  'eu',
  'middle-east'
];

const REGION_PATTERNS = {
  taiwan: [/taiwan\b/i, /台灣|臺灣/, /đài loan/i, /taipei/i, /台北/],
  us: [/\bu\.?s\.?\b/i, /united states/i, /america(?:n)?/i, /美國|美方/, /hoa kỳ/i, /washington/i, /federal reserve/i, /\bfed\b/i],
  china: [/\bchina\b/i, /chinese/i, /中國|北京|中方/, /trung quốc/i, /beijing/i],
  japan: [/\bjapan\b/i, /japanese/i, /日本|東京|日圓|日銀/, /nhật bản/i, /tokyo/i, /bank of japan/i, /\bboj\b/i],
  vietnam: [/\bvietnam\b/i, /vietnamese/i, /越南/, /việt nam/i, /hanoi/i, /河內/],
  asia: [/\basia\b/i, /asian/i, /亞洲|亞太/, /châu á/i, /asia-pacific/i, /apac/i],
  europe: [/\beurope\b/i, /european/i, /歐洲/, /châu âu/i],
  eu: [/european union/i, /歐盟/, /liên minh châu âu/i, /\beu\b/i, /ecb/i],
  'middle-east': [/middle east/i, /中東/, /trung đông/i, /iran/i, /iranian/i, /伊朗/, /israel/i, /以色列/, /gulf/i, /hormuz/i],
};

function searchableText(signal){
  return [
    signal?.title,
    signal?.what_happened,
    signal?.why_now,
    signal?.why_important,
    signal?.taiwan_impact,
    signal?.what_next,
    signal?.source_label
  ].filter(Boolean).join(' ');
}

export function effectiveRegions(signal){
  const regions = new Set(Array.isArray(signal?.regions) ? signal.regions : []);
  const text = searchableText(signal);
  for (const [region, patterns] of Object.entries(REGION_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(text))) regions.add(region);
  }
  if (regions.size === 0) regions.add('global');
  return [...regions];
}

export function matchesPersonalPrefs(signal, prefs){
  if (!signal || !prefs || Number(signal.score || 0) < Number(prefs.minScore || 0)) return false;
  const selectedTopics = Array.isArray(prefs.topics) ? prefs.topics : [];
  const selectedRegions = Array.isArray(prefs.regions) ? prefs.regions : [];
  const topicMatch = selectedTopics.length === 0 || (signal.categories || []).some(x => selectedTopics.includes(x));
  const regions = effectiveRegions(signal);
  const regionMatch = selectedRegions.length === 0 || regions.some(x => selectedRegions.includes(x));
  return topicMatch && regionMatch;
}

export function personalRelevance(signal, prefs){
  const selectedTopics = Array.isArray(prefs?.topics) ? prefs.topics : [];
  const selectedRegions = Array.isArray(prefs?.regions) ? prefs.regions : [];
  const topicHits = (signal?.categories || []).filter(x => selectedTopics.includes(x)).length;
  const regionHits = effectiveRegions(signal).filter(x => selectedRegions.includes(x)).length;
  return Number(signal?.score || 0) + Math.min(8, topicHits * 3) + Math.min(8, regionHits * 4);
}

export function personalizedSignals(signals, prefs){
  return (signals || [])
    .filter(signal => matchesPersonalPrefs(signal, prefs))
    .sort((a, b) => personalRelevance(b, prefs) - personalRelevance(a, prefs) || b.score - a.score);
}
