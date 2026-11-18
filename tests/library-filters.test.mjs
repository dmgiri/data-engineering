import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../src/library-filters.mjs';

const rows=[
  {id:'a',subject:'sql',topic:'Querying',subtopic:'Windows',title:'Rank values',prompt:'Rank records',answer:['Use a stable tiebreaker.','Explain how equal timestamps are ordered.'],code:'ROW_NUMBER()',provenance:{kind:'candidate-reported',author:'Anita',company:'Acme'}},
  {id:'b',subject:'sql',topic:'Querying',subtopic:'Joins',title:'Compare joins',prompt:'Join records',provenance:null},
  {id:'c',subject:'python',topic:'Collections',subtopic:'Sorting',title:'Order records',prompt:'Sort records',provenance:{kind:'candidate-reported',author:'Bala',company:null}},
  {id:'d',subject:'postgres',topic:'Indexing',title:'Choose an index',prompt:'Compare indexes'}
];
test('source and subtopic filters exclude practice from candidate-reported results',()=>{
  assert.equal(typeof library.filterQuestions,'function');
  assert.deepEqual(library.filterQuestions(rows,{sourceKind:'candidate-reported'}).map(q=>q.id),['a','c']);
  assert.deepEqual(library.filterQuestions(rows,{sourceKind:'practice'}).map(q=>q.id),['b','d']);
  assert.deepEqual(library.filterQuestions(rows,{subject:'sql',topic:'Querying',subtopic:'Joins',sourceKind:'all'}).map(q=>q.id),['b']);
});
test('study content is searchable without searching LinkedIn user metadata',()=>{
  assert.equal(typeof library.filterQuestions,'function');
  assert.deepEqual(library.filterQuestions(rows,{search:'TIEBREAKER',sourceKind:'candidate-reported'}).map(q=>q.id),['a']);
  assert.deepEqual(library.filterQuestions(rows,{search:'timestamps',sourceKind:'candidate-reported'}).map(q=>q.id),['a']);
  assert.deepEqual(library.filterQuestions(rows,{search:'row_number',sourceKind:'candidate-reported'}).map(q=>q.id),['a']);
  assert.deepEqual(library.filterQuestions(rows,{search:'ANITA',sourceKind:'candidate-reported'}).map(q=>q.id),[]);
  assert.deepEqual(library.filterQuestions(rows,{search:'Acme',sourceKind:'candidate-reported'}).map(q=>q.id),[]);
  assert.deepEqual(library.filterQuestions(rows,{sourceKind:'candidate-reported',savedOnly:true},['b','c']).map(q=>q.id),['c']);
  assert.deepEqual(library.filterQuestions(rows,{search:'Indexing',sourceKind:'practice'}).map(q=>q.id),['d']);
});
test('imported source IDs and every example are searchable without author metadata',()=>{
  const imported={id:'e',subject:'sql',title:'Imported question',answer:['An answer'],code:'SELECT 1',provenance:{kind:'imported-collection',sourceId:'SQL-001',author:'Private Author',examples:[{language:'sql',code:'SELECT 1'},{language:'sql',code:'SELECT additional_example'}]}};
  assert.deepEqual(library.filterQuestions([imported],{search:'sql-001'}).map(q=>q.id),['e']);
  assert.deepEqual(library.filterQuestions([imported],{search:'additional_example'}).map(q=>q.id),['e']);
  assert.deepEqual(library.filterQuestions([imported],{search:'private author'}).map(q=>q.id),[]);
});
