export function studyMetrics(data,range=7,subject='all',endDate){
  const dates=Array.from({length:range},(_,index)=>{
    const day=new Date(endDate+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-(range-index-1));
    return day.toISOString().slice(0,10);
  });
  const sessions=data.progress.sessions.filter(s=>dates.includes(s.date)&&(subject==='all'||s.subject===subject));
  const days=dates.map(date=>({date,minutes:sessions.filter(s=>s.date===date).reduce((sum,s)=>sum+s.minutes,0)}));
  return {days,minutes:days.reduce((sum,d)=>sum+d.minutes,0),activeDays:days.filter(d=>d.minutes>0).length,
    attempts:[...data.progress.attempts,...(data.progress.reviews||[])].filter(a=>dates.includes(a.date)&&(subject==='all'||data.questions.find(q=>q.id===a.questionId)?.subject===subject)).length};
}
