import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createDatabase } from '../server/database.mjs';
import { createStudyServer } from '../server/index.mjs';

const subjects = ['sql', 'postgres', 'python', 'pyspark', 'databricks'].map(id => ({ id, name: id, short: id, color: '#999999', description: `${id} interview practice` }));
const questions = subjects.flatMap(subject => Array.from({ length: 20 }, (_, index) => ({ id: `${subject.id}-${index + 1}`, subject: subject.id, topic: `Topic ${index % 4}`, title: `Question ${index + 1}`, difficulty: 'Senior', type: 'scenario', minutes: 15, prompt: 'Explain your approach.', answer: ['A meaningful answer.'], code: 'SELECT 1;', language: 'sql', pitfalls: ['A real pitfall.'], followups: ['What changes at scale?'], sourceUrl: 'https://example.com/docs' })));
const materials=[{id:'guide',title:'Thirty-day guide',description:'Fixture guide',source:{document:'fixture.md',hash:'fixture-hash'},days:[
  {id:'guide-day-01',day:1,title:'First day',group:'SQL',sections:[
    {id:'guide-day-01-briefing',title:'Day briefing',markdown:'Start here.',order:0},
    {id:'guide-day-01-section-01',title:'Joins',markdown:'Study joins.',order:1}
  ]}
],resources:[{id:'guide-resource-01',title:'Reference',markdown:'Reference notes.',order:0}]}];
const catalog = { subjects, questions, materials };

function databaseFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'study-database-'));
  const filename = join(directory, 'study.sqlite');
  const database = createDatabase(filename, catalog);
  t.after(() => { database.close(); rmSync(directory, { recursive: true, force: true }); });
  return { database, directory, filename };
}

test('catalog answers come from SQLite and records survive reopening', t => {
  const { database, filename } = databaseFixture(t);
  database.updateSettings({ name: 'Alex', startDate: '2026-11-16' });
  database.saveSession({ id: 'session-1', date: '2026-11-16', subject: 'sql', minutes: 45, note: 'Window functions' });
  database.saveDraft('sql-1', 'My draft');
  database.toggleBookmark('sql-1');
  database.close();
  const raw = new DatabaseSync(filename);
  raw.prepare('UPDATE questions SET answer = ? WHERE id = ?').run(JSON.stringify(['Answer persisted in SQLite']), 'sql-1');
  raw.close();
  const reopened = createDatabase(filename, catalog);
  try {
    const snapshot = reopened.bootstrap();
    assert.deepEqual(snapshot.questions[0].answer, ['Answer persisted in SQLite']);
    assert.equal(snapshot.settings.name, 'Alex');
    assert.equal(snapshot.progress.sessions[0].minutes, 45);
    assert.equal(snapshot.progress.drafts['sql-1'], 'My draft');
    assert.deepEqual(snapshot.progress.bookmarks, ['sql-1']);
    assert.equal(snapshot.database, '.data/study.sqlite');
  } finally { reopened.close(); }
});

test('study material content and tracking persist independently across reopen and catalog reseed',t=>{
  const {database,filename}=databaseFixture(t);
  const initial=database.bootstrap();
  assert.equal(initial.materials.length,1);
  assert.equal(initial.materials[0].days[0].sections.length,2);
  assert.deepEqual(initial.progress.materialSections,[]);
  assert.equal(initial.progress.materialState,null);
  database.saveMaterialProgress('guide-day-01-section-01',true);
  database.saveMaterialState({materialId:'guide',day:1,sectionId:'guide-day-01-section-01'});
  database.close();
  const reopened=createDatabase(filename,catalog);
  try{
    const snapshot=reopened.bootstrap();
    assert.equal(snapshot.progress.materialSections.length,1);
    assert.equal(snapshot.progress.materialSections[0].sectionId,'guide-day-01-section-01');
    assert.equal(snapshot.progress.materialSections[0].completed,true);
    assert.equal(snapshot.progress.materialState.sectionId,'guide-day-01-section-01');
    reopened.saveMaterialProgress('guide-day-01-section-01',false);
    assert.deepEqual(reopened.bootstrap().progress.materialSections,[]);
    assert.throws(()=>reopened.saveMaterialProgress('missing',true),error=>error.status===400);
    assert.throws(()=>reopened.saveMaterialState({materialId:'guide',day:1,sectionId:'missing'}),error=>error.status===400);
  }finally{reopened.close()}
});

