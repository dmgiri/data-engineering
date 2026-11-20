import {useEffect,useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {Bookmark,ChevronLeft,ChevronRight,Database,Search} from 'lucide-react';
import {patch} from './store';
import {filterQuestions} from './library-filters.mjs';
import {paginate,pageTokens} from './pagination.mjs';

const PAGE_SIZE=20;

export default function QuestionLibrary({data,renderQuestion,renderSubjectIcon}){
  const state=useSelector(s=>s.desk),dispatch=useDispatch();
  const [requestedPage,setPage]=useState(1);
  const scoped=filterQuestions(data.questions,{subject:state.subject});
  const topics=[...new Set(scoped.map(q=>q.topic))].sort();
  const subtopics=[...new Set(scoped.filter(q=>state.topic==='all'||q.topic===state.topic).map(q=>q.subtopic||q.title))].sort();
  const result=filterQuestions(data.questions,{...state,sourceKind:'all'},data.progress.bookmarks);
  const pageData=paginate(result,requestedPage,PAGE_SIZE);
  const tokens=pageTokens(pageData.page,pageData.pageCount);
  const change=changes=>{setPage(1);dispatch(patch(changes));};
  useEffect(()=>{if(requestedPage!==pageData.page)setPage(pageData.page);},[requestedPage,pageData.page]);
  return <>
    <div className="page-heading"><div><span className="eyebrow">THE QUESTION LIBRARY</span><h1>Questions & answers<span>.</span></h1><p>Clear answers, detailed explanations, and worked examples.</p></div><span className="month-chip"><Database size={14}/>{data.questions.length} QUESTIONS IN SQLITE</span></div>
    <div className="subject-filters">{[{id:'all',name:'All subjects'},...data.subjects].map(s=><button key={s.id} className={state.subject===s.id?'active':''} onClick={()=>change({subject:s.id,topic:'all',subtopic:'all'})}>{s.id!=='all'&&renderSubjectIcon(s.id)} {s.name}<small>{filterQuestions(data.questions,{subject:s.id}).length}</small></button>)}</div>
    <div className="library-controls"><label><Search size={17}/><input id="library-search" placeholder="Search questions, answers, explanations…" value={state.search} onChange={e=>change({search:e.target.value})}/></label><button className={`subtle-button ${state.savedOnly?'selected':''}`} aria-pressed={state.savedOnly} onClick={()=>change({savedOnly:!state.savedOnly})}><Bookmark size={15}/>Saved</button></div>
    <div className="topic-controls"><label>Topic<select aria-label="Filter by topic" value={state.topic} onChange={e=>change({topic:e.target.value,subtopic:'all'})}><option value="all">All topics</option>{topics.map(t=><option key={t}>{t}</option>)}</select></label><label>Subtopic<select aria-label="Filter by subtopic" value={state.subtopic} onChange={e=>change({subtopic:e.target.value})}><option value="all">All subtopics</option>{subtopics.map(t=><option key={t}>{t}</option>)}</select></label></div>
    <div className="list-caption">{pageData.total?`Showing ${pageData.start+1}–${pageData.end} of ${pageData.total} questions`:'0 questions'} <span>Combine subject, topic and subtopic filters.</span></div>
    <div className="question-list section-panel">{pageData.items.map((q,i)=>renderQuestion(q,pageData.start+i+1))}{!pageData.total&&<div className="empty"><Search size={25}/><h3>No questions match this view.</h3><p>Try another subject or clear your filters.</p></div>}</div>
    {pageData.pageCount>1&&<nav className="library-pagination" aria-label="Question pages">
      <button type="button" data-action="library-prev-page" disabled={pageData.page===1} onClick={()=>setPage(pageData.page-1)} aria-label="Previous question page"><ChevronLeft size={16}/><span>Previous</span></button>
      <div className="library-page-numbers">{tokens.map((token,index)=>token==='ellipsis'
        ?<span className="library-page-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
        :<button type="button" data-page={token} className={token===pageData.page?'current':''} aria-current={token===pageData.page?'page':undefined} aria-label={`Go to question page ${token}`} onClick={()=>setPage(token)} key={token}>{token}</button>)}</div>
      <button type="button" data-action="library-next-page" disabled={pageData.page===pageData.pageCount} onClick={()=>setPage(pageData.page+1)} aria-label="Next question page"><span>Next</span><ChevronRight size={16}/></button>
    </nav>}
  </>;
}
