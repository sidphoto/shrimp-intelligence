export const QUICK_SEVERITIES = ['critical', 'important', 'emerging'];

export function severityForScore(score){
  const value = Number(score || 0);
  if (value >= 95) return 'critical';
  if (value >= 85) return 'important';
  return 'emerging';
}

export function normalizeQuickSeverities(value){
  if (!Array.isArray(value)) return [...QUICK_SEVERITIES];
  return QUICK_SEVERITIES.filter(item => value.includes(item));
}

export function toggleQuickSeverity(selected, severity){
  const current = normalizeQuickSeverities(selected);
  if (!QUICK_SEVERITIES.includes(severity)) return current;
  if (current.includes(severity)) return current.filter(item => item !== severity);
  return QUICK_SEVERITIES.filter(item => item === severity || current.includes(item));
}

export function quickAllowsSignal(signal, selected){
  return normalizeQuickSeverities(selected).includes(severityForScore(signal?.score));
}

export function applyQuickSeverityFilter(signals, selected){
  return (signals || []).filter(signal => quickAllowsSignal(signal, selected));
}

export function quickSeverityMode(selected){
  const current = normalizeQuickSeverities(selected);
  if (current.length === QUICK_SEVERITIES.length) return 'all';
  if (current.length === 1) return current[0];
  return 'custom';
}
