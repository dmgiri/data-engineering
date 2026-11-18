import {test} from 'node:test';
import assert from 'node:assert/strict';
import {questions,subjects} from '../server/catalog.mjs';
import {createDatabase} from '../server/database.mjs';

test('SQL experience library supplies 100–200 distinct sourced questions with detailed explanations',()=>{
  const sql=questions.filter(q=>q.subject==='sql'&&q.provenance?.kind==='candidate-reported');
  assert.ok(sql.length>=100&&sql.length<=200,`Expected 100–200 sourced SQL entries, found ${sql.length}`);
  assert.equal(new Set(sql.map(q=>q.title.trim().toLowerCase())).size,sql.length,'Duplicate titles must not inflate counts');
  for(const q of sql){assert.ok(q.topic&&q.subtopic&&q.prompt,q.id);assert.ok(q.answer.length>=2,q.id);assert.ok(q.answer.join(' ').split(/\s+/).length>=80,q.id);assert.equal(new URL(q.provenance.url).hostname,'www.linkedin.com');}
});

test('expanded catalog retains original IDs and assigns every real question exactly once',()=>{
  for(const subject of subjects.filter(s=>s.id!=='architecture'))for(let n=1;n<=20;n++)assert.ok(questions.some(q=>q.id===`${subject.id}-${n}`),`Retain ${subject.id}-${n}`);
  for(let n=1;n<=9;n++)assert.ok(questions.some(q=>q.id===`li-sql-${String(n).padStart(3,'0')}`));
  const database=createDatabase(':memory:');
  try{const snapshot=database.bootstrap(),assigned=snapshot.plan.flatMap(d=>d.questionIds);assert.equal(assigned.length,questions.length);assert.equal(new Set(assigned).size,questions.length);assert.deepEqual([...assigned].sort(),questions.map(q=>q.id).sort());assert.equal(snapshot.questions.filter(q=>q.subject==='sql'&&q.provenance).length,questions.filter(q=>q.subject==='sql'&&q.provenance).length);}finally{database.close()}
});

test('the COALESCE comparison labels PostgreSQL casts instead of calling them portable SQL',()=>{
  const example=questions.find(q=>q.id==='li-sql-d003');
  assert.ok(example.code.startsWith('-- PostgreSQL study example;'));
  assert.ok(example.code.includes('-- SQL Server has a separate function:'));
});
