import {useState} from 'react';
import {ArrowRight,BookOpen,CalendarDays,Check,ChevronLeft,ChevronRight,Clock3,Code2,Database,Layers,Play,Server,Zap} from 'lucide-react';
import {studyMetrics} from './study-metrics.mjs';
import {today} from './store';

const icons={sql:Database,postgres:Server,python:Code2,pyspark:Zap,databricks:Layers,architecture:Layers};
const duration=n=>n<60?n+'m':Math.floor(n/60)+'h'+(n%60?' '+n%60+'m':'');
const reviewed=data=>new Set([...(data.progress.reviews||[]),...data.progress.attempts].map(r=>r.questionId));

export function SubjectCover({subject,compact=false}){
  const Icon=icons[subject]||Database;
  const snippets={sql:['SELECT *','JOIN'],postgres:['EXPLAIN','INDEX'],python:['def solve():','Python'],pyspark:['DataFrame','Spark'],databricks:['Delta Lake','MERGE'],architecture:['SYSTEM','DESIGN']};
  return <div className={`subject-cover cover-${subject} ${compact?'compact':''}`} aria-hidden="true"><div className="cover-orbit"/><div className="cover-grid"/><span className="cover-code top">{snippets[subject]?.[0]}</span><span className="cover-emblem"><Icon size={compact?52:62} strokeWidth={1.25}/></span><span className="cover-code bottom">{snippets[subject]?.[1]}</span></div>;
}

