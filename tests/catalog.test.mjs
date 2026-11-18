import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subjects,questions} from '../server/catalog.mjs';

test('retained original practice remains complete alongside sourced additions',()=>{
  const practice=questions.filter(q=>!q.provenance);
  assert.equal(subjects.length,6);assert.equal(practice.length,100);
  assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
  for(const subject of subjects.filter(s=>s.id!=='architecture'))assert.equal(practice.filter(q=>q.subject===subject.id).length,20);
  for(const question of questions){
    assert.ok(subjects.some(s=>s.id===question.subject));
    assert.ok(question.topic&&question.title&&question.prompt);
    if(question.provenance?.kind==='imported-collection'){
      assert.ok(question.answer.length&&question.answer.every(p=>p.trim()),question.id+' must preserve its supplied answer');
    }else{
      assert.ok(question.answer.length>=2,question.id+' needs detailed reasoning');
      assert.ok(question.answer.join(' ').split(/\s+/).length>=80);
      assert.ok(question.pitfalls.length&&question.followups.length);
    }
    assert.equal(new URL(question.sourceUrl).protocol,'https:');
  }
  assert.ok(questions.filter(q=>q.code).length>=45);
});

test('candidate entries have direct provenance, subtopics and independently written detailed answers',()=>{
  const reported=questions.filter(q=>q.provenance?.kind==='candidate-reported');
  assert.ok(reported.length>0,'Candidate-reported entries must be available in the catalog');
  const budgets=new Map();
  for(const q of reported){
    assert.ok(q.subtopic&&q.subtopic.trim());
    assert.equal(new URL(q.provenance.url).hostname,'www.linkedin.com');
    assert.ok(new URL(q.provenance.url).pathname.startsWith('/posts/'));
    assert.ok(q.provenance.author&&q.provenance.title&&q.provenance.note);
    assert.ok(['reported-question','reported-topic'].includes(q.provenance.scope));
    assert.match(q.provenance.accessedAt,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!q.provenance.note.toLowerCase().includes('independently verified interview'));
    assert.ok(!new URL(q.sourceUrl).hostname.endsWith('linkedin.com'));
    const count=(q.title+' '+q.prompt).split(/\s+/).length;
    budgets.set(q.provenance.url,(budgets.get(q.provenance.url)||0)+count);
  }
  for(const [url,count] of budgets)assert.ok(count<=200,`${url}: ${count} derived question words exceeds the source budget`);
});
