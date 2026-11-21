import test from 'node:test';
import assert from 'node:assert/strict';
import {globalNavigation,navigationState} from '../src/navigation.mjs';
import {dashboardModel} from '../src/dashboard-model.mjs';

test('global navigation exposes every portal destination in horizontal order',()=>{
  assert.deepEqual(globalNavigation.map(item=>item.id),[
    'desk','library','material','notes','plan','journal','settings'
  ]);
  assert.equal(new Set(globalNavigation.map(item=>item.label)).size,7);
});

test('question reader keeps the Q&A navigation item active',()=>{
  assert.deepEqual(navigationState('study'),{
    activeId:'library',
    ariaLabel:'Q&A library'
  });
});

test('dashboard model derives target, streak, weekly activity and topic readiness from stored records',()=>{
  const data={
    settings:{weekdayMinutes:60,weekendMinutes:150},
    subjects:[{id:'sql',name:'SQL'},{id:'python',name:'Python'}],
    questions:[{id:'q1',subject:'sql'},{id:'q2',subject:'sql'},{id:'q3',subject:'python'}],
    progress:{
      sessions:[
        {date:'2026-11-18',minutes:30},{date:'2026-11-19',minutes:60},{date:'2026-11-20',minutes:45}
      ],
      attempts:[{questionId:'q1'}],reviews:[{questionId:'q3'}]
    }
  };
  const model=dashboardModel(data,'2026-11-20');
  assert.equal(model.targetMinutes,60);
  assert.equal(model.todayMinutes,45);
  assert.equal(model.streak,3);
  assert.equal(model.overallPercent,67);
  assert.deepEqual(model.readiness.map(item=>[item.id,item.percent]),[['sql',50],['python',100]]);
  assert.equal(model.week.reduce((sum,day)=>sum+day.minutes,0),135);
  assert.equal(model.week.at(-1).date,'2026-11-20');
});

