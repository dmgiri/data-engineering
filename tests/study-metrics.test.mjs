import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studyMetrics} from '../src/study-metrics.mjs';

const data={progress:{sessions:[
  {date:'2026-11-12',subject:'sql',minutes:30},
  {date:'2026-11-18',subject:'python',minutes:45},
  {date:'2026-11-18',subject:'sql',minutes:20},
  {date:'2026-10-01',subject:'sql',minutes:90}
],attempts:[{date:'2026-11-18',questionId:'sql-1'}]},questions:[{id:'sql-1',subject:'sql'}]};

test('activity uses a complete calendar window, sums actual sessions, and does not invent empty-day values',()=>{
  const result=studyMetrics(data,7,'all','2026-11-18');
  assert.equal(result.days.length,7);
  assert.equal(result.days[0].date,'2026-11-12');
  assert.equal(result.days.at(-1).minutes,65);
  assert.equal(result.minutes,95);assert.equal(result.activeDays,2);assert.equal(result.attempts,1);
  assert.equal(result.days.filter(d=>d.minutes===0).length,5);
});

test('subject filter applies consistently to time, activity days, and practice attempts',()=>{
  const result=studyMetrics(data,30,'python','2026-11-18');
  assert.equal(result.minutes,45);assert.equal(result.activeDays,1);assert.equal(result.attempts,0);
  assert.equal(result.days.length,30);
});

test('an empty record remains genuinely zero',()=>{
  const result=studyMetrics({progress:{sessions:[],attempts:[]},questions:[]},7,'all','2026-11-18');
  assert.equal(result.minutes,0);assert.ok(result.days.every(d=>d.minutes===0));
});
