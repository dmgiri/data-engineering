import {Children,useEffect,useMemo,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ArrowLeft,ArrowRight,BookOpen,Check,ChevronDown,ChevronRight,FileText,Home,Info,LibraryBig,Moon,PanelLeft,PanelLeftClose,PanelLeftOpen,Search,Sun,X} from 'lucide-react';
import {mutate} from './store';

const pad=value=>String(value).padStart(2,'0');

function Markdown({children}){
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a:({href='',...props})=><a href={href} {...(/^https?:/i.test(href)?{target:'_blank',rel:'noreferrer'}:{})} {...props}/>,
    table:props=><div className="material-table-wrap"><table {...props}/></div>,
    pre:props=><pre className="material-code" {...props}/>,
    p:({node,children:paragraph})=>{
      const first=node?.children?.[0],label=first?.tagName==='strong'?first.children?.map(item=>item.value||'').join('').trim():'';
      const match=label.match(/^(Notes?|Tip|Important|Warning)\.$/i);
      if(!match)return <p>{paragraph}</p>;
      const kind=/warning/i.test(label)?'warning':/important/i.test(label)?'important':/tip/i.test(label)?'tip':'note';
      return <aside className={`material-callout ${kind}`} role="note"><strong><Info size={15}/>{match[1].replace(/s$/i,'').toUpperCase()}</strong><p>{Children.toArray(paragraph).slice(1)}</p></aside>;
    }
  }}>{children}</ReactMarkdown>;
}

