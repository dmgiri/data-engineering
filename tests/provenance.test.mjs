import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDatabase} from '../server/database.mjs';

const subject={id:'sql',name:'SQL',short:'SQL',color:'#888888',description:'SQL'};
const base={id:'sql-1',subject:'sql',topic:'Windows',title:'Latest row',difficulty:'Advanced',type:'Coding',minutes:10,prompt:'Find the latest row.',answer:['Existing answer'],code:'',language:'sql',pitfalls:[],followups:[],sourceUrl:'https://www.postgresql.org/docs/current/tutorial-window.html'};
const provenance={kind:'candidate-reported',url:'https://www.linkedin.com/posts/example-activity-12345',author:'Candidate',title:'Interview experience',company:null,experience:null,accessedAt:'2026-11-18',scope:'reported-topic',note:'Self-reported; not independently verified.'};

test('old SQLite files gain source metadata without losing edited answers or progress',t=>{
  const directory=mkdtempSync(join(tmpdir(),'study-provenance-')),filename=join(directory,'study.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const raw=new DatabaseSync(filename);
  raw.exec(`CREATE TABLE questions(id TEXT PRIMARY KEY,subject TEXT NOT NULL,topic TEXT NOT NULL,title TEXT NOT NULL,difficulty TEXT NOT NULL,type TEXT NOT NULL,minutes INTEGER NOT NULL,prompt TEXT NOT NULL,answer TEXT NOT NULL,code TEXT NOT NULL,language TEXT NOT NULL,pitfalls TEXT NOT NULL,followups TEXT NOT NULL,sourceUrl TEXT NOT NULL,sort_order INTEGER NOT NULL)`);
  raw.prepare('INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(base.id,base.subject,base.topic,base.title,base.difficulty,base.type,10,base.prompt,'["User-edited stored answer"]','','sql','[]','[]',base.sourceUrl,0);raw.close();
  const first=createDatabase(filename,{subjects:[subject],questions:[base]});
  first.saveReview({id:'existing-review',questionId:'sql-1',date:'2026-11-18'});first.toggleBookmark('sql-1');first.saveSession({id:'existing-session',date:'2026-11-18',subject:'sql',minutes:60});first.close();
  const sourced={...base,id:'li-sql-001',subtopic:'ROW_NUMBER',provenance};
  const second=createDatabase(filename,{subjects:[subject],questions:[base,sourced]});
  const snapshot=second.bootstrap();second.close();
  assert.equal(snapshot.questions.find(q=>q.id==='sql-1').answer[0],'User-edited stored answer');
  assert.equal(snapshot.questions.find(q=>q.id==='sql-1').provenance,null);
  assert.equal(snapshot.questions.find(q=>q.id==='li-sql-001').subtopic,'ROW_NUMBER');
  assert.deepEqual(snapshot.questions.find(q=>q.id==='li-sql-001').provenance,provenance);
  assert.equal(snapshot.progress.reviews[0].id,'existing-review');
  assert.deepEqual(snapshot.progress.bookmarks,['sql-1']);assert.equal(snapshot.progress.sessions[0].minutes,60);
  const third=createDatabase(filename,{subjects:[subject],questions:[base,sourced]});
  assert.equal(third.bootstrap().questions.length,2);assert.deepEqual(third.exportBackup().questions[1].provenance,provenance);third.close();
});
