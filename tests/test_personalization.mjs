import assert from 'node:assert/strict';
import { effectiveRegions, matchesPersonalPrefs, personalizedSignals } from '../personalization.js';

const prefs = {
  topics: ['ai', 'semiconductor'],
  regions: ['taiwan', 'japan'],
  minScore: 80
};

const japanAI = {
  id: 'jp-ai',
  title: 'Japan outlines AI semiconductor strategy',
  score: 88,
  categories: ['ai', 'semiconductor'],
  regions: ['global']
};

const usAI = {
  id: 'us-ai',
  title: 'US AI investment accelerates',
  score: 92,
  categories: ['ai'],
  regions: ['us']
};

const japanFinance = {
  id: 'jp-finance',
  title: 'Bank of Japan signals policy shift',
  score: 90,
  categories: ['finance'],
  regions: ['global']
};

const lowScore = {
  id: 'low',
  title: 'Taiwan AI update',
  score: 72,
  categories: ['ai'],
  regions: ['taiwan']
};

assert.ok(effectiveRegions(japanAI).includes('japan'), 'Japan should be inferred from title');
assert.equal(matchesPersonalPrefs(japanAI, prefs), true, 'topic + region + score should match');
assert.equal(matchesPersonalPrefs(usAI, prefs), false, 'topic match alone must not pass region gate');
assert.equal(matchesPersonalPrefs(japanFinance, prefs), false, 'region match alone must not pass topic gate');
assert.equal(matchesPersonalPrefs(lowScore, prefs), false, 'score gate must be enforced');

const ranked = personalizedSignals([usAI, japanFinance, lowScore, japanAI], prefs);
assert.deepEqual(ranked.map(x => x.id), ['jp-ai']);

const noRegionLimit = {...prefs, regions: []};
assert.equal(matchesPersonalPrefs(usAI, noRegionLimit), true, 'empty region selection means no region restriction');

const noTopicLimit = {...prefs, topics: []};
assert.equal(matchesPersonalPrefs(japanFinance, noTopicLimit), true, 'empty topic selection means no topic restriction');

console.log('personal radar matching: PASS');
