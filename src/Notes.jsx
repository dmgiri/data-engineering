import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,Code2,FilePlus2,FileText,FolderPlus,Image,Link2,Maximize2,Moon,MoreHorizontal,Move,NotebookTabs,Palette,PanelLeftClose,PanelLeftOpen,Pencil,Plus,Save,Search,Sun,Table2,Trash2,Type,X} from 'lucide-react';
import {mutate,notify,uid} from './store';
import {clipboardImage,validateNoteImage} from './note-image-clipboard.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const blockSize={text:[600,150],link:[600,180],image:[600,320],table:[620,250],code:[680,340]};
const layoutFor=(type,x=28,y=24,z=0)=>{const [width,height]=blockSize[type]||blockSize.text;return {x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y)),width,height,z}};
const newTextBlock=layout=>({id:uid(),type:'text',text:'',...(layout&&{layout})});
const blockFor=(type,layout)=>({...((type==='link'?{id:uid(),type,label:'',url:''}:type==='image'?{id:uid(),type,name:'',alt:'',dataUrl:''}:type==='table'?{id:uid(),type,rows:[['',''],['','']]}:type==='code'?{id:uid(),type,language:'sql',code:''}:newTextBlock())),...(layout&&{layout})});
const hydrateNote=note=>{let nextY=24;return {...copy(note),blocks:note.blocks.filter(block=>block.type!=='text'||block.text.trim()).map((block,index)=>{const layout=block.layout||layoutFor(block.type,28,nextY,index);nextY=Math.max(nextY,layout.y+layout.height+24);return {...block,layout}})}};
const newPage=(sectionId,order)=>({id:uid(),sectionId,order,title:'',createdAt:new Date().toISOString(),blocks:[newTextBlock(layoutFor('text'))]});
const safeLink=value=>{try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?value:null}catch{return null}};
const shortDate=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
const shortTime=value=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(value));
const sectionColors=['#7c4dff','#0a84ff','#ff4d67','#ec00a9','#ff9f0a','#30b0c7','#34c759','#8e8e93'];
const codeLanguages=['sql','postgresql','python','pyspark','scala','json','bash','text'];

