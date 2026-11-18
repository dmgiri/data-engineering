import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseStudyMaterial} from '../server/import-study-material.mjs';
import {studyMaterials} from '../server/catalog.mjs';

test('imports the complete 30-day workbook as stable tracked checkpoints',()=>{
  const material=studyMaterials[0];
  assert.equal(material.id,'senior-de-30-day');
  assert.equal(material.title,'30-Day Data Engineering Interview Prep');
  assert.equal(material.days.length,30);
  assert.equal(material.days.flatMap(day=>day.sections).length,302);
  assert.equal(material.days[0].title,'Joins, cardinality, and existence');
  assert.equal(material.days[0].sections[0].id,'senior-de-30-day-day-01-briefing');
  assert.equal(material.days[0].sections[1].title,'Grain and cardinality');
  assert.match(material.days[0].sections[1].markdown,/INNER JOIN return more rows/);
  assert.match(material.days[0].sections[1].markdown,/```sql/);
  assert.equal(material.days.at(-1).title,'Final retest and interview-day notes');
  assert.equal(material.days.at(-1).sections.at(-1).title,'Worked solution · Final oral and written retest');
  assert.equal(material.days.filter(day=>day.sections.some(section=>section.title.startsWith('Worked solution ·'))).length,30);
  assert.deepEqual(material.days.filter(day=>day.sections.length!==10).map(day=>[day.day,day.sections.length]),[[17,12]]);
  assert.ok(material.resources.some(resource=>resource.title==='PostgreSQL practice data'));
  assert.ok(material.resources.some(resource=>resource.title==='Official references'));
  assert.equal(material.source.hash,'91280c1dead8ba0702e5448ec292877804448efcb665dde596f9151446f33d65');
});

test('headings inside fenced code remain inert source content',()=>{
  const fixture=`# Safe workbook\n\nIntro.\n\n## Day 01 · Real day\n\nBrief.\n\n\`\`\`markdown\n## Day 29 · Fake day\n\`\`\`not-a-closing-fence\n### Fake section\n\`\`\`\n\n\`\`\`\`markdown\n\`\`\`\n### Another fake section\n\`\`\`\`   \n\n### Real section\n\nBody.\n\n${Array.from({length:29},(_,index)=>`## Day ${String(index+2).padStart(2,'0')} · Day ${index+2}\n\nBrief.\n\n### Topic\n\nBody.`).join('\n\n')}\n\n## Official references\n\nReferences.`;
  const material=parseStudyMaterial(fixture,{id:'fixture',sourceDocument:'fixture.md',hash:'fixture'});
  assert.equal(material.days.length,30);
  assert.equal(material.days[0].sections.length,2);
  assert.match(material.days[0].sections[0].markdown,/## Day 29 · Fake day/);
  assert.match(material.days[0].sections[0].markdown,/### Another fake section/);
  assert.equal(material.days[0].sections[1].title,'Real section');
  assert.equal(material.resources.at(-1).title,'Official references');
});

test('rejects missing, duplicate, or non-contiguous study days',()=>{
  const source=readFileSync(new URL('../server/imports/30-day-data-engineering-interview-prep.md',import.meta.url),'utf8');
  assert.throws(()=>parseStudyMaterial(source.replace('## Day 02 ·','## Day 01 ·'),{id:'bad',sourceDocument:'bad.md',hash:'bad'}),/Expected Day 02/);
  assert.throws(()=>parseStudyMaterial(source.replace(/^## Day 30 ·.*$/m,''),{id:'bad',sourceDocument:'bad.md',hash:'bad'}),/Expected 30 study days/);
});