export default function StudyMaterial({data,initialDay,initialSectionId,onExit,onTheme,onNavigate}){
  const material=data.materials?.[0];
  if(!material)return null;
  const completed=useMemo(()=>new Set((data.progress.materialSections||[]).filter(item=>item.completed).map(item=>item.sectionId)),[data.progress.materialSections]);
  const saved=data.progress.materialState;
  const startingDay=Math.max(1,Math.min(30,initialDay||saved?.day||1));
  const firstDay=material.days.find(day=>day.day===startingDay)||material.days[0];
  const requestedSection=initialSectionId||(initialDay?null:saved?.sectionId);
  const firstSection=firstDay.sections.find(section=>section.id===requestedSection)||firstDay.sections[0];
  const [dayNumber,setDayNumber]=useState(firstDay.day);
  const [sectionId,setSectionId]=useState(firstSection.id);
  const [resourceId,setResourceId]=useState(null);
  const [query,setQuery]=useState('');
  const [chaptersOpen,setChaptersOpen]=useState(false);
  const [indexCollapsed,setIndexCollapsed]=useState(false);
  const [compactNav,setCompactNav]=useState(()=>window.matchMedia('(max-width: 899px)').matches);
  const [expandedGroups,setExpandedGroups]=useState(()=>[firstDay.group]);
  const drawerRef=useRef(null),triggerRef=useRef(null);
  useEffect(()=>{
    mutate('/api/material-state','PUT',{materialId:material.id,day:firstDay.day,sectionId:firstSection.id});
  },[material.id,firstDay.day,firstSection.id]);
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 899px)'),change=event=>{setCompactNav(event.matches);if(event.matches)setIndexCollapsed(false);else setChaptersOpen(false)};
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    if(!compactNav||!chaptersOpen)return;
    const close=event=>{if(event.key==='Escape')setChaptersOpen(false)};
    window.addEventListener('keydown',close);
    requestAnimationFrame(()=>drawerRef.current?.querySelector('input')?.focus());
    return()=>{window.removeEventListener('keydown',close);triggerRef.current?.focus()};
  },[chaptersOpen,compactNav]);
  const day=material.days.find(item=>item.day===dayNumber)||material.days[0];
  const section=day.sections.find(item=>item.id===sectionId)||day.sections[0];
  const resource=material.resources.find(item=>item.id===resourceId);
  const allSections=material.days.flatMap(item=>item.sections.map(sectionItem=>({day:item,section:sectionItem})));
  const activeIndex=allSections.findIndex(item=>item.section.id===section.id);
  const previous=activeIndex>0?allSections[activeIndex-1]:null;
  const next=activeIndex<allSections.length-1?allSections[activeIndex+1]:null;
  const normalizedQuery=query.trim().toLocaleLowerCase();
  const filteredDays=material.days.filter(item=>!normalizedQuery||[item.title,item.group,...item.sections.flatMap(sectionItem=>[sectionItem.title,sectionItem.markdown])].join(' ').toLocaleLowerCase().includes(normalizedQuery));
  const progress=completed.size?Math.max(1,Math.round(completed.size/allSections.length*100)):0;
  const openSection=(nextDay,nextSection)=>{
    setDayNumber(nextDay.day);setSectionId(nextSection.id);setResourceId(null);setChaptersOpen(false);setExpandedGroups(current=>current.includes(nextDay.group)?current:[...current,nextDay.group]);
    mutate('/api/material-state','PUT',{materialId:material.id,day:nextDay.day,sectionId:nextSection.id});
    window.scrollTo(0,0);
  };
  const openDay=nextDay=>openSection(nextDay,nextDay.sections.find(item=>!completed.has(item.id))||nextDay.sections[0]);
  const openResource=id=>{setResourceId(id);setChaptersOpen(false);window.scrollTo(0,0)};
  const groups=[...new Set(filteredDays.map(item=>item.group))];
  const toggleGroup=(group,open)=>setExpandedGroups(current=>open?[...new Set([...current,group])]:current.filter(item=>item!==group));
  return <div className="material-page">
    <header className="material-docs-bar">
      <button className="material-docs-home" onClick={onExit} aria-label="Back to Engineer Prep dashboard"><span>E</span><strong>Engineer Prep</strong></button>
      <nav className="material-docs-mainnav" aria-label="Primary documentation navigation"><button onClick={()=>onNavigate('desk')}>Dashboard</button><button onClick={()=>onNavigate('library',{subject:'all',topic:'all',search:'',savedOnly:false})}>Questions</button><button className="active">Study material</button><button onClick={()=>onNavigate('notes')}>My notes</button><button onClick={()=>onNavigate('plan')}>Study plan</button><button onClick={()=>onNavigate('journal')}>Progress</button></nav>
      <div className="material-docs-actions">
        <button className="material-docs-theme" aria-label={`Use ${data.settings.theme==='dark'?'light':'dark'} mode`} onClick={onTheme}>{data.settings.theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
        <button ref={triggerRef} className="material-chapter-trigger" aria-expanded={chaptersOpen} aria-controls="material-course-drawer" onClick={()=>setChaptersOpen(true)}><PanelLeft size={17}/><span>Course index</span></button>
        <button type="button" className="workspace-close-button" data-action="close-material" aria-label="Close study material and return to dashboard" onClick={onExit}><X size={18}/><span>Close</span></button>
      </div>
      <div className="material-docs-progress" aria-label={`${completed.size} of ${allSections.length} checkpoints complete`}><span style={{width:`${progress}%`}}/></div>
    </header>
    <div className="material-context-bar"><span>30-day Data Engineering interview workbook</span><div><span>{completed.size} / {allSections.length} complete</span><i/><span>Saved locally</span></div></div>

    {compactNav&&chaptersOpen&&<button className="material-drawer-backdrop" aria-label="Close course index" onClick={()=>setChaptersOpen(false)}/>}
    <div className={`material-docs-body ${indexCollapsed?'index-collapsed':''}`}>
    <aside ref={drawerRef} id="material-course-drawer" className={`material-navigator ${chaptersOpen?'open':''}`} role={compactNav?'dialog':'navigation'} aria-modal={compactNav||undefined} aria-label="Course index" aria-hidden={compactNav&&!chaptersOpen} inert={(compactNav&&!chaptersOpen)||undefined}>
      <div className="material-drawer-heading"><div><span>30-DAY WORKBOOK</span><strong>{completed.size} / {allSections.length} complete</strong></div><button className="material-index-toggle" aria-label={indexCollapsed?'Expand course index':'Collapse course index'} aria-expanded={!indexCollapsed} aria-controls="material-course-tree" onClick={()=>setIndexCollapsed(value=>!value)}>{indexCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="material-drawer-close" aria-label="Close course index" onClick={()=>setChaptersOpen(false)}><X size={19}/></button></div>
      <div id="material-course-tree" className="material-index-content">
      <label className="material-search"><Search size={16}/><input id="material-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search days and notes" aria-label="Search study material"/></label>
      <div className="material-day-list">
        {groups.map(group=><details key={group} data-group={group} className="material-group" open={normalizedQuery?true:expandedGroups.includes(group)} onToggle={event=>{if(!normalizedQuery)toggleGroup(group,event.currentTarget.open)}}><summary><ChevronRight size={14}/><span>{group}</span></summary><div>{filteredDays.filter(item=>item.group===group).map(item=>{
          const done=item.sections.filter(sectionItem=>completed.has(sectionItem.id)).length;
          const selected=!resource&&item.day===day.day;
          return <div className={`material-day-entry ${selected?'selected':''}`} key={item.id}>
            <button className="material-day-button" aria-current={selected?'page':undefined} onClick={()=>openDay(item)}><span>{pad(item.day)}</span><div><strong>{item.title}</strong><small>{done}/{item.sections.length} complete</small></div>{done===item.sections.length?<Check size={15}/>:<ChevronRight size={15}/>}</button>
            {selected&&<div className="material-section-list">{item.sections.map((sectionItem,index)=><button key={sectionItem.id} data-section={sectionItem.id} className={sectionItem.id===section.id?'active':''} onClick={()=>openSection(item,sectionItem)}><span>{completed.has(sectionItem.id)?<Check size={11}/>:index+1}</span><strong>{sectionItem.title}</strong></button>)}</div>}
          </div>;
        })}</div></details>)}
        {!filteredDays.length&&<div className="material-empty"><Search size={20}/><strong>No matching study day</strong><span>Try a topic such as joins, watermarks, or incident response.</span></div>}
      </div>
      <details className="material-resources"><summary><FileText size={15}/>Reference appendix <ChevronDown size={14}/></summary>{material.resources.map(item=><button key={item.id} className={resource?.id===item.id?'active':''} onClick={()=>openResource(item.id)}>{item.title}</button>)}</details>
      </div>
    </aside>

    <div className="material-docs-canvas">
      <nav className="material-docs-path" aria-label="Current lesson"><button onClick={onExit} aria-label="Dashboard"><Home size={14}/></button><ChevronRight size={12}/><button onClick={()=>setChaptersOpen(true)}>30-day interview workbook</button><ChevronRight size={12}/><span>{resource?'Reference appendix':`Day ${pad(day.day)}`}</span></nav>
      <div className={`material-workspace ${resource?'resource-open':''}`}>
        <article className="material-reader">
          {resource?<>
            <div className="material-reader-meta"><span>REFERENCE APPENDIX</span><button className="text-button" onClick={()=>setResourceId(null)}><ArrowLeft size={14}/>Back to Day {pad(day.day)}</button></div>
            <h1>{resource.title}</h1>
            <div className="material-markdown"><Markdown>{resource.markdown}</Markdown></div>
          </>:<>
            <div className="material-reader-meta"><span>{day.group} · DAY {pad(day.day)}</span><span>{day.sections.filter(item=>completed.has(item.id)).length}/{day.sections.length} COMPLETE</span></div>
            <h1>{day.title}</h1>
            <div className="material-section-title"><span>{section.order===0?'DAY BRIEFING':`CHECKPOINT ${pad(section.order)}`}</span><h2>{section.title}</h2></div>
            <div className="material-markdown"><Markdown>{section.markdown}</Markdown></div>
            <div className="material-reader-actions">
              <button data-action="toggle-material-complete" className={completed.has(section.id)?'material-complete-button completed':'material-complete-button'} aria-pressed={completed.has(section.id)} onClick={()=>mutate('/api/material-progress/'+section.id,'PUT',{completed:!completed.has(section.id)})}>{completed.has(section.id)?<><Check size={16}/>Completed</>:<><BookOpen size={16}/>Mark checkpoint complete</>}</button>
              <div><button disabled={!previous} onClick={()=>previous&&openSection(previous.day,previous.section)}><ArrowLeft size={15}/>Previous</button><button disabled={!next} onClick={()=>next&&openSection(next.day,next.section)}>Next<ArrowRight size={15}/></button></div>
            </div>
          </>}
        </article>
        {!resource&&<aside className="material-on-page" aria-label="On this day"><h2>On this day</h2><div>{day.sections.map((item,index)=><button key={item.id} className={item.id===section.id?'active':''} onClick={()=>openSection(day,item)}><span>{completed.has(item.id)?<Check size={10}/>:index+1}</span>{item.title}</button>)}</div><section><LibraryBig size={15}/><span>Course progress</span><strong>{completed.size} of {allSections.length}</strong><div><i style={{width:`${progress}%`}}/></div></section></aside>}
      </div>
    </div>
    </div>
  </div>;
}
