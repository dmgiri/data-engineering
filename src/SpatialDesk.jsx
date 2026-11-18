import {BookOpen,ArrowUpRight,ArrowRight,Clock3,Play,Plus,Check,Database,Server,Code2,Zap,Layers,Target,CalendarDays,RotateCcw,ChevronRight} from 'lucide-react';
import {today} from './store';

const icons={sql:Database,postgres:Server,python:Code2,pyspark:Zap,databricks:Layers};
const duration=n=>n<60?`${n}m`:`${Math.floor(n/60)}h${n%60?` ${n%60}m`:''}`;
const total=(data,date=today())=>data.progress.sessions.filter(s=>s.date===date).reduce((n,s)=>n+s.minutes,0);

export default function SpatialDesk({data,current,dayComplete,onOpen,onNavigate,onStart,onLog}){
  const subject=data.subjects.find(s=>s.id===current.subject);
  const studied=total(data),remaining=Math.max(0,current.minutes-studied);
  const practiced=new Set(data.progress.attempts.map(a=>a.questionId));
  const latest={};data.progress.attempts.forEach(a=>latest[a.questionId]=a);
  const due=data.questions.filter(q=>latest[q.id]&&latest[q.id].nextReview<=today());
  const queue=due.length?due:current.questionIds.map(id=>data.questions.find(q=>q.id===id)).filter(Boolean);
  const days=Array.from({length:7},(_,i)=>{const day=new Date(Date.now()-(6-i)*86400000);return {date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(day),label:new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'Asia/Kolkata'}).format(day)}});
  const max=Math.max(current.minutes,...days.map(d=>total(data,d.date)));
  return <>
    <div className="room-heading"><div><span className="room-kicker">YOUR PERSONAL STUDY SPACE</span><h1>Quiet space. Clear thinking.</h1></div><div className="room-date"><span className="live-dot"/>DAY {String(current.day).padStart(2,'0')} OF 30<span className="room-date-divider"/>{new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Kolkata'}).format(new Date())}</div></div>
    <div className="spatial-layout">
      <div className="control-surface">
        <section className="smoke-card daily-control">
          <div className="control-title"><div><i className="online-light"/>Daily focus</div><button className="switch-control" aria-label="Start or pause focus session" onClick={()=>onStart(current.subject)}><span/></button></div>
          <p className="control-subtitle">A little deeper, every day.</p>
          <div className="focus-instrument"><div className="instrument-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle className="ring-track" cx="90" cy="90" r="76"/><circle className="ring-value" cx="90" cy="90" r="76" strokeDasharray={`${Math.min(1,remaining/current.minutes)*350} 477.5`}/></svg><div><strong>{remaining}<small>min</small></strong><span>{remaining?'remaining today':'Daily target met'}</span></div></div></div>
          <div className="focus-caption"><span>{duration(studied)} recorded</span><span>{duration(current.minutes)} target</span></div>
          <div className="control-actions"><button className="blue-control" onClick={()=>onStart(current.subject)}><Play size={17}/><span>Focus</span></button><button onClick={onLog}><Plus size={18}/><span>Log time</span></button><button onClick={()=>onNavigate('journal')}><Clock3 size={17}/><span>Records</span></button></div>
        </section>

        <section className="today-card room-hero">
          <div className="room-hero-image" aria-hidden="true"/>
          <div className="room-hero-top"><span className="live-badge"><i/>Study room</span><div className="hero-status"><span><Database size={13}/>Local SQLite</span><span><BookOpen size={13}/>{data.questions.length} questions</span></div></div>
          <div className="room-hero-copy"><span className="eyebrow">TODAY'S DEEP WORK · {current.questionIds.length} QUESTIONS</span><h2>{subject?.name}</h2><h3>{current.topic}</h3><p>Think it through. Write it down. Explain the trade-offs.</p></div>
          <div className="room-hero-bottom"><button className="white-pill" onClick={()=>{onOpen(current.questionIds[0]);onStart(current.subject,true)}}>Enter study mode <ArrowUpRight size={15}/></button><button className="hero-plan-button" onClick={()=>onNavigate('plan')}>Today's plan <ArrowRight size={14}/></button><span><Clock3 size={13}/>{duration(current.minutes)}</span></div>
        </section>

        <section className="smoke-card commitment-control"><div className="control-title">The commitment <CalendarDays size={16}/></div><div className="commitment-value">{String(dayComplete).padStart(2,'0')}<span>/ 30 days</span></div><div className="thin-progress"><span style={{width:`${dayComplete/30*100}%`}}/></div><p>One hour on weekdays.<br/>{duration(data.settings.weekendMinutes*2)} across the weekend.</p><div className="commitment-footer"><span><Check size={12}/>{practiced.size} practiced</span><button aria-label="Open the thirty-day plan" onClick={()=>onNavigate('plan')}><ArrowUpRight size={17}/></button></div></section>

        <section className="smoke-card subjects-control"><div className="control-title">Your subjects <span className="control-micro">7+ YEARS · SENIOR</span></div><div className="subject-grid">{data.subjects.map(s=>{const Icon=icons[s.id];const done=new Set(data.progress.attempts.filter(a=>data.questions.find(q=>q.id===a.questionId)?.subject===s.id).map(a=>a.questionId)).size;return <button key={s.id} className={`subject-card ${s.id===current.subject?'is-today':''}`} onClick={()=>onNavigate('library',{subject:s.id,topic:'all',search:''})}><span className="subject-symbol"><Icon size={17}/></span><span><strong>{s.name}</strong><small>{done} / {data.questions.filter(q=>q.subject===s.id).length} practiced</small></span><ChevronRight size={13}/></button>})}</div></section>

        <section className="smoke-card activity-control"><div className="control-title">Study activity <Clock3 size={15}/></div><p className="control-subtitle">Actual time. Honest progress.</p><div className="activity-total">{duration(days.reduce((n,d)=>n+total(data,d.date),0))}<small>this week</small></div><div className="week-chart" role="img" aria-label={days.map(d=>`${d.date}: ${total(data,d.date)} minutes`).join(', ')}>{days.map((d,i)=><div className={`week-column ${i===6?'current':''}`} key={d.date}><span className="week-bar-track"><span style={{height:`${Math.min(100,total(data,d.date)/max*100)}%`}}/></span><small>{d.label.slice(0,1)}</small></div>)}</div><button className="activity-records" onClick={()=>onNavigate('journal')}>Open journal <ArrowUpRight size={13}/></button></section>
      </div>

      <aside className="smoke-card revision-panel"><div className="revision-heading"><div><h2>{due.length?'Ready to revisit':'Your study queue'}</h2><span>{due.length?'Scheduled revision':'Today’s interview practice'}</span></div><button className="icon-button" aria-label="Open question library" onClick={()=>onNavigate('library')}><ArrowUpRight size={15}/></button></div><div className="revision-list">{queue.map((q,i)=>{const Icon=icons[q.subject];return <button className="revision-question" key={q.id} onClick={()=>onOpen(q.id)}><span className={`queue-avatar tone-${i%4}`}><Icon size={18}/></span><span><strong>{q.topic}</strong><span>{q.title}</span><small>{q.minutes} min · {practiced.has(q.id)?'Practiced':'Not attempted'}</small></span><ArrowUpRight size={13}/></button>})}</div><button className="queue-library" onClick={()=>onNavigate('library')}>Explore all {data.questions.length} questions <ArrowRight size={14}/></button><div className="revision-note"><RotateCcw size={17}/><p>Recall before you reveal.<br/><span>Read the answer after your own attempt.</span></p></div><div className="local-storage-note"><span className="online-light"/><span>Progress saved to SQLite<br/><small>On your machine. Always yours.</small></span></div></aside>
    </div>
    <div className="room-bottom-note"><span>DESIGNED FOR DEEP WORK</span><span>SQL · PostgreSQL · Python · PySpark · Databricks</span></div>
  </>;
}
