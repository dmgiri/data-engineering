import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reviewDays = { again: 1, developing: 3, confident: 7 };
const noteSectionColors=['#7c4dff','#0a84ff','#ff4d67','#ec00a9','#ff9f0a','#30b0c7','#34c759','#8e8e93'];
const noteCodeLanguages=['sql','postgresql','python','pyspark','scala','json','bash','text'];
const invalid = message => { const error = new Error(message); error.status = 400; throw error; };
const object = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object.`);
  return value;
};
const text = (value, label, limit = 20000, optional = false) => {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > limit) invalid(`${label} must be text up to ${limit} characters.`);
  return value;
};
const id = (value, label = 'id') => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)) invalid(`Invalid ${label}.`);
  return value;
};
const integer = (value, label, min = 1, max = 1440) => {
  if (!Number.isInteger(value) || value < min || value > max) invalid(`${label} must be an integer from ${min} to ${max}.`);
  return value;
};
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Use a valid YYYY-MM-DD date.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid('Use a valid calendar date.');
  return value;
};
const today = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
};
const addDays = (value, days) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};
const createdAt = value => {
  if (value === undefined) return new Date().toISOString();
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) invalid('Invalid createdAt timestamp.');
  return value;
};

/** Synchronous, transaction-backed local storage. Catalog is seeded once, then read from SQLite. */
export function createDatabase(filename = resolve('.data/study.sqlite'), catalog) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, color TEXT NOT NULL,
      description TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, subject TEXT NOT NULL REFERENCES subjects(id), topic TEXT NOT NULL,
      title TEXT NOT NULL, difficulty TEXT NOT NULL, type TEXT NOT NULL, minutes INTEGER NOT NULL,
      prompt TEXT NOT NULL, answer TEXT NOT NULL, code TEXT NOT NULL, language TEXT NOT NULL,
      pitfalls TEXT NOT NULL, followups TEXT NOT NULL, sourceUrl TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, weekdayMinutes INTEGER NOT NULL,
      weekendMinutes INTEGER NOT NULL, startDate TEXT NOT NULL, theme TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, subject TEXT NOT NULL REFERENCES subjects(id),
      minutes INTEGER NOT NULL CHECK (minutes > 0), note TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, questionId TEXT NOT NULL REFERENCES questions(id),
      rating TEXT NOT NULL CHECK (rating IN ('again','developing','confident')),
      answer TEXT NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL, nextReview TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, questionId TEXT NOT NULL REFERENCES questions(id),
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drafts (questionId TEXT PRIMARY KEY REFERENCES questions(id), text TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmarks (questionId TEXT PRIMARY KEY REFERENCES questions(id));
    CREATE TABLE IF NOT EXISTS study_materials (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      source_document TEXT NOT NULL, source_hash TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS material_days (
      id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES study_materials(id), day_number INTEGER NOT NULL,
      title TEXT NOT NULL, group_name TEXT NOT NULL, sort_order INTEGER NOT NULL,
      UNIQUE(material_id, day_number)
    );
    CREATE TABLE IF NOT EXISTS material_sections (
      id TEXT PRIMARY KEY, day_id TEXT NOT NULL REFERENCES material_days(id), title TEXT NOT NULL,
      markdown TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS material_resources (
      id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES study_materials(id), title TEXT NOT NULL,
      markdown TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS material_progress (
      section_id TEXT PRIMARY KEY REFERENCES material_sections(id), completed INTEGER NOT NULL CHECK (completed = 1), updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS material_state (
      id INTEGER PRIMARY KEY CHECK (id = 1), material_id TEXT NOT NULL REFERENCES study_materials(id),
      day_number INTEGER NOT NULL, section_id TEXT NOT NULL REFERENCES material_sections(id), updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS note_sections (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, collapsed INTEGER NOT NULL CHECK (collapsed IN (0, 1)),
      sort_order INTEGER NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, blocks TEXT NOT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      sectionId TEXT REFERENCES note_sections(id), sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS attempts_date ON attempts(date);
    CREATE INDEX IF NOT EXISTS reviews_date ON reviews(date);
    PRAGMA user_version = 1;
  `);
  // Additive migration: keep the original question IDs, answers, and all user records.
  const columns=new Set(sqlite.prepare('PRAGMA table_info(questions)').all().map(column=>column.name));
  if(!columns.has('subtopic'))sqlite.exec("ALTER TABLE questions ADD COLUMN subtopic TEXT NOT NULL DEFAULT ''");
  if(!columns.has('provenance'))sqlite.exec('ALTER TABLE questions ADD COLUMN provenance TEXT DEFAULT NULL');
  const sectionColumns=new Set(sqlite.prepare('PRAGMA table_info(note_sections)').all().map(column=>column.name));
  if(!sectionColumns.has('color')){
    sqlite.exec("ALTER TABLE note_sections ADD COLUMN color TEXT NOT NULL DEFAULT '#7c4dff'");
    sqlite.prepare('SELECT id,sort_order FROM note_sections ORDER BY sort_order,id').all().forEach((section,index)=>sqlite.prepare('UPDATE note_sections SET color = ? WHERE id = ?').run(noteSectionColors[index%noteSectionColors.length],section.id));
  }
  const defaultSection={id:'section-default',title:'My Notes',collapsed:0,order:0,color:noteSectionColors[0],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  sqlite.prepare('INSERT OR IGNORE INTO note_sections (id,title,collapsed,sort_order,color,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(defaultSection.id,defaultSection.title,defaultSection.collapsed,defaultSection.order,defaultSection.color,defaultSection.createdAt,defaultSection.updatedAt);
  const noteColumns=new Set(sqlite.prepare('PRAGMA table_info(notes)').all().map(column=>column.name));
  const migrateNoteOrder=!noteColumns.has('sort_order');
  if(!noteColumns.has('sectionId'))sqlite.exec('ALTER TABLE notes ADD COLUMN sectionId TEXT REFERENCES note_sections(id)');
  if(migrateNoteOrder)sqlite.exec('ALTER TABLE notes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  sqlite.prepare('UPDATE notes SET sectionId = ? WHERE sectionId IS NULL OR sectionId = ?').run(defaultSection.id,'');
  if(migrateNoteOrder)sqlite.prepare('SELECT id FROM notes ORDER BY updatedAt, id').all().forEach((note,order)=>sqlite.prepare('UPDATE notes SET sort_order = ? WHERE id = ?').run(order,note.id));
  function transaction(work) {
    sqlite.exec('BEGIN IMMEDIATE');
    try { const result = work(); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  try {
    const seed = catalog ?? require('./catalog.mjs');
    transaction(() => {
      const insertSubject = sqlite.prepare('INSERT OR IGNORE INTO subjects VALUES (?, ?, ?, ?, ?, ?)');
      seed.subjects.forEach((subject, order) => insertSubject.run(subject.id, subject.name, subject.short, subject.color, subject.description, order));
      const insertQuestion = sqlite.prepare('INSERT OR IGNORE INTO questions (id,subject,topic,title,difficulty,type,minutes,prompt,answer,code,language,pitfalls,followups,sourceUrl,sort_order,subtopic,provenance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      seed.questions.forEach((question, order) => insertQuestion.run(
        question.id, question.subject, question.topic, question.title, question.difficulty, question.type,
        question.minutes, question.prompt, JSON.stringify(question.answer), question.code ?? '', question.language ?? '',
        JSON.stringify(question.pitfalls ?? []), JSON.stringify(question.followups ?? []), question.sourceUrl ?? '', order,
        question.subtopic ?? question.title,question.provenance?JSON.stringify(question.provenance):null
      ));
      const insertMaterial=sqlite.prepare('INSERT OR IGNORE INTO study_materials VALUES (?, ?, ?, ?, ?, ?)');
      const insertMaterialDay=sqlite.prepare('INSERT OR IGNORE INTO material_days VALUES (?, ?, ?, ?, ?, ?)');
      const insertMaterialSection=sqlite.prepare('INSERT OR IGNORE INTO material_sections VALUES (?, ?, ?, ?, ?)');
      const insertMaterialResource=sqlite.prepare('INSERT OR IGNORE INTO material_resources VALUES (?, ?, ?, ?, ?)');
      (seed.studyMaterials??seed.materials??[]).forEach((material,materialOrder)=>{
        insertMaterial.run(material.id,material.title,material.description,material.source?.document??'',material.source?.hash??'',materialOrder);
        material.days.forEach((day,dayOrder)=>{
          insertMaterialDay.run(day.id,material.id,day.day,day.title,day.group,dayOrder);
          day.sections.forEach((section,sectionOrder)=>insertMaterialSection.run(section.id,day.id,section.title,section.markdown,sectionOrder));
        });
        (material.resources??[]).forEach((resource,resourceOrder)=>insertMaterialResource.run(resource.id,material.id,resource.title,resource.markdown,resourceOrder));
      });
      sqlite.prepare('INSERT OR IGNORE INTO settings VALUES (1, ?, 60, 150, ?, ?)').run('Dipak', today(), 'dark');
    });
  } catch (error) { sqlite.close(); throw error; }

  const readSettings = () => ({ ...sqlite.prepare('SELECT name, weekdayMinutes, weekendMinutes, startDate, theme FROM settings WHERE id = 1').get() });
  const knownQuestion = value => {
    id(value, 'question id');
    if (!sqlite.prepare('SELECT 1 FROM questions WHERE id = ?').get(value)) invalid('Unknown question.');
    return value;
  };
  const knownSubject = value => {
    id(value, 'subject');
    if (!sqlite.prepare('SELECT 1 FROM subjects WHERE id = ?').get(value)) invalid('Unknown subject.');
    return value;
  };
  const knownMaterial = value => {
    id(value,'material id');
    if(!sqlite.prepare('SELECT 1 FROM study_materials WHERE id = ?').get(value))invalid('Unknown study material.');
    return value;
  };
  const knownMaterialSection = value => {
    id(value,'material section id');
    const row=sqlite.prepare(`SELECT d.material_id AS materialId,d.day_number AS day
      FROM material_sections s JOIN material_days d ON d.id=s.day_id WHERE s.id = ?`).get(value);
    if(!row)invalid('Unknown study material section.');
    return {...row,sectionId:value};
  };
  const validateSettings = (changes, base = readSettings()) => {
    object(changes, 'Settings');
    if (Object.keys(changes).some(key => !['name', 'weekdayMinutes', 'weekendMinutes', 'startDate', 'theme'].includes(key))) invalid('Unknown settings field.');
    const settings = { ...base, ...changes };
    text(settings.name, 'Name', 120);
    integer(settings.weekdayMinutes, 'Weekday minutes');
    integer(settings.weekendMinutes, 'Weekend minutes');
    date(settings.startDate);
    if (!['light', 'dark', 'system'].includes(settings.theme)) invalid('Theme must be light, dark or system.');
    return settings;
  };
  const normalizeSession = value => {
    object(value, 'Session');
    return { id: id(value.id), date: date(value.date), subject: knownSubject(value.subject), minutes: integer(value.minutes, 'Minutes'), note: text(value.note, 'Note', 20000, true), createdAt: createdAt(value.createdAt) };
  };
  const normalizeAttempt = value => {
    object(value, 'Attempt');
    if (!Object.hasOwn(reviewDays, value.rating)) invalid('Rating must be again, developing or confident.');
    return { id: id(value.id), date: date(value.date), questionId: knownQuestion(value.questionId), rating: value.rating,
      answer: text(value.answer, 'Answer', 100000, true), note: text(value.note, 'Note', 20000, true),
      createdAt: createdAt(value.createdAt), nextReview: addDays(value.date, reviewDays[value.rating]) };
  };
  const normalizeReview = value => {
    object(value, 'Review');
    return { id: id(value.id), date: date(value.date), questionId: knownQuestion(value.questionId), createdAt: createdAt(value.createdAt) };
  };
  const normalizeMaterialState=value=>{
    object(value,'Material state');
    const materialId=knownMaterial(value.materialId);
    const day=integer(value.day,'Material day',1,30);
    const section=knownMaterialSection(value.sectionId);
    if(section.materialId!==materialId||section.day!==day)invalid('Study material position does not match its section.');
    return {materialId,day,sectionId:section.sectionId,updatedAt:createdAt(value.updatedAt)};
  };
  const normalizeMaterialProgress=value=>{
    object(value,'Material progress');
    const section=knownMaterialSection(value.sectionId);
    if(value.completed!==true)invalid('Completed material progress must be true.');
    return {sectionId:section.sectionId,completed:true,updatedAt:createdAt(value.updatedAt)};
  };
  const knownNoteSection=value=>{
    const sectionId=id(value,'note section id');
    if(!sqlite.prepare('SELECT 1 FROM note_sections WHERE id = ?').get(sectionId))invalid('Unknown note section.');
    return sectionId;
  };
  const normalizeNoteSection=(value,restore=false)=>{
    object(value,'Note section');
    const title=text(value.title,'Note section title',120).trim();
    if(!title)invalid('Note section title is required.');
    if(typeof value.collapsed!=='boolean')invalid('Note section collapsed state must be true or false.');
    const order=integer(value.order,'Note section order',0,10000);
    const color=value.color===undefined?noteSectionColors[order%noteSectionColors.length]:value.color;
    if(!noteSectionColors.includes(color))invalid('Choose a supported note section color.');
    return {id:id(value.id,'note section id'),title,color,collapsed:value.collapsed,order,createdAt:createdAt(value.createdAt),updatedAt:restore?createdAt(value.updatedAt):new Date().toISOString()};
  };
  const normalizeNoteBlock=(value,index)=>{
    object(value,`Note block ${index+1}`);
    const blockId=id(value.id,`note block ${index+1} id`);
    if(!['text','link','image','table','code'].includes(value.type))invalid(`Note block ${index+1} has an unsupported type.`);
    if(value.type==='text')return {id:blockId,type:'text',text:text(value.text,'Note text',100000)};
    if(value.type==='code'){
      if(!noteCodeLanguages.includes(value.language))invalid('Choose a supported code language.');
      return {id:blockId,type:'code',language:value.language,code:text(value.code,'Note code',100000)};
    }
    if(value.type==='table'){
      if(!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>20)invalid('A note table must contain 1 to 20 rows.');
      const width=Array.isArray(value.rows[0])?value.rows[0].length:0;
      if(width<1||width>10||value.rows.some(row=>!Array.isArray(row)||row.length!==width))invalid('A note table must contain 1 to 10 columns with equal row lengths.');
      return {id:blockId,type:'table',rows:value.rows.map((row,rowIndex)=>row.map((cell,columnIndex)=>text(cell,`Table cell ${rowIndex+1}:${columnIndex+1}`,2000)))};
    }
    if(value.type==='link'){
      const label=text(value.label,'Link label',300),urlValue=text(value.url,'Link URL',2000);
      let parsed;try{parsed=new URL(urlValue)}catch{invalid('Link URL must be valid.')}
      if(!['http:','https:'].includes(parsed.protocol))invalid('Links must use http or https.');
      return {id:blockId,type:'link',label,url:urlValue};
    }
    const name=text(value.name,'Image name',200),alt=text(value.alt,'Image description',500,true),dataUrl=text(value.dataUrl,'Image data',2800000);
    if(!/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/]+={0,2}$/.test(dataUrl))invalid('Use a PNG, JPEG, WebP, or GIF image.');
    return {id:blockId,type:'image',name,alt,dataUrl};
  };
  const normalizeNote=(value,restore=false,allowedSections=null)=>{
    object(value,'Note');
    const title=text(value.title,'Note title',200).trim();
    if(!title)invalid('Note title is required.');
    if(!Array.isArray(value.blocks)||value.blocks.length<1||value.blocks.length>100)invalid('A note must contain 1 to 100 blocks.');
    const blocks=value.blocks.map(normalizeNoteBlock);
    if(new Set(blocks.map(block=>block.id)).size!==blocks.length)invalid('Note blocks must have unique ids.');
    const sectionId=value.sectionId===undefined?'section-default':id(value.sectionId,'note section id');
    if(allowedSections?!allowedSections.has(sectionId):!sqlite.prepare('SELECT 1 FROM note_sections WHERE id = ?').get(sectionId))invalid('Unknown note section.');
    return {id:id(value.id,'note id'),sectionId,order:integer(value.order??0,'Note order',0,100000),title,blocks,createdAt:createdAt(value.createdAt),updatedAt:restore?createdAt(value.updatedAt):new Date().toISOString()};
  };
  const putSettings = settings => sqlite.prepare('UPDATE settings SET name = ?, weekdayMinutes = ?, weekendMinutes = ?, startDate = ?, theme = ? WHERE id = 1').run(settings.name, settings.weekdayMinutes, settings.weekendMinutes, settings.startDate, settings.theme);
  const putSession = session => sqlite.prepare(`INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
    date=excluded.date, subject=excluded.subject, minutes=excluded.minutes, note=excluded.note`).run(session.id, session.date, session.subject, session.minutes, session.note, session.createdAt);
  const putAttempt = attempt => sqlite.prepare('INSERT OR IGNORE INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(attempt.id, attempt.date, attempt.questionId, attempt.rating, attempt.answer, attempt.note, attempt.createdAt, attempt.nextReview);
  const putReview = review => sqlite.prepare('INSERT OR IGNORE INTO reviews VALUES (?, ?, ?, ?)').run(review.id, review.date, review.questionId, review.createdAt);
  const putDraft = (questionId, value) => sqlite.prepare('INSERT INTO drafts VALUES (?, ?) ON CONFLICT(questionId) DO UPDATE SET text=excluded.text').run(questionId, value);
  const putMaterialProgress=progress=>sqlite.prepare(`INSERT INTO material_progress VALUES (?, 1, ?)
    ON CONFLICT(section_id) DO UPDATE SET completed=1,updatedAt=excluded.updatedAt`).run(progress.sectionId,progress.updatedAt);
  const putMaterialState=state=>sqlite.prepare(`INSERT INTO material_state VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET material_id=excluded.material_id,day_number=excluded.day_number,section_id=excluded.section_id,updatedAt=excluded.updatedAt`).run(state.materialId,state.day,state.sectionId,state.updatedAt);
  const putNoteSection=section=>sqlite.prepare(`INSERT INTO note_sections (id,title,collapsed,sort_order,color,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,collapsed=excluded.collapsed,sort_order=excluded.sort_order,color=excluded.color,updatedAt=excluded.updatedAt`).run(section.id,section.title,section.collapsed?1:0,section.order,section.color,section.createdAt,section.updatedAt);
  const putNote=note=>sqlite.prepare(`INSERT INTO notes (id,title,blocks,createdAt,updatedAt,sectionId,sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,blocks=excluded.blocks,updatedAt=excluded.updatedAt,sectionId=excluded.sectionId,sort_order=excluded.sort_order`).run(note.id,note.title,JSON.stringify(note.blocks),note.createdAt,note.updatedAt,note.sectionId,note.order);

  function bootstrap() {
    const subjects = sqlite.prepare('SELECT id, name, short, color, description FROM subjects ORDER BY sort_order').all().map(row => ({ ...row }));
    const questions = sqlite.prepare('SELECT * FROM questions ORDER BY sort_order').all().map(({ sort_order, ...row }) => ({ ...row, subtopic:row.subtopic||row.title,provenance:row.provenance?JSON.parse(row.provenance):null,answer: JSON.parse(row.answer), pitfalls: JSON.parse(row.pitfalls), followups: JSON.parse(row.followups) }));
    const settings = readSettings();
    const materialRows=sqlite.prepare('SELECT * FROM study_materials ORDER BY sort_order').all();
    const dayRows=sqlite.prepare('SELECT * FROM material_days ORDER BY sort_order').all();
    const sectionRows=sqlite.prepare('SELECT * FROM material_sections ORDER BY sort_order').all();
    const resourceRows=sqlite.prepare('SELECT * FROM material_resources ORDER BY sort_order').all();
    const materials=materialRows.map(material=>({
      id:material.id,title:material.title,description:material.description,
      source:{document:material.source_document,hash:material.source_hash},
      days:dayRows.filter(day=>day.material_id===material.id).map(day=>({
        id:day.id,day:day.day_number,title:day.title,group:day.group_name,
        sections:sectionRows.filter(section=>section.day_id===day.id).map(section=>({id:section.id,title:section.title,markdown:section.markdown,order:section.sort_order}))
      })),
      resources:resourceRows.filter(resource=>resource.material_id===material.id).map(resource=>({id:resource.id,title:resource.title,markdown:resource.markdown,order:resource.sort_order}))
    }));
    const noteSections=sqlite.prepare('SELECT id,title,collapsed,sort_order AS "order",color,createdAt,updatedAt FROM note_sections ORDER BY sort_order, id').all().map(row=>({...row,collapsed:Boolean(row.collapsed)}));
    const notes=sqlite.prepare('SELECT id,title,blocks,createdAt,updatedAt,sectionId,sort_order AS "order" FROM notes ORDER BY sectionId,sort_order,id').all().map(row=>({...row,blocks:JSON.parse(row.blocks)}));
    const savedMaterialState=sqlite.prepare('SELECT material_id AS materialId,day_number AS day,section_id AS sectionId,updatedAt FROM material_state WHERE id = 1').get();
    const progress = {
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY date, createdAt, id').all().map(row => ({ ...row })),
      attempts: sqlite.prepare('SELECT * FROM attempts ORDER BY date, createdAt, id').all().map(row => ({ ...row })),
      reviews: sqlite.prepare('SELECT * FROM reviews ORDER BY date, createdAt, id').all().map(row => ({ ...row })),
      drafts: Object.fromEntries(sqlite.prepare('SELECT * FROM drafts ORDER BY questionId').all().map(row => [row.questionId, row.text])),
      bookmarks: sqlite.prepare('SELECT questionId FROM bookmarks ORDER BY questionId').all().map(row => row.questionId),
      materialSections:sqlite.prepare('SELECT section_id AS sectionId,completed,updatedAt FROM material_progress ORDER BY section_id').all().map(row=>({...row,completed:Boolean(row.completed)})),
      materialState:savedMaterialState?{...savedMaterialState}:null
    };
    const target = value => [0, 6].includes(new Date(`${value}T00:00:00Z`).getUTCDay()) ? settings.weekendMinutes : settings.weekdayMinutes;
    const plan = Array.from({ length: 30 }, (_, index) => {
      const subject = subjects[index % subjects.length];
      const round = Math.floor(index / subjects.length);
      const pool = questions.filter(question => question.subject === subject.id);
      const rounds = Math.floor((29 - subjects.indexOf(subject)) / subjects.length) + 1;
      const assigned = pool.filter((_, questionIndex) => Math.floor(questionIndex * rounds / pool.length) === round);
      const topic = [...new Set(assigned.map(question => question.topic))].slice(0, 2).join(' · ') || `${subject.name} review`;
      const dayDate = addDays(settings.startDate, index);
      return { day: index + 1, date: dayDate, subject: subject.id, topic, questionIds: assigned.map(question => question.id), minutes: target(dayDate), objective: `Practice ${topic}; explain tradeoffs and test your solution aloud.` };
    });
    const days = new Set([...plan.map(day => day.date), ...progress.sessions.map(session => session.date), ...progress.attempts.map(attempt => attempt.date)]);
    const daily = [...days].sort().map(value => ({ date: value,
      minutes: progress.sessions.filter(session => session.date === value).reduce((sum, session) => sum + session.minutes, 0),
      target: target(value), attempts: progress.attempts.filter(attempt => attempt.date === value).length
    }));
    return { subjects, questions, materials, noteSections, notes, settings, progress, plan, daily, database: '.data/study.sqlite' };
  }
  function mutate(work) { transaction(work); return bootstrap(); }
  let closed = false;
  return {
    bootstrap,
    updateSettings(changes) { const settings = validateSettings(changes); return mutate(() => putSettings(settings)); },
    saveSession(value) { const session = normalizeSession(value); return mutate(() => putSession(session)); },
    saveAttempt(value) { const attempt = normalizeAttempt(value); return mutate(() => putAttempt(attempt)); },
    saveReview(value) { const review = normalizeReview(value); return mutate(() => putReview(review)); },
    saveMaterialProgress(sectionId,completed){
      const section=knownMaterialSection(sectionId);
      if(typeof completed!=='boolean')invalid('Material completion must be true or false.');
      return mutate(()=>completed?putMaterialProgress({sectionId:section.sectionId,completed:true,updatedAt:new Date().toISOString()}):sqlite.prepare('DELETE FROM material_progress WHERE section_id = ?').run(section.sectionId));
    },
    saveMaterialState(value){const state=normalizeMaterialState(value);return mutate(()=>putMaterialState(state));},
    saveNoteSection(value){
      const section=normalizeNoteSection(value),existing=sqlite.prepare('SELECT createdAt FROM note_sections WHERE id = ?').get(section.id);
      if(existing)section.createdAt=existing.createdAt;
      return mutate(()=>putNoteSection(section));
    },
    deleteNoteSection(value){
      const sectionId=knownNoteSection(value);
      if(sectionId==='section-default')invalid('The default note section cannot be deleted.');
      return mutate(()=>{sqlite.prepare('DELETE FROM notes WHERE sectionId = ?').run(sectionId);sqlite.prepare('DELETE FROM note_sections WHERE id = ?').run(sectionId)});
    },
    saveNote(value){
      const note=normalizeNote(value),existing=sqlite.prepare('SELECT createdAt FROM notes WHERE id = ?').get(note.id);
      if(existing)note.createdAt=existing.createdAt;
      return mutate(()=>putNote(note));
    },
    deleteNote(value){
      const noteId=id(value,'note id');
      if(!sqlite.prepare('SELECT 1 FROM notes WHERE id = ?').get(noteId))invalid('Unknown note.');
      return mutate(()=>sqlite.prepare('DELETE FROM notes WHERE id = ?').run(noteId));
    },
    saveDraft(questionId, value) {
      knownQuestion(questionId); text(value, 'Draft', 100000);
      return mutate(() => putDraft(questionId, value));
    },
    toggleBookmark(questionId) {
      knownQuestion(questionId);
      return mutate(() => {
        if (sqlite.prepare('SELECT 1 FROM bookmarks WHERE questionId = ?').get(questionId)) sqlite.prepare('DELETE FROM bookmarks WHERE questionId = ?').run(questionId);
        else sqlite.prepare('INSERT INTO bookmarks VALUES (?)').run(questionId);
      });
    },
    exportBackup() { return { version: 1, exportedAt: new Date().toISOString(), ...bootstrap() }; },
    importBackup(value) {
      object(value, 'Backup');
      if (value.version !== 1) invalid('Unsupported backup version.');
      const settings = validateSettings(object(value.settings, 'Settings'), {});
      const progress = object(value.progress, 'Progress');
      for (const key of ['sessions', 'attempts', 'bookmarks']) {
        if (!Array.isArray(progress[key]) || progress[key].length > 100000) invalid(`Invalid ${key} list.`);
      }
      const reviewRecords = Object.hasOwn(progress, 'reviews') ? progress.reviews : [];
      if (!Array.isArray(reviewRecords) || reviewRecords.length > 100000) invalid('Invalid reviews list.');
      object(progress.drafts, 'Drafts');
      if (Object.keys(progress.drafts).length > 100000) invalid('Too many drafts.');
      const sessions = progress.sessions.map(normalizeSession);
      const attempts = progress.attempts.map(normalizeAttempt);
      const reviews = reviewRecords.map(normalizeReview);
      const drafts = Object.entries(progress.drafts).map(([key, draft]) => [knownQuestion(key), text(draft, 'Draft', 100000)]);
      const bookmarks = progress.bookmarks.map(knownQuestion);
      const hasMaterialSections=Object.hasOwn(progress,'materialSections');
      const hasMaterialState=Object.hasOwn(progress,'materialState');
      if(hasMaterialSections&&(!Array.isArray(progress.materialSections)||progress.materialSections.length>100000))invalid('Invalid materialSections list.');
      const materialSections=hasMaterialSections?progress.materialSections.map(normalizeMaterialProgress):[];
      const materialState=hasMaterialState?(progress.materialState===null?null:normalizeMaterialState(progress.materialState)):undefined;
      const hasNotes=Object.hasOwn(value,'notes');
      if(hasNotes&&(!Array.isArray(value.notes)||value.notes.length>10000))invalid('Invalid notes list.');
      const hasNoteSections=Object.hasOwn(value,'noteSections');
      if(hasNoteSections&&(!Array.isArray(value.noteSections)||value.noteSections.length<1||value.noteSections.length>1000))invalid('Invalid note sections list.');
      const noteSections=hasNoteSections?value.noteSections.map(section=>normalizeNoteSection(section,true)):[];
      if(hasNoteSections&&new Set(noteSections.map(item=>item.id)).size!==noteSections.length)invalid('Backup contains duplicate note sections.');
      if(hasNoteSections&&!noteSections.some(item=>item.id==='section-default'))invalid('Backup must contain the default note section.');
      const allowedSections=new Set((hasNoteSections?noteSections:sqlite.prepare('SELECT id FROM note_sections').all()).map(item=>item.id));
      const notes=hasNotes?value.notes.map(note=>normalizeNote(hasNoteSections?note:{...note,sectionId:'section-default'},true,allowedSections)):[];
      for (const records of [sessions.map(item => item.id), attempts.map(item => item.id), reviews.map(item => item.id), bookmarks]) {
        if (new Set(records).size !== records.length) invalid('Backup contains duplicate records.');
      }
      if(new Set(materialSections.map(item=>item.sectionId)).size!==materialSections.length)invalid('Backup contains duplicate material progress.');
      if(new Set(notes.map(item=>item.id)).size!==notes.length)invalid('Backup contains duplicate notes.');
      return mutate(() => {
        sqlite.exec('DELETE FROM sessions; DELETE FROM attempts; DELETE FROM reviews; DELETE FROM drafts; DELETE FROM bookmarks;');
        putSettings(settings);
        sessions.forEach(putSession); attempts.forEach(putAttempt); reviews.forEach(putReview);
        drafts.forEach(([key, draft]) => putDraft(key, draft));
        const insertBookmark = sqlite.prepare('INSERT INTO bookmarks VALUES (?)');
        bookmarks.forEach(key => insertBookmark.run(key));
        if(hasMaterialSections){sqlite.exec('DELETE FROM material_progress;');materialSections.forEach(putMaterialProgress)}
        if(hasMaterialState){sqlite.exec('DELETE FROM material_state;');if(materialState)putMaterialState(materialState)}
        if(hasNoteSections&&hasNotes){sqlite.exec('DELETE FROM notes; DELETE FROM note_sections;');noteSections.forEach(putNoteSection)}
        else if(hasNoteSections)noteSections.forEach(putNoteSection);
        if(hasNotes){sqlite.exec('DELETE FROM notes;');notes.forEach(putNote)}
      });
    },
    close() { if (!closed) { sqlite.close(); closed = true; } }
  };
}
