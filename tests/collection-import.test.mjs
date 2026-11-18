import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {questions,subjects} from '../server/catalog.mjs';
import {createDatabase} from '../server/database.mjs';

const source=new URL('../server/imports/linkedin-senior-de-622.md',import.meta.url);
const parser=async()=> (await import('../server/import-collection.mjs')).parseCollection;
const sample=[
 '# PostgreSQL: 2 Interview Questions with Detailed Answers',
 '## Part A — Public-Post-Aligned Questions from the Earlier Collection',
 '### PG-001 — How do you inspect a plan?',
 '**Priority:** `P0` · **Topics in publicly accessible LinkedIn posts:** [L01](https://www.linkedin.com/posts/example-activity-123)',
 '**Description — what the interviewer is testing:** Plan interpretation.',
 '### Reference answer','Read the plan before changing indexes.',
 '### Example or implementation','```sql','SELECT 1;',
 '# Architecture: 99 fake questions','### SQL-999 — This is code, not a question','```',
 '> [!question] Senior follow-up','> What would you measure?','^pg-001',
 '## Part B — Advanced Concepts, Applied Cases and Failure Modes',
 '### PG-002 — Which edge cases matter?',
 '**Question type:** Failure modes / testing · **Priority:** P1 · **Topic:** Plan estimates',
 '**Description — what the interviewer tests:** Correctness under skew.',
 '**Detailed reference answer**','Test skew and empty inputs.',
 '**Practical illustration**','```sql','SELECT 2;','```',
 '**Public LinkedIn context:** [Context](https://www.linkedin.com/posts/another-activity-456)',
 '**Provenance:** Original practice, not an employer transcript.',
 '> [!question] Senior follow-up','> How would you verify this?','^pg-002',
 '## Official technical reference','- [PostgreSQL plans](https://www.postgresql.org/docs/current/using-explain.html)'
].join('\n');

test('collection parser preserves short answers and fenced code without interpreting headings as instructions',async()=>{
 const parse=await parser(),rows=parse(sample);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(q=>q.subject),['postgres','postgres']);
 assert.equal(rows[0].id,'collection622-pg-001');
 assert.equal(rows[0].answer[0],'Read the plan before changing indexes.');
 assert.equal(rows[0].code,'SELECT 1;\n# Architecture: 99 fake questions\n### SQL-999 — This is code, not a question');
 assert.equal(rows[0].provenance.sourceId,'PG-001');assert.equal(rows[0].provenance.priority,'P0');
 assert.equal(rows[0].provenance.description,'Plan interpretation.');
 assert.deepEqual(rows[0].followups,['What would you measure?']);
 assert.equal(rows[1].topic,'Plan estimates');assert.equal(rows[1].answer[0],'Test skew and empty inputs.');
 assert.equal(rows[1].provenance.origin,'original-practice');assert.equal(rows[1].code,'SELECT 2;');
 assert.equal(rows[1].sourceUrl,'https://www.postgresql.org/docs/current/using-explain.html');
});

test('malformed collection entries fail explicitly instead of silently dropping answers or duplicate IDs',async()=>{
 const parse=await parser();
 assert.throws(()=>parse(sample.replace('Read the plan before changing indexes.','')),/answer/i);
 assert.throws(()=>parse(sample.replace('### PG-002 —','### PG-001 —')),/duplicate/i);
 assert.throws(()=>parse(sample.replace('### PG-002 —','### UNKNOWN-002 —')),/subject|prefix/i);
 assert.throws(()=>parse(sample+'\n```sql\nSELECT 3;'),/fence/i);
});

test('all 622 supplied question IDs, answers and six subject sections are imported into the catalog',async()=>{
 const parse=await parser(),rows=parse(readFileSync(source,'utf8'));
 assert.equal(rows.length,622);assert.equal(new Set(rows.map(q=>q.id)).size,622);
 assert.deepEqual(Object.fromEntries(['sql','postgres','python','pyspark','databricks','architecture'].map(s=>[s,rows.filter(q=>q.subject===s).length])),{sql:104,postgres:100,python:101,pyspark:106,databricks:107,architecture:104});
 const imported=questions.filter(q=>q.provenance?.kind==='imported-collection');
 assert.equal(imported.length,622);assert.equal(questions.length,875);
 assert.equal(subjects.length,6);assert.ok(subjects.some(s=>s.id==='architecture'));
 for(const row of rows){
   const stored=imported.find(q=>q.id===row.id);assert.ok(stored,row.id);assert.deepEqual(stored.answer,row.answer);
   assert.ok(row.title&&row.topic&&row.subtopic&&row.answer.length&&row.answer.every(p=>p.trim()),row.id);
   assert.ok(row.provenance.rawMarkdown.includes(row.provenance.sourceId),row.id);
   assert.ok(row.followups.length,row.id);assert.ok(row.sourceUrl.startsWith('https://'),row.id);
 }
 assert.match(rows.find(q=>q.id==='collection622-sql-001').code,/DENSE_RANK\(\)/);
 assert.match(rows.find(q=>q.id==='collection622-arch-104').answer[0],/replica.*accidental deletes/i);
});

test('adding the collection twice preserves saved answers and all old user state in a real SQLite file',t=>{
 const folder=mkdtempSync(join(tmpdir(),'study-collection-')),filename=join(folder,'study.sqlite');
 t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const base=questions.filter(q=>q.provenance?.kind!=='imported-collection'),oldSubjects=subjects.filter(s=>s.id!=='architecture');
 let database=createDatabase(filename,{subjects:oldSubjects,questions:base});
 database.updateSettings({name:'Existing learner',startDate:'2026-11-18'});
 database.saveReview({id:'retained-review',date:'2026-11-18',questionId:'sql-1'});
 database.saveSession({id:'retained-session',date:'2026-11-18',subject:'sql',minutes:60});
 database.saveDraft('sql-1','Existing draft');database.toggleBookmark('sql-1');
 const before=database.bootstrap();database.close();
 const raw=new DatabaseSync(filename);raw.prepare('UPDATE questions SET answer=? WHERE id=?').run('["User-edited answer"]','sql-1');raw.close();
 for(let pass=0;pass<2;pass++){
   database=createDatabase(filename,{subjects,questions});
   const after=database.bootstrap();
   assert.equal(after.questions.length,875);assert.deepEqual(after.progress,before.progress);assert.deepEqual(after.settings,before.settings);
   assert.equal(after.questions.find(q=>q.id==='sql-1').answer[0],'User-edited answer');
   assert.ok(base.every(q=>after.questions.some(saved=>saved.id===q.id)));
   assert.equal(after.questions.filter(q=>q.provenance?.kind==='imported-collection').length,622);
   database.close();
 }
});

test('the six-subject thirty-day plan includes every question exactly once, including Architecture',()=>{
 const database=createDatabase(':memory:');
 try{
   const data=database.bootstrap(),assigned=data.plan.flatMap(day=>day.questionIds);
   assert.equal(data.subjects.length,6);assert.equal(data.plan.length,30);
   for(const subject of data.subjects)assert.equal(data.plan.filter(day=>day.subject===subject.id).length,5);
   assert.equal(assigned.length,875);assert.equal(new Set(assigned).size,875);
   assert.deepEqual([...assigned].sort(),data.questions.map(q=>q.id).sort());
 }finally{database.close()}
});
