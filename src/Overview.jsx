import {ArrowRight,BarChart3,BookOpen,Check,Clock3,Code2,Database,FileText,Flame,Layers,Play,Server,Target,Zap} from 'lucide-react';
import {dashboardModel,weeklyChartPoints} from './dashboard-model.mjs';
import {today} from './store';

const icons={sql:Database,postgres:Server,python:Code2,pyspark:Zap,databricks:Layers,architecture:Layers};

function ProgressRing({value,label}){
  const bounded=Math.max(0,Math.min(100,value));
  return <div className="hud-progress-ring" aria-label={`${label}: ${bounded}%`}><svg viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="36"/><circle className="value" cx="44" cy="44" r="36" pathLength="100" strokeDasharray="100" strokeDashoffset={100-bounded}/></svg><strong>{bounded}%</strong></div>;
}

function ProgressChart({model}){
  const coordinates=weeklyChartPoints(model.week,model.targetMinutes).map(point=>`${point.x},${point.y}`).join(' ');
  return <div className="hud-line-chart" role="img" aria-label={`Weekly study activity, ${model.weeklyMinutes} minutes`}><svg viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="hud-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><path d={`M0 100 L${coordinates.replaceAll(' ',', L')} L600 110 L0 110 Z`} fill="url(#hud-area)"/><polyline points={coordinates} className="hud-chart-line"/></svg><div>{model.week.map(day=><span key={day.date}>{day.label}</span>)}</div></div>;
}

function WeekBars({model}){
  const max=Math.max(model.targetMinutes,...model.week.map(day=>day.minutes),1);
  return <div className="hud-week-bars" role="img" aria-label={model.week.map(day=>`${day.label}: ${day.minutes} minutes`).join(', ')}>{model.week.map(day=><div key={day.date}><span><i style={{height:`${Math.max(day.minutes?8:0,day.minutes/max*100)}%`}}/></span><small>{day.label}</small></div>)}</div>;
}

export default function Overview({data,current,onNavigate,onOpen,onStart}){
  const model=dashboardModel(data,today());
  const studied=new Set([...(data.progress.attempts||[]),...(data.progress.reviews||[])].map(item=>item.questionId));
  const currentQuestions=current.questionIds.map(id=>data.questions.find(question=>question.id===id)).filter(Boolean);
  const nextQuestions=[...currentQuestions.filter(question=>!studied.has(question.id)),...data.questions.filter(question=>!studied.has(question.id)&&!current.questionIds.includes(question.id))].slice(0,3);
  const targetPercent=Math.min(100,Math.round(model.todayMinutes/Math.max(model.targetMinutes,1)*100));
  return <div className="prep-dashboard">
    <header className="prep-dashboard-heading"><div><span>Good progress, let's keep building your interview readiness.</span><h1>Your Senior Data Engineer Prep</h1></div></header>

    <section className="hud-top-grid" aria-label="Today's preparation summary">
      <article className="hud-card hud-target-card"><div className="hud-card-title"><Clock3 size={21}/><strong>Today's Target</strong></div><p>{model.targetMinutes} minutes of focused preparation</p><div className="hud-target-body"><div><strong>{model.targetMinutes}<small>min</small></strong><button className="hud-primary" onClick={()=>onStart(current.subject,true)}><Play size={15} fill="currentColor"/>Start Study Session</button></div><ProgressRing value={targetPercent} label="Today's target completed"/></div></article>
      <article className="hud-card hud-streak-card"><div className="hud-card-title"><Flame size={21}/><strong>{model.streak?`${model.streak}-Day Streak`:'Start a streak'}</strong></div><p>{model.streak?'Keep the momentum!':'Today is a good day to begin.'}</p><strong className="hud-streak-value">{model.streak}<small>days</small></strong></article>
      <article className="hud-card hud-resume-card"><div className="hud-card-title"><FileText size={21}/><strong>Resume Study</strong></div><p>{current.topic}</p><button className="hud-secondary" onClick={()=>onNavigate('material',{materialDay:current.day,materialSectionId:null})}>Open Day {String(current.day).padStart(2,'0')} material <ArrowRight size={15}/></button></article>
    </section>

    <section className="hud-middle-grid">
      <article className="hud-card hud-progress-card"><div className="hud-card-title"><Target size={21}/><div><strong>30-Day Progress</strong><small>Overall interview readiness</small></div></div><div className="hud-progress-body"><strong>{model.overallPercent}%</strong><ProgressChart model={model}/></div></article>
      <article className="hud-card hud-activity-card"><div className="hud-card-title"><BarChart3 size={21}/><div><strong>Weekly Activity</strong><small>Study time in minutes</small></div><b>{model.weeklyMinutes} min</b></div><WeekBars model={model}/></article>
    </section>

    <section className="hud-bottom-grid">
      <article className="hud-card hud-readiness-card"><div className="hud-card-title"><Target size={21}/><div><strong>Readiness by Topic</strong><small>Your interview readiness across core areas</small></div></div><div className="hud-readiness-grid">{model.readiness.map(subject=>{const Icon=icons[subject.id]||Database;return <button key={subject.id} onClick={()=>onNavigate('library',{subject:subject.id,topic:'all',subtopic:'all',search:'',savedOnly:false})}><Icon size={20}/><strong>{subject.name}</strong><b>{subject.percent}%</b><span><i style={{width:`${subject.percent}%`}}/></span><small>{subject.completed}/{subject.total} studied</small></button>})}</div></article>
      <article className="hud-card hud-next-card"><div className="hud-card-title"><BookOpen size={21}/><div><strong>Next Interview Questions</strong><small>Practice these high-value questions next.</small></div></div><div className="hud-question-list">{nextQuestions.map((question,index)=><button key={question.id} onClick={()=>onOpen(question.id)}><span>{studied.has(question.id)?<Check size={13}/>:index+1}</span><div><strong>{question.title}</strong><small>{question.topic} · {question.minutes} min</small></div><ArrowRight size={15}/></button>)}</div><button className="hud-all-link" onClick={()=>onNavigate('library',{subject:'all',topic:'all',subtopic:'all',search:'',savedOnly:false})}>Open question library <ArrowRight size={14}/></button></article>
    </section>
  </div>;
}
