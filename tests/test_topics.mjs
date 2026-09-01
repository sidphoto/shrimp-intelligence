import assert from 'node:assert/strict';
import { deriveTopicCards, matchesTopic, topicSignals } from '../topic_catalog.js';

const signals = [
  {
    id:'oil', score:88, source_class:'CONFIRMED',
    title:"Trump says Exxon is going in to Venezuela as US pushes oil deals",
    categories:['economy','markets','finance'],
    what_happened:'U.S. oil companies are planning business in Venezuela.'
  },
  {
    id:'ai', score:89, source_class:'CONFIRMED',
    title:'Global central bankers glimpse dystopian AI future at Jackson Hole',
    categories:['economy','markets','finance'],
    what_happened:'Federal Reserve officials discussed artificial intelligence risks.'
  },
  {
    id:'chip', score:82, source_class:'PRIMARY',
    title:'TSMC expands advanced semiconductor capacity',
    categories:['technology','semiconductor'],
    what_happened:'Taiwan chip capacity expansion continues.'
  }
];

assert.equal(topicSignals(signals,'world-news').length,3);
assert.equal(matchesTopic(signals[0],'energy-commodities'),true,'oil story should match energy');
assert.equal(matchesTopic(signals[0],'geopolitics'),true,'Venezuela/US story should match geopolitics');
assert.equal(matchesTopic(signals[1],'ai-models'),true,'AI story should match AI topic even if canonical categories are economic');
assert.equal(matchesTopic(signals[2],'tech-semiconductor'),true);
assert.equal(matchesTopic(signals[2],'taiwan'),true);

const staleSummary = [
  {en:'Geopolitics',zh:'地緣政治',count:0,icon:'🏛️',color:'#000'},
  {en:'Energy & Commodities',zh:'能源與原物料',count:0,icon:'💧',color:'#000'}
];
const cards = deriveTopicCards(staleSummary,signals);
assert.ok(cards.find(x=>x.slug==='geopolitics').count > 0,'derived count must override stale summary count');
assert.ok(cards.find(x=>x.slug==='energy-commodities').count > 0,'energy count must be derived from signal content');

console.log('topic drilldown tests passed');
