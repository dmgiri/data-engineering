export const globalNavigation=[
  {id:'desk',label:'Dashboard'},
  {id:'library',label:'Q&A library'},
  {id:'material',label:'Study material'},
  {id:'notes',label:'My notes'},
  {id:'plan',label:'30-day plan'},
  {id:'journal',label:'Progress'},
  {id:'settings',label:'Settings'}
];

export function navigationState(view){
  const activeId=view==='study'?'library':globalNavigation.some(item=>item.id===view)?view:'desk';
  return {activeId,ariaLabel:globalNavigation.find(item=>item.id===activeId).label};
}