function StudyChart({metrics}){
  const max=Math.max(60,Math.ceil(Math.max(...metrics.days.map(d=>d.minutes))/30)*30);
  const pts=metrics.days.map((d,i)=>[12+i*326/Math.max(1,metrics.days.length-1),137-d.minutes/max*110]);
  const fill='M12,137 L'+pts.map(p=>p.join(',')).join(' L')+' L338,137 Z';
  return <div className="course-chart" role="img" aria-label={metrics.days.map(d=>d.date+': '+d.minutes+' minutes').join(', ')}>
    <div className="course-chart-y">{[max,Math.round(max*2/3),Math.round(max/3),0].map(n=><span key={n}>{n}m</span>)}</div>
    <div className="course-chart-plot"><svg viewBox="0 0 350 150" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="course-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#75a7dd" stopOpacity=".55"/><stop offset="100%" stopColor="#75a7dd" stopOpacity="0"/></linearGradient></defs>{[27,64,100,137].map(y=><line key={y} x1="0" x2="350" y1={y} y2={y} className="course-chart-grid"/>)}{metrics.minutes>0&&<path d={fill} fill="url(#course-chart-fill)"/>}<polyline points={pts.map(p=>p.join(',')).join(' ')} className="course-chart-line"/>{pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={metrics.days.length>7?1.5:2.5} className="course-chart-dot"/>)}</svg><span className="course-chart-tooltip">{duration(metrics.minutes)} studied</span><div className="course-chart-x">{metrics.days.filter((_,i)=>metrics.days.length===7||i%5===0||i===metrics.days.length-1).map(d=><span key={d.date}>{metrics.days.length===7?new Intl.DateTimeFormat('en-GB',{weekday:'narrow',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z')):d.date.slice(-2)}</span>)}</div></div>
  </div>;
}

export default function Overview({data,current,onNavigate,onOpen,onLog}){
  const [range,setRange]=useState(7),[selected,setSelected]=useState(current.day),[calendarOffset,setCalendarOffset]=useState(Math.floor((current.day-1)/14)*14);
  const day=data.plan.find(d=>d.day===selected)||current;
  const subject=data.subjects.find(s=>s.id===day.subject);
  const metrics=studyMetrics(data,range,'all',today()),studied=reviewed(data);
  const questions=day.questionIds.map(id=>data.questions.find(q=>q.id===id)).filter(Boolean);
  const next=questions.filter(q=>!studied.has(q.id)).slice(0,2);
  const nextQuestions=next.length?next:questions.slice(0,2);
  const calendar=data.plan.slice(calendarOffset,calendarOffset+14);
  const firstDate=new Date(calendar[0].date+'T12:00:00Z'),lastDate=new Date(calendar.at(-1).date+'T12:00:00Z');
  const month=calendar[0].date.slice(0,7)===calendar.at(-1).date.slice(0,7)?new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(firstDate):new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).formatRange(firstDate,lastDate);
  const weekdays=Array.from({length:7},(_,i)=>{const d=new Date(calendar[0].date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return new Intl.DateTimeFormat('en-GB',{weekday:'narrow',timeZone:'UTC'}).format(d)});
  const percent=Math.round(studied.size/data.questions.length*100);
  const selectDay=n=>{const bounded=Math.max(1,Math.min(30,n));setSelected(bounded);setCalendarOffset(Math.floor((bounded-1)/14)*14)};
  return <div className="course-dashboard">
    <div className="course-main">
      <div className="course-activity-row">
        <section className="activity-card"><div className="course-section-heading"><h2>Study activity</h2><select aria-label="Activity period" value={range} onChange={e=>setRange(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></div><StudyChart metrics={metrics}/><button className="activity-log" onClick={onLog}><Clock3 size={12}/>Log study time</button></section>
        <section className="running-card today-card"><span>Questions studied</span><strong>{studied.size}</strong><div><span><b>{data.questions.length}</b><small>Questions</small></span><div className="course-progress-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" className="progress-track"/><circle cx="40" cy="40" r="32" className="ring-value" strokeDasharray="201" strokeDashoffset={201*(1-percent/100)}/></svg><span>{percent}%</span></div></div></section>
      </div>
      <section className="continue-section"><div className="course-section-heading"><h2>Continue preparation</h2><button className="course-arrow" aria-label="Open daily plan" onClick={()=>onNavigate('plan')}><ChevronRight size={19}/></button></div><div className="continue-grid">{nextQuestions.map(q=>{const Icon=icons[q.subject];return <article className="continue-card" key={q.id}><div className="continue-card-top"><span className="continue-icon"><Icon size={20}/></span><div><strong>{q.topic}</strong><span>{subject?.name} · {q.minutes} min</span></div><span className="level-tag">{q.type}</span></div><h3>{q.title}</h3><button className="gradient-button" onClick={()=>onOpen(q.id)}>Read answer <ArrowRight size={14}/></button></article>})}</div></section>
      <section className="course-library-section"><div className="course-section-heading"><h2>Question library</h2><button className="text-button" onClick={()=>onNavigate('library',{subject:'all',topic:'all',search:'',savedOnly:false})}>View all <ChevronRight size={15}/></button></div><div className="course-grid">{data.subjects.map(s=>{const pool=data.questions.filter(q=>q.subject===s.id),done=pool.filter(q=>studied.has(q.id)).length;return <button className="course-card subject-card" key={s.id} onClick={()=>onNavigate('library',{subject:s.id,topic:'all',search:'',savedOnly:false})}><div className="course-cover-wrap"><SubjectCover subject={s.id}/><span className="course-level">Senior level</span></div><div className="course-card-meta"><span><BookOpen size={12}/>{pool.length} questions</span><span><Check size={12}/>{done} studied</span></div><h3>{s.name}</h3><p>{s.description}</p></button>})}</div></section>
    </div>
    <aside className="course-right-rail">
      <section className="mini-calendar"><div className="mini-calendar-heading"><button aria-label="Previous calendar period" disabled={calendarOffset===0} onClick={()=>setCalendarOffset(Math.max(0,calendarOffset-14))}><ChevronLeft size={18}/></button><strong>{month}</strong><button aria-label="Next calendar period" disabled={calendarOffset+14>=30} onClick={()=>setCalendarOffset(calendarOffset+14)}><ChevronRight size={18}/></button></div><div className="calendar-weekdays">{weekdays.map((w,i)=><span key={i}>{w}</span>)}</div><div className="mini-calendar-days">{calendar.map(d=><button key={d.day} className={d.day===selected?'selected':''} aria-label={'Study day '+d.day+', '+d.date} aria-pressed={d.day===selected} onClick={()=>selectDay(d.day)}>{d.date.slice(-2)}</button>)}</div></section>
      <section className="today-class-card"><div className="today-class-heading"><h2>{day.date===today()?"Today's study":'Selected study day'}</h2><div><button aria-label="Previous study day" disabled={selected===1} onClick={()=>selectDay(selected-1)}><ChevronLeft size={17}/></button><button aria-label="Next study day" disabled={selected===30} onClick={()=>selectDay(selected+1)}><ChevronRight size={17}/></button></div></div><SubjectCover subject={day.subject} compact/><div className="today-class-meta"><span><BookOpen size={12}/>{questions.length} questions</span><span><Clock3 size={12}/>{duration(day.minutes)}</span><span>Day {String(day.day).padStart(2,'0')}</span></div><h3>{subject?.name} interview preparation</h3><p>{day.topic}</p><div className="module-list-heading"><strong>Questions & answers</strong><span>{questions.filter(q=>studied.has(q.id)).length}/{questions.length} studied</span></div><div className="module-list">{questions.map((q,i)=><button key={q.id} onClick={()=>onOpen(q.id)}><span>{studied.has(q.id)?<Check size={12}/>:i+1}</span><strong>{q.title}</strong><small>{q.minutes}m</small></button>)}</div><button className="gradient-button" onClick={()=>onOpen(questions[0].id)}>Read questions & answers <ArrowRight size={14}/></button><button className="today-material-link" onClick={()=>onNavigate('material',{materialDay:day.day,materialSectionId:null})}>Open Day {String(day.day).padStart(2,'0')} study notes</button></section>
    </aside>
  </div>;
}
