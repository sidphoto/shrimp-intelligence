import assert from 'node:assert/strict';
import {
  QUICK_SEVERITIES,
  applyQuickSeverityFilter,
  normalizeQuickSeverities,
  quickAllowsSignal,
  quickSeverityMode,
  severityForScore,
  toggleQuickSeverity
} from '../quick_filters.js';

assert.equal(severityForScore(97), 'critical');
assert.equal(severityForScore(89), 'important');
assert.equal(severityForScore(70), 'emerging');

assert.deepEqual(normalizeQuickSeverities(null), QUICK_SEVERITIES);
assert.deepEqual(normalizeQuickSeverities(['important', 'bogus']), ['important']);

let selected = [...QUICK_SEVERITIES];
selected = toggleQuickSeverity(selected, 'critical');
assert.deepEqual(selected, ['important', 'emerging']);
assert.equal(quickSeverityMode(selected), 'custom');

selected = toggleQuickSeverity(selected, 'emerging');
assert.deepEqual(selected, ['important']);
assert.equal(quickSeverityMode(selected), 'important');
assert.equal(quickAllowsSignal({score: 89}, selected), true);
assert.equal(quickAllowsSignal({score: 96}, selected), false);

selected = toggleQuickSeverity(selected, 'important');
assert.deepEqual(selected, []);
assert.equal(quickSeverityMode(selected), 'custom');
assert.deepEqual(applyQuickSeverityFilter([{score:99},{score:88},{score:72}], selected), []);

selected = toggleQuickSeverity(selected, 'critical');
assert.deepEqual(selected, ['critical']);
assert.equal(applyQuickSeverityFilter([{score:99},{score:88},{score:72}], selected).length, 1);

console.log('quick filter tests passed');
