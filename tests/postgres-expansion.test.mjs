import {test} from 'node:test';
import assert from 'node:assert/strict';
import {questions} from '../server/catalog.mjs';
import {createDatabase} from '../server/database.mjs';

test('PostgreSQL source expansion adds supported detailed entries beyond the original five',()=>{
  const entries=questions.filter(q=>q.subject==='postgres'&&q.provenance?.kind==='candidate-reported');
  assert.ok(entries.length>5,`Expected additional supported PostgreSQL entries; found ${entries.length}`);
  assert.equal(new Set(entries.map(q=>q.title.trim().toLowerCase())).size,entries.length);
  for(const q of entries){
    assert.ok(q.topic&&q.subtopic&&q.prompt,q.id);
    assert.ok(q.answer.length>=2&&q.answer.join(' ').split(/\s+/).length>=80,q.id);
    assert.ok(q.sourceUrl.startsWith('https://www.postgresql.org/docs/')||q.sourceUrl.startsWith('https://jdbc.postgresql.org/documentation/'),q.id);
    assert.ok(q.provenance.url.startsWith('https://www.linkedin.com/posts/'),q.id);
    assert.ok(['reported-question','reported-topic'].includes(q.provenance.scope),q.id);
  }
});

test('expanded PostgreSQL rows load from SQLite without dropping original source IDs or plan assignments',()=>{
  const database=createDatabase(':memory:');
  try{
    const snapshot=database.bootstrap();
    for(let n=1;n<=5;n++)assert.ok(snapshot.questions.some(q=>q.id===`li-postgres-${String(n).padStart(3,'0')}`));
    assert.equal(snapshot.questions.filter(q=>q.subject==='postgres'&&q.provenance).length,questions.filter(q=>q.subject==='postgres'&&q.provenance).length);
    const assigned=snapshot.plan.flatMap(d=>d.questionIds);
    assert.deepEqual([...assigned].sort(),questions.map(q=>q.id).sort());
    assert.equal(new Set(assigned).size,questions.length);
  }finally{database.close()}
});
