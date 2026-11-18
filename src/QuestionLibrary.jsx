import {useDispatch,useSelector} from 'react-redux';
import {Bookmark,Database,Search} from 'lucide-react';
import {patch} from './store';
import {filterQuestions} from './library-filters.mjs';

export default function QuestionLibrary({data,renderQuestion,renderSubjectIcon}){
  const state=useSelector(s=>s.desk),dispatch=useDispatch();
  const scoped=filterQuestions(data.questions,{subject:state.subject});
  const topics=[...new Set(scoped.map(q=>q.topic))].sort();
  const subtopics=[...new Set(scoped.filter(q=>state.topic==='all'||q.topic===state.topic).map(q=>q.subtopic||q.title))].sort();
  const result=filterQuestions(data.questions,{...state,sourceKind:'all'},data.progress.bookmarks);
  const change=changes=>dispatch(patch(changes));
  return <>
    <div className="page-heading"><div><span className="eyebrow">THE QUESTION LIBRARY</span><h1>Questions & answers<span>.</span></h1><p>Clear answers, detailed explanations, and worked examples.</p></div><span className="month-chip"><Database size={14}/>{data.questions.length} QUESTIONS IN SQLITE</span></div>
    <div className="subject-filters">{[{id:'all',name:'All subjects'},...data.subjects].map(s=><button key={s.id} className={state.subject===s.id?'active':''} onClick={()=>change({subject:s.id,topic:'all',subtopic:'all'})}>{s.id!=='all'&&renderSubjectIcon(s.id)} {s.name}<small>{filterQuestions(data.questions,{subject:s.id}).length}</small></button>)}</div>
    <div className="library-controls"><label><Search size={17}/><input id="library-search" placeholder="Search questions, answers, explanations…" value={state.search} onChange={e=>change({search:e.target.value})}/></label><button className={`subtle-button ${state.savedOnly?'selected':''}`} aria-pressed={state.savedOnly} onClick={()=>change({savedOnly:!state.savedOnly})}><Bookmark size={15}/>Saved</button></div>
    <div className="topic-controls"><label>Topic<select aria-label="Filter by topic" value={state.topic} onChange={e=>change({topic:e.target.value,subtopic:'all'})}><option value="all">All topics</option>{topics.map(t=><option key={t}>{t}</option>)}</select></label><label>Subtopic<select aria-label="Filter by subtopic" value={state.subtopic} onChange={e=>change({subtopic:e.target.value})}><option value="all">All subtopics</option>{subtopics.map(t=><option key={t}>{t}</option>)}</select></label></div>
    <div className="list-caption">{result.length} questions <span>Combine subject, topic and subtopic filters.</span></div>
    <div className="question-list section-panel">{result.map((q,i)=>renderQuestion(q,i+1))}{!result.length&&<div className="empty"><Search size={25}/><h3>No questions match this view.</h3><p>Try another subject or clear your filters.</p></div>}</div>
  </>;
}