test('material progress participates in new backups while legacy backups preserve current material state',t=>{
  const {database}=databaseFixture(t);
  database.saveMaterialProgress('guide-day-01-briefing',true);
  database.saveMaterialState({materialId:'guide',day:1,sectionId:'guide-day-01-briefing'});
  const backup=database.exportBackup();
  assert.equal(backup.version,1);
  assert.equal(backup.progress.materialSections.length,1);
  database.saveMaterialProgress('guide-day-01-section-01',true);
  database.saveMaterialState({materialId:'guide',day:1,sectionId:'guide-day-01-section-01'});
  assert.deepEqual(database.importBackup(backup).progress.materialSections,backup.progress.materialSections);
  assert.equal(database.bootstrap().progress.materialState.sectionId,'guide-day-01-briefing');
  const legacy=structuredClone(backup);
  delete legacy.progress.materialSections;
  delete legacy.progress.materialState;
  database.saveMaterialProgress('guide-day-01-section-01',true);
  database.saveMaterialState({materialId:'guide',day:1,sectionId:'guide-day-01-section-01'});
  const restored=database.importBackup(legacy);
  assert.equal(restored.progress.materialSections.length,2);
  assert.equal(restored.progress.materialState.sectionId,'guide-day-01-section-01');
  const invalid=structuredClone(backup);
  invalid.progress.materialSections=[{sectionId:'missing',completed:true,updatedAt:new Date().toISOString()}];
  assert.throws(()=>database.importBackup(invalid),error=>error.status===400);
  assert.equal(database.bootstrap().progress.materialSections.length,2);
});

test('notes persist text, safe links and local images while legacy backups preserve current notes',t=>{
  const {database,filename}=databaseFixture(t);
  const note={
    id:'note-one',title:'Window function notes',createdAt:'2026-11-18T08:00:00.000Z',
    blocks:[
      {id:'block-text',type:'text',text:'ROW_NUMBER needs a deterministic tie breaker.'},
      {id:'block-link',type:'link',label:'PostgreSQL window docs',url:'https://www.postgresql.org/docs/current/tutorial-window.html'},
      {id:'block-image',type:'image',name:'plan.png',alt:'Window execution sketch',dataUrl:'data:image/png;base64,iVBORw0KGgo='}
    ]
  };
  const saved=database.saveNote(note);
  assert.equal(saved.notes.length,1);
  assert.deepEqual(saved.notes[0].blocks,note.blocks);
  assert.equal(saved.notes[0].createdAt,note.createdAt);
  assert.ok(Date.parse(saved.notes[0].updatedAt));
  assert.throws(()=>database.saveNote({...note,id:'bad-link',blocks:[{id:'bad',type:'link',label:'Unsafe',url:'javascript:alert(1)'}]}),error=>error.status===400);
  assert.throws(()=>database.saveNote({...note,id:'bad-image',blocks:[{id:'bad',type:'image',name:'vector.svg',alt:'Unsafe',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}]}),error=>error.status===400);
  assert.equal(database.bootstrap().notes.length,1,'invalid notes must not alter saved notes');
  const backup=database.exportBackup();
  assert.equal(backup.notes.length,1);
  database.saveNote({...note,id:'note-two',title:'Temporary'});
  assert.deepEqual(database.importBackup(backup).notes.map(item=>item.id),['note-one']);
  const legacy=structuredClone(backup);delete legacy.notes;
  database.saveNote({...note,id:'note-two',title:'Keep during legacy restore'});
  assert.equal(database.importBackup(legacy).notes.length,2);
  database.close();
  const reopened=createDatabase(filename,catalog);
  try{
    assert.equal(reopened.bootstrap().notes.length,2);
    assert.equal(reopened.deleteNote('note-one').notes.length,1);
    assert.throws(()=>reopened.deleteNote('missing-note'),error=>error.status===400);
  }finally{reopened.close()}
});

