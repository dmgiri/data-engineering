import {useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowUpRight,Bookmark,Check,ChevronLeft,ChevronRight,Clock3,Maximize2,Minimize2} from 'lucide-react';
import {mutate,notify,patch,today} from './store';

export default function QuestionAnswer({data,questionId,onBack,onOpen,onTimer}){
  const dispatch=useDispatch(),focus=useSelector(state=>state.desk.focus),reduced=useReducedMotion();
  const [busy,setBusy]=useState(false);
  const q=data.questions.find(item=>item.id===questionId);
  if(!q)return <div className="empty">Choose a question from your library.</div>;
  const studied=[...data.progress.attempts,...(data.progress.reviews||[])].some(r=>r.questionId===q.id);
  const saved=data.progress.bookmarks.includes(q.id),subject=data.subjects.find(s=>s.id===q.subject);
  const pool=data.questions.filter(item=>item.subject===q.subject),index=pool.findIndex(item=>item.id===q.id);
  const examples=q.provenance?.kind==='imported-collection'&&q.provenance.examples?.length?q.provenance.examples:(q.code?[{language:q.language,code:q.code}]:[]);
  const references=[{url:q.sourceUrl}].filter(ref=>/^https?:\/\//i.test(ref.url||''));
  const markStudied=async()=>{setBusy(true);const saved=await mutate('/api/reviews','POST',{id:'studied:'+q.id,date:today(),questionId:q.id,createdAt:new Date().toISOString()});if(saved)notify('Marked as studied.');setBusy(false)};
  return <div className="qa-reader">
    <div className="study-top"><button className="text-button" onClick={onBack}><ChevronLeft size={16}/>Question library</button><div><span className="subject-tag">{subject?.name}</span><button className="subtle-button" onClick={()=>dispatch(patch({focus:!focus}))}>{focus?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {focus?'Exit focus':'Focus view'}</button></div></div>
    <article className="reading-main"><span className="eyebrow">{q.topic}<span>· {q.type} · {q.minutes} MIN READ</span></span><h1>{q.title}</h1>
      <p className="answer-subtopic">Subtopic: {q.subtopic||q.title}</p>
      <section className="question-block"><span className="qa-section-label">QUESTION</span><p className="question-prompt">{q.prompt}</p></section>
      {q.provenance?.kind==='imported-collection'&&q.provenance.description&&<p><strong>What this tests:</strong> {q.provenance.description}</p>}
      <motion.section className="worked-answer" initial={reduced?false:{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.18}}><div className="answer-heading"><span className="qa-section-label">ANSWER</span><button className={`icon-button save-question ${saved?'selected':''}`} aria-label={saved?'Unsave question':'Save question'} aria-pressed={saved} onClick={()=>mutate('/api/bookmarks/'+q.id,'POST',{})}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button></div><p>{q.answer[0]}</p>
        {q.answer.length>1&&<><h3 className="explanation-heading">Explanation & approach</h3>{q.answer.slice(1).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</>}
        {examples.map((example,i)=><div className="code-panel" key={i}><div>{example.language||'EXAMPLE'}<span>WORKED EXAMPLE</span></div><pre><code>{example.code}</code></pre></div>)}
        {q.pitfalls?.length>0&&<div className="pitfall"><strong>Key points to remember</strong>{q.pitfalls.map((point,i)=><p key={i}>{point}</p>)}</div>}
        {q.followups?.length>0&&<><h3>Related interview follow-ups</h3><ol>{q.followups.map((question,i)=><li key={i}>{question}</li>)}</ol></>}
        {references.length>0&&<div className="answer-references">{references.map((ref,i)=><a key={i} className="source-link" href={ref.url} target="_blank" rel="noreferrer">Technical reference{references.length>1?' '+(i+1):''} <ArrowUpRight size={14}/></a>)}</div>}
      </motion.section>
      <div className="qa-actions"><button className="primary-button mark-studied" disabled={busy||studied} aria-pressed={studied} onClick={markStudied}>{busy?'Saving…':studied?'Studied':'Mark as studied'}<Check size={16}/></button><button className="text-button" onClick={()=>onTimer(q.subject)}><Clock3 size={14}/>Start / pause timer</button></div>
      <nav className="qa-pagination" aria-label="Question navigation"><button disabled={index===0} onClick={()=>onOpen(pool[index-1].id)}><ChevronLeft size={16}/>Previous question</button><span>{index+1} of {pool.length}</span><button disabled={index===pool.length-1} onClick={()=>onOpen(pool[index+1].id)}>Next question<ChevronRight size={16}/></button></nav>
    </article>
  </div>;
}
