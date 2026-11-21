const asUtc=date=>new Date(`${date}T12:00:00Z`);
const dateKey=date=>date.toISOString().slice(0,10);

export function weeklyChartPoints(week,targetMinutes,width=600){
  const denominator=Math.max(targetMinutes,1);
  const step=week.length>1?width/(week.length-1):0;
  return week.map((day,index)=>({x:index*step,y:96-Math.min(90,day.minutes/denominator*80)}));
}

export function dashboardModel(data,asOf){
  const reference=asUtc(asOf);
  const sessionMinutes=new Map();
  for(const session of data.progress.sessions||[])sessionMinutes.set(session.date,(sessionMinutes.get(session.date)||0)+session.minutes);
  const activeDates=new Set([
    ...sessionMinutes.keys(),
    ...(data.progress.attempts||[]).map(item=>item.date).filter(Boolean),
    ...(data.progress.reviews||[]).map(item=>item.date).filter(Boolean)
  ]);
  let streak=0,cursor=new Date(reference);
  while(activeDates.has(dateKey(cursor))){streak+=1;cursor.setUTCDate(cursor.getUTCDate()-1)}
  const studied=new Set([...(data.progress.attempts||[]),...(data.progress.reviews||[])].map(item=>item.questionId));
  const readiness=(data.subjects||[]).map(subject=>{
    const questions=(data.questions||[]).filter(question=>question.subject===subject.id);
    const completed=questions.filter(question=>studied.has(question.id)).length;
    return {...subject,total:questions.length,completed,percent:questions.length?Math.round(completed/questions.length*100):0};
  });
  const week=Array.from({length:7},(_,index)=>{
    const date=new Date(reference);date.setUTCDate(date.getUTCDate()-(6-index));
    const key=dateKey(date);
    return {date:key,label:new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(date),minutes:sessionMinutes.get(key)||0};
  });
  const day=reference.getUTCDay();
  return {
    targetMinutes:day===0||day===6?data.settings.weekendMinutes:data.settings.weekdayMinutes,
    todayMinutes:sessionMinutes.get(asOf)||0,
    streak,
    overallPercent:data.questions.length?Math.round(studied.size/data.questions.length*100):0,
    readiness,
    week,
    weeklyMinutes:week.reduce((sum,item)=>sum+item.minutes,0)
  };
}