test('note sections organize pages, persist collapse state, validate tables and delete atomically',t=>{
  const {database,filename}=databaseFixture(t);
  const initial=database.bootstrap();
  assert.deepEqual(initial.noteSections.map(section=>section.title),['My Notes']);
  assert.equal(initial.noteSections[0].color,'#7c4dff');
  const section={id:'section-sql',title:'SQL',color:'#0a84ff',collapsed:false,order:1,createdAt:'2026-11-18T08:00:00.000Z'};
  database.saveNoteSection(section);
  const page={
    id:'page-window',sectionId:'section-sql',order:0,title:'Window functions',createdAt:'2026-11-18T08:05:00.000Z',
    blocks:[{id:'table-one',type:'table',rows:[['Function','Use'],['ROW_NUMBER','Deduplicate']]}]
  };
  const saved=database.saveNote(page);
  assert.equal(saved.notes[0].sectionId,'section-sql');
  assert.equal(saved.notes[0].order,0);
  assert.deepEqual(saved.notes[0].blocks[0].rows,page.blocks[0].rows);
  database.saveNoteSection({...section,title:'SQL interview',color:'#ff4d67',collapsed:true});
  const recolored=database.bootstrap().noteSections.find(item=>item.id==='section-sql');
  assert.equal(recolored.collapsed,true);
  assert.equal(recolored.color,'#ff4d67');
  assert.throws(()=>database.saveNoteSection({...section,color:'#123456'}),error=>error.status===400);
  const count=database.bootstrap().notes.length;
  assert.throws(()=>database.saveNote({...page,id:'unknown-section',sectionId:'missing'}),error=>error.status===400);
  assert.throws(()=>database.saveNote({...page,id:'bad-table',blocks:[{id:'bad',type:'table',rows:[['a'],['b','c']]}]}),error=>error.status===400);
  assert.equal(database.bootstrap().notes.length,count,'invalid page writes must be atomic');
  const backup=database.exportBackup();
  assert.equal(backup.noteSections.some(item=>item.id==='section-sql'),true);
  assert.equal(backup.notes.find(item=>item.id==='page-window').sectionId,'section-sql');
  database.close();
  const reopened=createDatabase(filename,catalog);
  try{
    assert.equal(reopened.bootstrap().noteSections.find(item=>item.id==='section-sql').color,'#ff4d67');
    const afterDelete=reopened.deleteNoteSection('section-sql');
    assert.equal(afterDelete.noteSections.some(item=>item.id==='section-sql'),false);
    assert.equal(afterDelete.notes.some(item=>item.id==='page-window'),false);
    assert.throws(()=>reopened.deleteNoteSection('section-default'),error=>error.status===400);
  }finally{reopened.close()}
});

test('legacy note backups without sections restore pages into the default section',t=>{
  const {database}=databaseFixture(t);
  const backup=database.exportBackup();
  delete backup.noteSections;
  backup.notes=[{id:'legacy-page',title:'Legacy page',createdAt:'2026-11-18T08:00:00.000Z',updatedAt:'2026-11-18T08:00:00.000Z',blocks:[{id:'legacy-text',type:'text',text:'Keep this.'}]}];
  const restored=database.importBackup(backup);
  assert.equal(restored.notes[0].sectionId,'section-default');
  assert.equal(restored.noteSections[0].title,'My Notes');
});

test('plan covers all questions once over 30 days with six days per subject and real daily totals', t => {
  const { database } = databaseFixture(t);
  database.updateSettings({ startDate: '2026-11-16', weekdayMinutes: 60, weekendMinutes: 150 });
  database.saveSession({ id: 'one', date: '2026-11-16', subject: 'sql', minutes: 25 });
  database.saveSession({ id: 'two', date: '2026-11-16', subject: 'python', minutes: 30 });
  database.saveAttempt({ id: 'attempt-1', date: '2026-11-16', questionId: 'sql-1', rating: 'again', answer: 'Working answer' });
  const { plan, daily } = database.bootstrap();
  assert.equal(plan.length, 30);
  assert.equal(plan[0].date, '2026-11-16');
  assert.equal(plan[29].date, '2026-12-15');
  assert.equal(plan[5].minutes, 150);
  assert.equal(plan[0].minutes, 60);
  for (const subject of subjects) assert.equal(plan.filter(day => day.subject === subject.id).length, 6);
  assert.deepEqual(plan.flatMap(day => day.questionIds).sort(), questions.map(question => question.id).sort());
  assert.deepEqual(daily.find(day => day.date === '2026-11-16'), { date: '2026-11-16', minutes: 55, target: 60, attempts: 1 });
});

