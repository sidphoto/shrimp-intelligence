export const SUPPORTED_LOCALES = ['zh-TW', 'en', 'vi-VN'];
export const DEFAULT_LOCALE = 'zh-TW';

const dictionaries = new Map();
let activeLocale = DEFAULT_LOCALE;

const localeAliases = new Map([
  ['zh', 'zh-TW'],
  ['zh-tw', 'zh-TW'],
  ['zh-hant', 'zh-TW'],
  ['zh-hant-tw', 'zh-TW'],
  ['en', 'en'],
  ['en-us', 'en'],
  ['en-gb', 'en'],
  ['vi', 'vi-VN'],
  ['vi-vn', 'vi-VN']
]);

const LOCALIZABLE_SIGNAL_FIELDS = new Set([
  'title',
  'what_happened',
  'why_now',
  'why_important',
  'winners_losers',
  'taiwan_impact',
  'what_next',
  'emerging_reason',
  'quality_note'
]);

export function normalizeLocale(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (SUPPORTED_LOCALES.includes(raw)) return raw;
  return localeAliases.get(raw.toLowerCase()) || null;
}

export function resolveLocale(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

async function loadDictionary(locale) {
  if (dictionaries.has(locale)) return dictionaries.get(locale);
  const response = await fetch(`./locales/${locale}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load locale ${locale}`);
  const dictionary = await response.json();
  dictionaries.set(locale, dictionary);
  return dictionary;
}

export async function initI18n(locale) {
  const normalized = resolveLocale(locale);
  await loadDictionary(DEFAULT_LOCALE);
  if (normalized !== DEFAULT_LOCALE) await loadDictionary(normalized);
  activeLocale = normalized;
  updateDocumentLanguage();
  return activeLocale;
}

export async function setLocale(locale) {
  const normalized = resolveLocale(locale);
  if (normalized !== DEFAULT_LOCALE) await loadDictionary(normalized);
  activeLocale = normalized;
  updateDocumentLanguage();
  return activeLocale;
}

export function getLocale() {
  return activeLocale;
}

function lookup(object, path) {
  return String(path).split('.').reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    return undefined;
  }, object);
}

function interpolate(value, params) {
  return String(value).replace(/\{([^}]+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`;
  });
}

export function t(path, params = {}) {
  const current = dictionaries.get(activeLocale) || {};
  const fallback = dictionaries.get(DEFAULT_LOCALE) || {};
  const value = lookup(current, path) ?? lookup(fallback, path) ?? path;
  return typeof value === 'string' ? interpolate(value, params) : value;
}

export function updateDocumentLanguage() {
  document.documentElement.lang = activeLocale;
  const title = t('meta.title');
  const description = t('meta.description');
  if (title && title !== 'meta.title') document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && description && description !== 'meta.description') meta.setAttribute('content', description);
}

export function persistLocaleInUrl(locale) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', locale);
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function parseTaipeiDate(value) {
  if (!value) return null;
  let raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw = `${raw}T00:00:00+08:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) raw = `${raw.replace(' ', 'T')}:00+08:00`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = parseTaipeiDate(value);
  if (!date) return value || '—';
  return new Intl.DateTimeFormat(activeLocale, {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: activeLocale === 'en' ? 'short' : '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatDateTime(value) {
  const date = parseTaipeiDate(value);
  if (!date) return value || '—';
  return new Intl.DateTimeFormat(activeLocale, {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: activeLocale === 'en' ? 'short' : '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: activeLocale === 'en'
  }).format(date);
}

export function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(activeLocale, options).format(number);
}

export function sourceClassLabel(value) {
  return t(`source.${value}`) || value;
}

export function severityLabel(value) {
  return t(`severity.${value}`) || value;
}

export function categoryLabel(value) {
  const translated = t(`category.${value}`);
  return translated === `category.${value}` ? value : translated;
}

export function regionLabel(value) {
  const translated = t(`region.${value}`);
  return translated === `region.${value}` ? value : translated;
}

export function marketName(value) {
  const translated = t(`market.${value}`);
  return translated === `market.${value}` ? value : translated;
}

export function topicName(topic) {
  if (!topic) return '';
  const translated = t(`topics.${topic.en}`);
  if (translated !== `topics.${topic.en}`) return translated;
  if (activeLocale === 'en') return topic.en || topic.zh || '';
  return topic.zh || topic.en || '';
}

async function fetchOptionalJSON(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadLocalizedOverlay(locale, reportDate) {
  const normalized = resolveLocale(locale);
  if (normalized === DEFAULT_LOCALE) return null;
  if (reportDate) {
    const dated = await fetchOptionalJSON(`./data/localized/${normalized}/${reportDate}.json`);
    if (dated) return dated;
  }
  return fetchOptionalJSON(`./data/localized/${normalized}/latest.json`);
}

export function applyLocalizedOverlay(baseReport, overlay) {
  const report = structuredClone(baseReport);
  if (!overlay || typeof overlay !== 'object') return report;

  if (typeof overlay.world_summary === 'string') report.world_summary = overlay.world_summary;

  const localizedSignals = overlay.signals;
  if (localizedSignals && typeof localizedSignals === 'object' && !Array.isArray(localizedSignals)) {
    const byId = new Map(report.signals.map(signal => [signal.id, signal]));
    for (const [id, localized] of Object.entries(localizedSignals)) {
      const target = byId.get(id);
      if (!target || !localized || typeof localized !== 'object') continue;
      for (const [field, value] of Object.entries(localized)) {
        if (LOCALIZABLE_SIGNAL_FIELDS.has(field) && typeof value === 'string') target[field] = value;
      }
    }
  }

  if (Array.isArray(overlay.taiwan_radar) && overlay.taiwan_radar.every(item => typeof item === 'string')) {
    report.taiwan_radar = [...overlay.taiwan_radar];
  }

  return report;
}