export default function Notes({data,onExit,onTheme}){
  const sections=data.noteSections||[];
  const notes=data.notes||[];
  const firstSection=notes[0]?.sectionId||sections[0]?.id||null;
  const [query,setQuery]=useState('');
  const [selectedSectionId,setSelectedSectionId]=useState(firstSection);
  const [selectedId,setSelectedId]=useState(notes.find(note=>note.sectionId===firstSection)?.id||null);
  const [draft,setDraft]=useState(()=>selectedId?hydrateNote(notes.find(note=>note.id===selectedId)):null);
  const [dirty,setDirty]=useState(false);
  const [selectedBlockId,setSelectedBlockId]=useState(null);
  const [sectionsPaneCollapsed,setSectionsPaneCollapsed]=useState(false);
  const [sectionMenu,setSectionMenu]=useState(null);
  const [colorMenu,setColorMenu]=useState(null);
  const blockRefs=useRef(new Map());
  const focusBlockId=useRef(null);
  const temporaryBlockIds=useRef(new Set());
  const interactionCleanup=useRef(()=>{});
  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    if(!value)return notes;
    return notes.filter(note=>`${note.title} ${note.blocks.map(block=>block.text||block.label||block.alt||block.code||(block.rows||[]).flat().join(' ')||'').join(' ')}`.toLowerCase().includes(value));
  },[notes,query]);
  const selectedSection=sections.find(section=>section.id===selectedSectionId)||sections[0]||null;
  const selectedPages=filtered.filter(note=>note.sectionId===selectedSection?.id);
  const saved=notes.some(note=>note.id===selectedId);
  const canvasSize=useMemo(()=>({
    width:Math.max(1100,...(draft?.blocks||[]).map(block=>block.layout.x+block.layout.width+120)),
    height:Math.max(900,...(draft?.blocks||[]).map(block=>block.layout.y+block.layout.height+160))
  }),[draft?.blocks]);
  useEffect(()=>{
    if(selectedSectionId&&!sections.some(section=>section.id===selectedSectionId))setSelectedSectionId(sections[0]?.id||null);
  },[sections,selectedSectionId]);
  useEffect(()=>{
    if(dirty)return;
    const note=notes.find(item=>item.id===selectedId);
    if(note){setDraft(hydrateNote(note));setSelectedSectionId(note.sectionId)}
    else if(selectedId){const fallback=notes.find(item=>item.sectionId===selectedSectionId)||notes[0]||null;setSelectedId(fallback?.id||null);setDraft(fallback?hydrateNote(fallback):null);if(fallback)setSelectedSectionId(fallback.sectionId)}
  },[notes,selectedId,selectedSectionId,dirty]);
  useEffect(()=>{if(!selectedBlockId||focusBlockId.current!==selectedBlockId)return;const frame=requestAnimationFrame(()=>{blockRefs.current.get(selectedBlockId)?.querySelector('textarea,input,select')?.focus();focusBlockId.current=null});return()=>cancelAnimationFrame(frame)},[selectedBlockId,draft?.blocks.length]);
  useEffect(()=>()=>interactionCleanup.current(),[]);
  const confirmDiscard=()=>!dirty||window.confirm('Discard unsaved page changes?');
  const selectSection=section=>{if(!confirmDiscard())return;temporaryBlockIds.current.clear();setSectionMenu(null);setColorMenu(null);setSelectedBlockId(null);setSelectedSectionId(section.id);const page=notes.find(note=>note.sectionId===section.id);setSelectedId(page?.id||null);setDraft(page?hydrateNote(page):null);setDirty(false)};
  const selectPage=note=>{if(!confirmDiscard())return;temporaryBlockIds.current.clear();setSelectedBlockId(null);setSelectedSectionId(note.sectionId);setSelectedId(note.id);setDraft(hydrateNote(note));setDirty(false)};
  const createSection=async()=>{
    const title=window.prompt('Section name');if(!title?.trim())return;
    const section={id:uid(),title:title.trim(),color:sectionColors[sections.length%sectionColors.length],collapsed:false,order:sections.length,createdAt:new Date().toISOString()};
    if(await mutate('/api/note-sections','POST',section)){setSelectedBlockId(null);setSelectedSectionId(section.id);setSelectedId(null);setDraft(null);setDirty(false)}
  };
  const renameSection=async section=>{const title=window.prompt('Rename section',section.title);if(!title?.trim()||title.trim()===section.title)return;await mutate('/api/note-sections','POST',{...section,title:title.trim()})};
  const toggleSection=async section=>{setSelectedSectionId(section.id);await mutate('/api/note-sections','POST',{...section,collapsed:!section.collapsed})};
  const setSectionColor=async(section,color)=>{if(await mutate('/api/note-sections','POST',{...section,color})){setColorMenu(null);setSectionMenu(null)}};
  const deleteSection=async section=>{
    const count=notes.filter(note=>note.sectionId===section.id).length;
    if(section.id==='section-default'||!window.confirm(`Delete “${section.title}”${count?` and its ${count} page${count===1?'':'s'}`:''}?`))return;
    if(await mutate('/api/note-sections/'+section.id,'DELETE',{})){setSelectedBlockId(null);setSelectedSectionId('section-default');setSelectedId(null);setDraft(null);setDirty(false);notify('Section deleted.')}
  };
  const createPage=async(sectionId=selectedSectionId||sections[0]?.id)=>{
    if(!sectionId||!confirmDiscard())return;
    const section=sections.find(item=>item.id===sectionId);
    if(section?.collapsed)await mutate('/api/note-sections','POST',{...section,collapsed:false});
    const page=newPage(sectionId,notes.filter(note=>note.sectionId===sectionId).length);
    temporaryBlockIds.current.clear();temporaryBlockIds.current.add(page.blocks[0].id);focusBlockId.current=page.blocks[0].id;setSelectedBlockId(page.blocks[0].id);setSelectedSectionId(sectionId);setSelectedId(page.id);setDraft(page);setDirty(true);
  };
  const changePage=changes=>{setDraft(current=>({...current,...changes}));setDirty(true)};
  const changeBlock=(blockId,changes)=>{setDraft(current=>({...current,blocks:current.blocks.map(block=>block.id===blockId?{...block,...changes}:block)}));setDirty(true)};
  const addBlock=(type,point,{temporary=false,initial={}}={})=>{
    const insertion=point||{x:36,y:Math.max(36,...draft.blocks.map(block=>block.layout.y+block.layout.height+24))},id=uid(),previousTemporary=temporary?new Set(temporaryBlockIds.current):null;focusBlockId.current=id;
    if(temporary){temporaryBlockIds.current.clear();temporaryBlockIds.current.add(id)}
    setDraft(current=>{const retained=previousTemporary?current.blocks.filter(block=>!previousTemporary.has(block.id)||(block.type==='text'&&block.text.trim())):current.blocks,top=Math.max(0,...retained.map(block=>block.layout.z)),blocks=top>=10000?[...retained].sort((a,b)=>a.layout.z-b.layout.z).map((block,index)=>({...block,layout:{...block.layout,z:index}})):retained,z=top>=10000?blocks.length:top+1,block={...blockFor(type,layoutFor(type,insertion.x,insertion.y,z)),...initial,id};return {...current,blocks:[...blocks,block]}});
    setSelectedBlockId(id);if(!temporary)setDirty(true);
  };
  const addTextAt=event=>{if(event.button!==0||event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();addBlock('text',{x:event.clientX-bounds.left,y:event.clientY-bounds.top},{temporary:true})};
  const removeBlock=blockId=>{const temporary=temporaryBlockIds.current.delete(blockId);setDraft(current=>({...current,blocks:current.blocks.filter(block=>block.id!==blockId)}));setSelectedBlockId(current=>current===blockId?null:current);if(!temporary)setDirty(true)};
  const changeText=(blockId,text)=>{
    const temporary=temporaryBlockIds.current.has(blockId);
    setDraft(current=>({...current,blocks:current.blocks.map(block=>block.id===blockId?{...block,text}:block)}));
    if(!temporary||text.trim())setDirty(true)
  };
  const discardTemporaryText=(blockId,currentValue)=>{
    if(!temporaryBlockIds.current.has(blockId))return;
    setDraft(current=>{if(currentValue.trim()){temporaryBlockIds.current.delete(blockId);return current}temporaryBlockIds.current.delete(blockId);return {...current,blocks:current.blocks.filter(item=>item.id!==blockId)}});
    setSelectedBlockId(current=>current===blockId?null:current);
  };
  const selectBlock=blockId=>{
    setSelectedBlockId(blockId);
    const target=draft.blocks.find(block=>block.id===blockId),top=Math.max(0,...draft.blocks.map(block=>block.layout.z));
    if(target&&target.layout.z<top){setDraft(current=>{
      if(top<10000)return {...current,blocks:current.blocks.map(block=>block.id===blockId?{...block,layout:{...block.layout,z:top+1}}:block)};
      const order=new Map([...current.blocks].filter(block=>block.id!==blockId).sort((a,b)=>a.layout.z-b.layout.z).map((block,index)=>[block.id,index]));
      return {...current,blocks:current.blocks.map(block=>({...block,layout:{...block.layout,z:block.id===blockId?current.blocks.length-1:order.get(block.id)}}))};
    });setDirty(true)}
  };
  const startInteraction=(event,block,mode)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();interactionCleanup.current();selectBlock(block.id);
    const start={clientX:event.clientX,clientY:event.clientY,layout:{...block.layout}};
    const move=pointer=>{
      if(pointer.pointerId!==event.pointerId)return;
      const dx=Math.round(pointer.clientX-start.clientX),dy=Math.round(pointer.clientY-start.clientY);
      setDraft(current=>({...current,blocks:current.blocks.map(item=>{
        if(item.id!==block.id)return item;
        const layout=mode==='drag'
          ?{...item.layout,x:Math.min(10000,Math.max(0,start.layout.x+dx)),y:Math.min(10000,Math.max(0,start.layout.y+dy))}
          :{...item.layout,width:Math.min(2000,Math.max(180,start.layout.width+dx)),height:Math.min(2000,Math.max(80,start.layout.height+dy))};
        return {...item,layout};
      })}));
      if(!temporaryBlockIds.current.has(block.id))setDirty(true);
    };
    const finish=pointer=>{if(pointer.pointerId!==event.pointerId)return;interactionCleanup.current()};
    interactionCleanup.current=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);interactionCleanup.current=()=>{}};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  };
  const changeCell=(block,row,column,value)=>changeBlock(block.id,{rows:block.rows.map((cells,rowIndex)=>rowIndex===row?cells.map((cell,columnIndex)=>columnIndex===column?value:cell):cells)});
  const addRow=block=>changeBlock(block.id,{rows:[...block.rows,Array(block.rows[0].length).fill('')]});
  const addColumn=block=>changeBlock(block.id,{rows:block.rows.map(row=>[...row,''])});
  const removeRow=block=>{if(block.rows.length>1)changeBlock(block.id,{rows:block.rows.slice(0,-1)})};
  const removeColumn=block=>{if(block.rows[0].length>1)changeBlock(block.id,{rows:block.rows.map(row=>row.slice(0,-1))})};
  const upload=(block,file)=>{
    if(!file)return;
    const error=validateNoteImage(file);if(error)return notify(error);
    const reader=new FileReader();reader.onload=()=>changeBlock(block.id,{name:file.name,dataUrl:String(reader.result)});reader.onerror=()=>notify('The image could not be read.');reader.readAsDataURL(file);
  };
  useEffect(()=>{
    if(!draft)return;
    let disposed=false;
    const paste=event=>{
      const target=event.target;
      if(target instanceof Element&&target.closest('input,textarea,select,a,[contenteditable="true"]'))return;
      const file=clipboardImage(event.clipboardData?.items);if(!file)return;
      event.preventDefault();
      const error=validateNoteImage(file);if(error)return notify(error);
      const reader=new FileReader();
      reader.onload=()=>{if(!disposed)addBlock('image',null,{initial:{name:file.name||'Pasted image',dataUrl:String(reader.result)}})};
      reader.onerror=()=>{if(!disposed)notify('The image could not be read.')};
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste',paste);
    return()=>{disposed=true;window.removeEventListener('paste',paste)};
  },[draft]);
  const save=async event=>{event.preventDefault();if(!draft.title.trim())return notify('Add a page title before saving.');const prepared={...draft,blocks:draft.blocks.filter(block=>block.type!=='text'||block.text.trim())};if(prepared.blocks.some(block=>block.type==='image'&&!block.dataUrl))return notify('Choose an image or remove the empty image block.');if(await mutate('/api/notes','POST',prepared)){temporaryBlockIds.current.clear();setDraft(prepared);setSelectedBlockId(current=>prepared.blocks.some(block=>block.id===current)?current:null);setDirty(false);notify('Page saved to SQLite.')}};
  const remove=async()=>{if(!saved||!window.confirm('Delete this page permanently?'))return;if(await mutate('/api/notes/'+selectedId,'DELETE',{})){setDirty(false);setSelectedId(null);setDraft(null);notify('Page deleted.')}};
  const exitNotes=()=>{if(confirmDiscard())onExit?.()};
  return <div className="notes-page">
    <div className={`notes-workspace ${sectionsPaneCollapsed?'sections-collapsed':''} ${selectedSection?.collapsed?'pages-collapsed':''}`} style={{'--active-section-color':selectedSection?.color||sectionColors[0]}}>
      <aside className="note-sections-pane" aria-label="Notebook sections">
        <header className="note-notebook-header"><span><NotebookTabs size={18}/><strong>My notebook</strong></span><div><button type="button" data-action="notes-theme" aria-label={`Use ${data.settings.theme==='dark'?'light':'dark'} mode`} title={`Use ${data.settings.theme==='dark'?'light':'dark'} mode`} onClick={onTheme}>{data.settings.theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button><button type="button" data-action="toggle-sections-pane" aria-label={sectionsPaneCollapsed?'Expand section pane':'Collapse section pane'} aria-expanded={!sectionsPaneCollapsed} onClick={()=>setSectionsPaneCollapsed(value=>!value)}>{sectionsPaneCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}</button></div></header>
        <div className="note-section-list">{sections.map(section=>{
          const selected=section.id===selectedSectionId;
          const pageCount=notes.filter(note=>note.sectionId===section.id).length;
          return <section key={section.id} className={`note-section-item ${selected?'selected':''}`} data-section-id={section.id} style={{'--section-color':section.color}}>
            <div className="note-section-row">
              <button type="button" className="note-section-select" title={section.title} onClick={()=>selectSection(section)}><i/><NotebookTabs size={15}/><span className="note-section-copy"><strong>{section.title}</strong><small>{pageCount}</small></span></button>
              {selected&&<span className="note-section-actions"><button type="button" className="note-section-toggle" aria-label={`${section.collapsed?'Expand':'Collapse'} ${section.title} pages`} aria-expanded={!section.collapsed} onClick={()=>toggleSection(section)}>{section.collapsed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button><button type="button" data-action="section-options" aria-label={`Section options for ${section.title}`} aria-expanded={sectionMenu===section.id} onClick={()=>{setSectionMenu(sectionMenu===section.id?null:section.id);setColorMenu(null)}}><MoreHorizontal size={14}/></button></span>}
            </div>
            {selected&&sectionMenu===section.id&&<div className="note-section-tools"><div><button type="button" data-action="section-color" aria-label={`Choose color for ${section.title}`} onClick={()=>setColorMenu(colorMenu===section.id?null:section.id)}><Palette size={13}/>Color</button><button type="button" data-action="rename-section" aria-label={`Rename ${section.title}`} onClick={()=>renameSection(section)}><Pencil size={13}/>Rename</button>{section.id!=='section-default'&&<button type="button" data-action="delete-section" aria-label={`Delete ${section.title}`} onClick={()=>deleteSection(section)}><Trash2 size={13}/>Delete</button>}</div>{colorMenu===section.id&&<div className="note-color-palette" aria-label={`Section colors for ${section.title}`}>{sectionColors.map(color=><button key={color} type="button" data-section-color={color} aria-label={`Use ${color}`} aria-pressed={section.color===color} style={{'--swatch':color}} onClick={()=>setSectionColor(section,color)}/>)}</div>}</div>}
          </section>})}</div>
        <button type="button" className="note-new-section" data-action="new-section" onClick={createSection}><FolderPlus size={15}/><span>New section</span></button>
      </aside>
      <aside className="note-pages-pane" aria-label={selectedSection?`${selectedSection.title} pages`:'Pages'}>
        {selectedSection?.collapsed?<button type="button" className="note-pages-expand" aria-label={`Expand ${selectedSection.title} pages`} onClick={()=>toggleSection(selectedSection)}><ChevronRight size={17}/></button>:<div className="note-pages-content">
          <header className="note-pages-header"><div><span style={{background:selectedSection?.color}}/><strong>{selectedSection?.title||'Pages'}</strong></div><button type="button" aria-label="Collapse page pane" onClick={()=>selectedSection&&toggleSection(selectedSection)}><ChevronLeft size={16}/></button></header>
          <button type="button" className="note-add-page" data-action="new-page" onClick={()=>createPage()}><FilePlus2 size={15}/>Add page</button>
          <label className="notes-search"><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search pages" aria-label="Search pages"/></label>
          <div className="note-page-list">{selectedPages.map(note=><button key={note.id} className={`note-list-item ${note.id===selectedId?'active':''}`} onClick={()=>selectPage(note)}><FileText size={15}/><span><strong>{note.title}</strong><small>{shortDate(note.updatedAt)}</small></span></button>)}{!selectedPages.length&&<div className="note-section-empty"><FileText size={18}/><span>{query?'No matching pages':'No pages in this section'}</span></div>}</div>
        </div>}
      </aside>
      <section className="note-editor-shell">
        <header className="note-command-bar">
          <div className="note-command-tabs" aria-label="Note commands"><strong>Home</strong><span>Insert</span><span>View</span></div>
          <div className="note-command-actions" aria-label="Insert into page">
            <span>Insert</span><button type="button" data-add-block="text" disabled={!draft} onClick={()=>addBlock('text')}><Type size={16}/><small>Text</small></button><button type="button" data-add-block="link" disabled={!draft} onClick={()=>addBlock('link')}><Link2 size={16}/><small>Link</small></button><button type="button" data-add-block="image" disabled={!draft} onClick={()=>addBlock('image')}><Image size={16}/><small>Picture</small></button><button type="button" data-add-block="table" disabled={!draft} onClick={()=>addBlock('table')}><Table2 size={16}/><small>Table</small></button><button type="button" data-add-block="code" disabled={!draft} onClick={()=>addBlock('code')}><Code2 size={16}/><small>Code</small></button>
            <div className="note-command-spacer"/>{draft&&<span className={`note-save-state ${dirty?'is-dirty':''}`}>{dirty?'Unsaved changes':'Saved locally'}</span>}{saved&&<button type="button" className="note-command-delete" data-action="delete-note" onClick={remove}><Trash2 size={16}/><small>Delete</small></button>}{draft&&<button type="submit" form="note-page-form" className="note-command-save" data-action="save-note"><Save size={16}/><small>Save</small></button>}<button type="button" className="workspace-close-button" data-action="exit-notes" aria-label="Close My Notes and return to dashboard" onClick={exitNotes}><X size={18}/><span>Close</span></button>
          </div>
        </header>
        <div className="note-page-canvas">{!draft?<div className="note-editor-empty"><FileText size={28}/><h2>{sections.length?'Choose or create a page.':'Your notebook is ready.'}</h2><p>Pages can mix written notes, links, photos, tables, and code snippets.</p><button className="primary-button" data-action="new-page" onClick={()=>createPage()}><Plus size={16}/>Create page</button></div>:
        <form id="note-page-form" className="note-editor" onSubmit={save}>
          <div className="note-editor-section"><i/><span>{selectedSection?.title}</span></div>
          <div className="note-editor-top"><div><input id="note-title" value={draft.title} onChange={event=>changePage({title:event.target.value})} placeholder="Untitled page" maxLength={200} aria-label="Page title"/><small><span>{shortDate(draft.updatedAt||draft.createdAt)}</span><span>{shortTime(draft.updatedAt||draft.createdAt)}</span></small></div></div>
          <div className="note-blocks note-spatial-layer" style={{width:canvasSize.width,height:canvasSize.height}} onPointerDown={addTextAt}>{draft.blocks.map(block=><article className={`note-block note-canvas-item ${selectedBlockId===block.id?'is-selected':''}`} data-block-id={block.id} data-block-type={block.type} key={block.id} ref={node=>{if(node)blockRefs.current.set(block.id,node);else blockRefs.current.delete(block.id)}} style={{left:block.layout.x,top:block.layout.y,width:block.layout.width,height:block.layout.height,zIndex:block.layout.z}} onPointerDown={event=>{event.stopPropagation();selectBlock(block.id)}}>
            <header><span>{block.type==='text'?<Type size={14}/>:block.type==='link'?<Link2 size={14}/>:block.type==='image'?<Image size={14}/>:block.type==='code'?<Code2 size={14}/>:<Table2 size={14}/>} {block.type}</span><div><button type="button" className="note-move-handle" aria-label="Move block" title="Drag to move" onPointerDown={event=>startInteraction(event,block,'drag')}><Move size={14}/></button><button type="button" aria-label="Remove block" onClick={()=>removeBlock(block.id)}><Trash2 size={14}/></button></div></header>
            {block.type==='text'&&<textarea value={block.text} onChange={event=>changeText(block.id,event.target.value)} onBlur={event=>discardTemporaryText(block.id,event.currentTarget.value)} placeholder="Write your notes…" rows={4} maxLength={100000}/>}
            {block.type==='link'&&<div className="note-link-fields"><label>Link label<input name="label" value={block.label} onChange={event=>changeBlock(block.id,{label:event.target.value})} placeholder="PostgreSQL documentation" maxLength={300}/></label><label>URL<input name="url" type="url" value={block.url} onChange={event=>changeBlock(block.id,{url:event.target.value})} placeholder="https://…" maxLength={2000}/></label>{safeLink(block.url)&&<a className="note-preview-link" href={block.url} target="_blank" rel="noreferrer"><Link2 size={14}/>{block.label||block.url}</a>}</div>}
            {block.type==='image'&&<div className={`note-image-fields${block.dataUrl?' image-only':''}`}>{block.dataUrl?<div className="note-image-preview"><img src={block.dataUrl} alt={block.alt||''}/></div>:<label className="note-image-picker"><Image size={17}/><span>Choose image · max 2 MB</span><input className="note-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>upload(block,event.target.files?.[0])}/></label>}</div>}
            {block.type==='table'&&<div className="note-table-editor"><div className="note-table-scroll"><table><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,columnIndex)=><td key={columnIndex}><input data-cell={`${rowIndex}:${columnIndex}`} aria-label={`Row ${rowIndex+1}, column ${columnIndex+1}`} value={cell} maxLength={2000} onChange={event=>changeCell(block,rowIndex,columnIndex,event.target.value)}/></td>)}</tr>)}</tbody></table></div><div className="note-table-actions"><button type="button" onClick={()=>addRow(block)} disabled={block.rows.length>=20}>+ Row</button><button type="button" onClick={()=>addColumn(block)} disabled={block.rows[0].length>=10}>+ Column</button><button type="button" onClick={()=>removeRow(block)} disabled={block.rows.length<=1}>− Row</button><button type="button" onClick={()=>removeColumn(block)} disabled={block.rows[0].length<=1}>− Column</button></div></div>}
            {block.type==='code'&&<div className="note-code-editor"><label>Language<select value={block.language} onChange={event=>changeBlock(block.id,{language:event.target.value})}>{codeLanguages.map(language=><option key={language} value={language}>{language}</option>)}</select></label><textarea value={block.code} onChange={event=>changeBlock(block.id,{code:event.target.value})} placeholder="Paste or write code…" rows={10} maxLength={100000} spellCheck="false"/></div>}
            <button type="button" className="note-resize-handle" aria-label="Resize block" title="Drag to resize" onPointerDown={event=>startInteraction(event,block,'resize')}><Maximize2 size={13}/></button>
          </article>)}</div>
        </form>}</div>
      </section>
    </div>
  </div>;
}