test('session upserts and attempt ids are idempotent with review dates derived from rating', t => {
  const { database } = databaseFixture(t);
  database.saveSession({ id: 'one', date: '2026-11-16', subject: 'sql', minutes: 20 });
  database.saveSession({ id: 'one', date: '2026-11-16', subject: 'sql', minutes: 35 });
  const attempt = { id: 'one', date: '2026-11-16', questionId: 'sql-1', rating: 'confident', answer: 'First' };
  database.saveAttempt(attempt);
  database.saveAttempt({ ...attempt, rating: 'again', answer: 'Retry' });
  const { progress } = database.bootstrap();
  assert.equal(progress.sessions.length, 1);
  assert.equal(progress.sessions[0].minutes, 35);
  assert.equal(progress.attempts.length, 1);
  assert.equal(progress.attempts[0].answer, 'First');
  assert.equal(progress.attempts[0].nextReview, '2026-11-23');
});

test('simple studied reviews are idempotent, independent of written attempts, and persist on reopen', t => {
  const { database, filename } = databaseFixture(t);
  assert.deepEqual(database.bootstrap().progress.reviews, []);
  database.saveAttempt({ id: 'legacy-attempt', date: '2026-11-16', questionId: 'sql-1', rating: 'developing', answer: 'Existing answer', note: 'Existing note' });
  database.saveDraft('sql-1', 'Existing draft');
  const review = { id: 'studied-sql-1', date: '2026-11-16', questionId: 'sql-1', createdAt: '2026-11-16T08:00:00.000Z' };
  const first = database.saveReview(review);
  assert.deepEqual(first.progress.reviews, [review]);
  const repeated = database.saveReview({ ...review, date: '2026-11-17', questionId: 'sql-2' });
  assert.deepEqual(repeated.progress.reviews, [review]);
  assert.equal(repeated.progress.attempts[0].note, 'Existing note');
  assert.equal(repeated.progress.drafts['sql-1'], 'Existing draft');
  assert.equal(repeated.daily.find(day => day.date === '2026-11-16').attempts, 1);
  database.close();
  const reopened = createDatabase(filename, catalog);
  try {
    assert.deepEqual(reopened.bootstrap().progress.reviews, [review]);
    assert.equal(reopened.bootstrap().progress.attempts[0].answer, 'Existing answer');
    const generated = reopened.saveReview({ id: 'without-thought', date: '2026-11-18', questionId: 'python-1' }).progress.reviews.find(item => item.id === 'without-thought');
    assert.deepEqual(Object.keys(generated).sort(), ['createdAt', 'date', 'id', 'questionId']);
    assert.match(generated.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally { reopened.close(); }
});

test('invalid studied reviews leave all saved state untouched', t => {
  const { database } = databaseFixture(t);
  const valid = { id: 'studied-1', date: '2026-11-16', questionId: 'sql-1' };
  database.saveReview(valid);
  const before = database.bootstrap();
  for (const value of [null, { ...valid, id: '' }, { ...valid, id: 'bad id' }, { ...valid, date: '2026-02-30' }, { ...valid, date: 'yesterday' }, { ...valid, questionId: 'missing' }, { ...valid, createdAt: 'invalid' }]) {
    assert.throws(() => database.saveReview(value), error => error.status === 400);
  }
  assert.deepEqual(database.bootstrap(), before);
});

test('review backups restore atomically and legacy v1 backups without reviews remain compatible', t => {
  const { database } = databaseFixture(t);
  database.saveAttempt({ id: 'legacy', date: '2026-11-16', questionId: 'sql-1', rating: 'confident', answer: 'Keep answer', note: 'Keep note' });
  database.saveDraft('sql-1', 'Keep draft');
  database.saveReview({ id: 'studied-1', date: '2026-11-16', questionId: 'sql-1' });
  const backup = database.exportBackup();
  assert.equal(backup.version, 1);
  assert.equal(backup.progress.reviews.length, 1);
  database.saveReview({ id: 'remove-on-restore', date: '2026-11-17', questionId: 'sql-2' });
  assert.deepEqual(database.importBackup(backup).progress, backup.progress);
  for (const reviews of [null, {}, [{ id: 'bad', date: '2026-11-16', questionId: 'missing' }], [backup.progress.reviews[0], backup.progress.reviews[0]]]) {
    const invalid = structuredClone(backup);
    invalid.settings.name = 'Must not replace settings';
    invalid.progress.reviews = reviews;
    assert.throws(() => database.importBackup(invalid), error => error.status === 400);
    assert.deepEqual(database.bootstrap().progress, backup.progress);
    assert.deepEqual(database.bootstrap().settings, backup.settings);
  }
  const legacy = structuredClone(backup);
  delete legacy.progress.reviews;
  const restored = database.importBackup(legacy);
  assert.deepEqual(restored.progress.reviews, []);
  assert.equal(restored.progress.attempts[0].answer, 'Keep answer');
  assert.equal(restored.progress.attempts[0].note, 'Keep note');
  assert.equal(restored.progress.drafts['sql-1'], 'Keep draft');
});

test('invalid dates, durations, settings and question references never alter stored state', t => {
  const { database } = databaseFixture(t);
  const before = database.exportBackup();
  assert.throws(() => database.saveSession({ id: 'one', date: '2026-02-30', subject: 'sql', minutes: 25 }));
  assert.throws(() => database.saveSession({ id: 'one', date: '2026-11-16', subject: 'sql', minutes: -1 }));
  assert.throws(() => database.saveAttempt({ id: 'one', date: '2026-11-16', questionId: 'missing', rating: 'confident' }));
  assert.throws(() => database.saveDraft('missing', 'text'));
  assert.throws(() => database.toggleBookmark('missing'));
  assert.throws(() => database.updateSettings({ theme: 'neon' }));
  assert.throws(() => database.updateSettings({ weekdayMinutes: 0 }));
  assert.deepEqual(database.bootstrap().progress, before.progress);
  assert.deepEqual(database.bootstrap().settings, before.settings);
});

test('versioned restore replaces user state atomically and retains seeded questions', t => {
  const { database } = databaseFixture(t);
  database.saveSession({ id: 'keep', date: '2026-11-16', subject: 'sql', minutes: 25 });
  database.saveAttempt({ id: 'answer', date: '2026-11-16', questionId: 'sql-1', rating: 'developing', answer: 'Saved answer', note: 'Read the plan' });
  database.saveDraft('sql-1', 'saved');
  database.toggleBookmark('sql-1');
  const backup = database.exportBackup();
  assert.equal(backup.version, 1);
  const invalid = structuredClone(backup);
  invalid.progress.sessions.push({ id: 'bad', date: '2026-11-16', subject: 'missing', minutes: 30 });
  assert.throws(() => database.importBackup(invalid));
  assert.deepEqual(database.bootstrap().progress, backup.progress);
  assert.throws(() => database.importBackup({ ...backup, version: 999 }));
  database.saveDraft('sql-2', 'remove on restore');
  database.updateSettings({ name: 'Changed' });
  const result = database.importBackup(backup);
  assert.deepEqual(result.progress, backup.progress);
  assert.deepEqual(result.settings, backup.settings);
  assert.equal(result.questions.length, 100);
});

test('HTTP enforces local mutation headers, JSON and origin while returning persisted snapshots', async t => {
  const { database, directory } = databaseFixture(t);
  const staticDirectory = join(directory, 'build');
  mkdirSync(staticDirectory);
  writeFileSync(join(staticDirectory, 'index.html'), '<html>study desk</html>');
  const server = createStudyServer({ database, staticDirectory });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Study-Client': 'local' };
  assert.equal((await fetch(`${base}/api/bootstrap`)).status, 200);
  assert.equal((await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/api/settings`, { method: 'PUT', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'X-Study-Client': 'local' }, body: '{}' })).status, 415);
  const response = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { ...headers, Origin: 'http://localhost:5173' }, body: JSON.stringify({ name: 'HTTP saved' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).settings.name, 'HTTP saved');
  const writes = [
    ['POST', '/api/sessions', { id: 'http-session', date: '2026-11-16', subject: 'sql', minutes: 30 }],
    ['POST', '/api/attempts', { id: 'http-attempt', date: '2026-11-16', questionId: 'sql-1', rating: 'developing', answer: 'HTTP answer' }],
    ['POST', '/api/reviews', { id: 'http-review', date: '2026-11-16', questionId: 'sql-1' }],
    ['PUT', '/api/drafts/sql-1', { text: 'HTTP draft' }],
    ['POST', '/api/bookmarks/sql-1', {}],
    ['PUT', '/api/material-progress/guide-day-01-section-01', { completed: true }],
    ['PUT', '/api/material-state', { materialId: 'guide', day: 1, sectionId: 'guide-day-01-section-01' }],
    ['POST', '/api/note-sections', {id:'http-section',title:'HTTP section',collapsed:false,order:1,createdAt:'2026-11-18T07:00:00.000Z'}],
    ['POST', '/api/notes', {id:'http-note',title:'HTTP note',createdAt:'2026-11-18T08:00:00.000Z',blocks:[{id:'http-block',type:'text',text:'Saved through the local API.'}]}]
  ];
  for (const [method, path, body] of writes) {
    const result = await fetch(`${base}${path}`, { method, headers, body: JSON.stringify(body) });
    assert.equal(result.status, 200, path);
    assert.equal((await result.json()).questions.length, 100, 'mutation returns complete bootstrap');
  }
  const backup = await (await fetch(`${base}/api/export`)).json();
  assert.equal(backup.progress.reviews.length, 1);
  assert.equal(backup.progress.reviews[0].questionId, 'sql-1');
  const repeatReview = await fetch(`${base}/api/reviews`, { method: 'POST', headers, body: JSON.stringify({ id: 'http-review', date: '2026-11-17', questionId: 'sql-2' }) });
  assert.equal(repeatReview.status, 200);
  assert.deepEqual((await repeatReview.json()).progress.reviews, backup.progress.reviews);
  assert.equal((await fetch(`${base}/api/reviews`, { method: 'POST', headers, body: JSON.stringify({ id: 'bad-review', date: '2026-02-30', questionId: 'sql-1' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal(backup.progress.attempts[0].answer, 'HTTP answer');
  assert.equal(backup.progress.drafts['sql-1'], 'HTTP draft');
  assert.deepEqual(backup.progress.bookmarks, ['sql-1']);
  assert.equal(backup.progress.materialSections[0].sectionId,'guide-day-01-section-01');
  assert.equal(backup.progress.materialState.sectionId,'guide-day-01-section-01');
  assert.equal(backup.noteSections.some(section=>section.id==='http-section'),true);
  assert.equal(backup.notes[0].title,'HTTP note');
  const deletedSection=await fetch(`${base}/api/note-sections/http-section`,{method:'DELETE',headers,body:'{}'});
  assert.equal(deletedSection.status,200);
  assert.equal((await deletedSection.json()).noteSections.some(section=>section.id==='http-section'),false);
  const deletedNote=await fetch(`${base}/api/notes/http-note`,{method:'DELETE',headers,body:'{}'});
  assert.equal(deletedNote.status,200);
  assert.equal((await deletedNote.json()).notes.length,0);
  const restored = await fetch(`${base}/api/import`, { method: 'POST', headers, body: JSON.stringify(backup) });
  assert.equal(restored.status, 200);
  assert.deepEqual((await restored.json()).progress, backup.progress);
  const invalidBackup = { ...backup, version: 999 };
  assert.equal((await fetch(`${base}/api/import`, { method: 'POST', headers, body: JSON.stringify(invalidBackup) })).status, 400);
  assert.deepEqual((await (await fetch(`${base}/api/bootstrap`)).json()).progress, backup.progress);
  assert.equal((await fetch(`${base}/api/settings`, { method: 'PUT', headers, body: '{invalid' })).status, 400);
  assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  assert.match(await (await fetch(`${base}/practice/sql-1`)).text(), /study desk/);
});
