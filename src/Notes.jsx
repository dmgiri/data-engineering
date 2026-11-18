import {useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronDown,ChevronLeft,ChevronRight,Code2,FilePlus2,FileText,FolderPlus,Image,Link2,LogOut,Moon,MoreHorizontal,NotebookTabs,Palette,PanelLeftClose,PanelLeftOpen,Pencil,Plus,Save,Search,Sun,Table2,Trash2,Type} from 'lucide-react';
import {mutate,notify,uid} from './store';

const copy=value=>JSON.parse(JSON.stringify(value));
const newTextBlock=()=>({id:uid(),type:'text',text:''});
const newPage=(sectionId,order)=>({id:uid(),sectionId,order,title:'',createdAt:new Date().toISOString(),blocks:[newTextBlock()]});
const blockFor=type=>type==='link'?{id:uid(),type,label:'',url:''}:type==='image'?{id:uid(),type,name:'',alt:'',dataUrl:''}:type==='table'?{id:uid(),type,rows:[['',''],['','']]}:type==='code'?{id:uid(),type,language:'sql',code:''}:newTextBlock();
const safeLink=value=>{try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?value:null}catch{return null}};
const shortDate=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
const sectionColors=['#7c4dff','#0a84ff','#ff4d67','#ec00a9','#ff9f0a','#30b0c7','#34c759','#8e8e93'];
const codeLanguages=['sql','postgresql','python','pyspark','scala','json','bash','text'];

export default function Notes({data,onExit,onTheme}){
  const sections=data.noteSections||[];
  const notes=data.notes||[];
  const firstSection=notes[0]?.sectionId||sections[0]?.id||null;
  const [query,setQuery]=useState('');
  const [selectedSectionId,setSelectedSectionId]=useState(firstSection);
  const [selectedId,setSelectedId]=useState(notes.find(note=>note.sectionId===firstSection)?.id||null);
  const [draft,setDraft]=useState(()=>selectedId?copy(notes.find(note=>note.id===selectedId)):null);
  const [dirty,setDirty]=useState(false);
  const [sectionsPaneCollapsed,setSectionsPaneCollapsed]=useState(false);
  const [sectionMenu,setSectionMenu]=useState(null);
  const [colorMenu,setColorMenu]=useState(null);
  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    if(!value)return notes;
    return notes.filter(note=>`${note.title} ${note.blocks.map(block=>block.text||block.label||block.alt||block.code||(block.rows||[]).flat().join(' ')||'').join(' ')}`.toLowerCase().includes(value));
  },[notes,query]);
  const selectedSection=sections.find(section=>section.id===selectedSectionId)||sections[0]||null;
  const selectedPages=filtered.filter(note=>note.sectionId===selectedSection?.id);
  const saved=notes.some(note=>note.id===selectedId);
  useEffect(()=>{
    if(selectedSectionId&&!sections.some(section=>section.id===selectedSectionId))setSelectedSectionId(sections[0]?.id||null);
  },[sections,selectedSectionId]);
  useEffect(()=>{
    if(dirty)return;
    const note=notes.find(item=>item.id===selectedId);
    if(note){setDraft(copy(note));setSelectedSectionId(note.sectionId)}
    else if(!selectedId&&notes.length){setSelectedId(notes[0].id);setSelectedSectionId(notes[0].sectionId);setDraft(copy(notes[0]))}
  },[notes,selectedId,dirty]);
  const confirmDiscard=()=>!dirty||window.confirm('Discard unsaved page changes?');
  const selectSection=section=>{if(!confirmDiscard())return;setSectionMenu(null);setColorMenu(null);setSelectedSectionId(section.id);const page=notes.find(note=>note.sectionId===section.id);setSelectedId(page?.id||null);setDraft(page?copy(page):null);setDirty(false)};
  const selectPage=note=>{if(!confirmDiscard())return;setSelectedSectionId(note.sectionId);setSelectedId(note.id);setDraft(copy(note));setDirty(false)};
  const createSection=async()=>{
    const title=window.prompt('Section name');if(!title?.trim())return;
    const section={id:uid(),title:title.trim(),color:sectionColors[sections.length%sectionColors.length],collapsed:false,order:sections.length,createdAt:new Date().toISOString()};
    if(await mutate('/api/note-sections','POST',section)){setSelectedSectionId(section.id);setSelectedId(null);setDraft(null);setDirty(false)}
  };
  const renameSection=async section=>{const title=window.prompt('Rename section',section.title);if(!title?.trim()||title.trim()===section.title)return;await mutate('/api/note-sections','POST',{...section,title:title.trim()})};
  const toggleSection=async section=>{setSelectedSectionId(section.id);await mutate('/api/note-sections','POST',{...section,collapsed:!section.collapsed})};
  const setSectionColor=async(section,color)=>{if(await mutate('/api/note-sections','POST',{...section,color})){setColorMenu(null);setSectionMenu(null)}};
  const deleteSection=async section=>{
    const count=notes.filter(note=>note.sectionId===section.id).length;
    if(section.id==='section-default'||!window.confirm(`Delete “${section.title}”${count?` and its ${count} page${count===1?'':'s'}`:''}?`))return;
    if(await mutate('/api/note-sections/'+section.id,'DELETE',{})){setSelectedSectionId('section-default');setSelectedId(null);setDraft(null);setDirty(false);notify('Section deleted.')}
  };
  const createPage=async(sectionId=selectedSectionId||sections[0]?.id)=>{
    if(!sectionId||!confirmDiscard())return;
    const section=sections.find(item=>item.id===sectionId);
    if(section?.collapsed)await mutate('/api/note-sections','POST',{...section,collapsed:false});
    const page=newPage(sectionId,notes.filter(note=>note.sectionId===sectionId).length);
    setSelectedSectionId(sectionId);setSelectedId(page.id);setDraft(page);setDirty(true);
  };
  const changePage=changes=>{setDraft(current=>({...current,...changes}));setDirty(true)};
  const changeBlock=(blockId,changes)=>{setDraft(current=>({...current,blocks:current.blocks.map(block=>block.id===blockId?{...block,...changes}:block)}));setDirty(true)};
  const addBlock=type=>{setDraft(current=>({...current,blocks:[...current.blocks,blockFor(type)]}));setDirty(true)};
  const removeBlock=blockId=>{setDraft(current=>({...current,blocks:current.blocks.length===1?[newTextBlock()]:current.blocks.filter(block=>block.id!==blockId)}));setDirty(true)};
  const moveBlock=(index,direction)=>{setDraft(current=>{const blocks=[...current.blocks],target=index+direction;if(target<0||target>=blocks.length)return current;[blocks[index],blocks[target]]=[blocks[target],blocks[index]];return {...current,blocks}});setDirty(true)};
  const changeCell=(block,row,column,value)=>changeBlock(block.id,{rows:block.rows.map((cells,rowIndex)=>rowIndex===row?cells.map((cell,columnIndex)=>columnIndex===column?value:cell):cells)});
  const addRow=block=>changeBlock(block.id,{rows:[...block.rows,Array(block.rows[0].length).fill('')]});
  const addColumn=block=>changeBlock(block.id,{rows:block.rows.map(row=>[...row,''])});
  const removeRow=block=>{if(block.rows.length>1)changeBlock(block.id,{rows:block.rows.slice(0,-1)})};
  const removeColumn=block=>{if(block.rows[0].length>1)changeBlock(block.id,{rows:block.rows.map(row=>row.slice(0,-1))})};
  const upload=(block,file)=>{
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))return notify('Choose a PNG, JPEG, WebP, or GIF image.');
    if(file.size>2*1024*1024)return notify('Keep each note image under 2 MB.');
    const reader=new FileReader();reader.onload=()=>changeBlock(block.id,{name:file.name,dataUrl:String(reader.result)});reader.onerror=()=>notify('The image could not be read.');reader.readAsDataURL(file);
  };
  const save=async event=>{event.preventDefault();if(!draft.title.trim())return notify('Add a page title before saving.');if(draft.blocks.some(block=>block.type==='image'&&!block.dataUrl))return notify('Choose an image or remove the empty image block.');if(await mutate('/api/notes','POST',draft)){setDirty(false);notify('Page saved to SQLite.')}};
  const remove=async()=>{if(!saved||!window.confirm('Delete this page permanently?'))return;if(await mutate('/api/notes/'+selectedId,'DELETE',{})){setDirty(false);setSelectedId(null);setDraft(null);notify('Page deleted.')}};
  const exitNotes=()=>{if(confirmDiscard())onExit?.()};
  return <div className="notes-page">
    <div className={`notes-workspace ${sectionsPaneCollapsed?'sections-collapsed':''} ${selectedSection?.collapsed?'pages-collapsed':''}`} style={{'--active-section-color':selectedSection?.color||sectionColors[0]}}>
      <aside className="note-sections-pane" aria-label="Notebook sections">
        <header className="note-notebook-header"><span><NotebookTabs size={18}/><strong>My notebook</strong></span><div><button type="button" data-action="notes-theme" aria-label={`Use ${data.settings.theme==='dark'?'light':'dark'} mode`} title={`Use ${data.settings.theme==='dark'?'light':'dark'} mode`} onClick={onTheme}>{data.settings.theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button><button type="button" data-action="exit-notes" aria-label="Exit notes" title="Exit notes" onClick={exitNotes}><LogOut size={16}/></button><button type="button" data-action="toggle-sections-pane" aria-label={sectionsPaneCollapsed?'Expand section pane':'Collapse section pane'} aria-expanded={!sectionsPaneCollapsed} onClick={()=>setSectionsPaneCollapsed(value=>!value)}>{sectionsPaneCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}</button></div></header>
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
        {!draft?<div className="note-editor-empty"><FileText size={28}/><h2>{sections.length?'Choose or create a page.':'Your notebook is ready.'}</h2><p>Pages can mix written notes, links, photos, tables, and code snippets.</p><button className="primary-button" data-action="new-page" onClick={()=>createPage()}><Plus size={16}/>Create page</button></div>:
        <form className="note-editor" onSubmit={save}>
          <div className="note-editor-section"><i/><span>{selectedSection?.title}</span></div>
          <div className="note-editor-top"><div><span>{saved?'SAVED PAGE':'NEW PAGE'}{dirty?' · UNSAVED':''}</span><input id="note-title" value={draft.title} onChange={event=>changePage({title:event.target.value})} placeholder="Page title" maxLength={200} aria-label="Page title"/><small>{shortDate(draft.updatedAt||draft.createdAt)}</small></div><div>{saved&&<button type="button" className="note-delete" data-action="delete-note" onClick={remove}><Trash2 size={15}/>Delete</button>}<button className="primary-button" data-action="save-note"><Save size={15}/>Save page</button></div></div>
          <div className="note-blocks">{draft.blocks.map((block,index)=><article className="note-block" data-block-type={block.type} key={block.id}>
            <header><span>{block.type==='text'?<Type size={14}/>:block.type==='link'?<Link2 size={14}/>:block.type==='image'?<Image size={14}/>:block.type==='code'?<Code2 size={14}/>:<Table2 size={14}/>} {block.type}</span><div><button type="button" aria-label="Move block up" disabled={index===0} onClick={()=>moveBlock(index,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move block down" disabled={index===draft.blocks.length-1} onClick={()=>moveBlock(index,1)}><ArrowDown size={14}/></button><button type="button" aria-label="Remove block" onClick={()=>removeBlock(block.id)}><Trash2 size={14}/></button></div></header>
            {block.type==='text'&&<textarea value={block.text} onChange={event=>changeBlock(block.id,{text:event.target.value})} placeholder="Write your notes…" rows={7} maxLength={100000}/>}
            {block.type==='link'&&<div className="note-link-fields"><label>Link label<input name="label" value={block.label} onChange={event=>changeBlock(block.id,{label:event.target.value})} placeholder="PostgreSQL documentation" maxLength={300}/></label><label>URL<input name="url" type="url" value={block.url} onChange={event=>changeBlock(block.id,{url:event.target.value})} placeholder="https://…" maxLength={2000}/></label>{safeLink(block.url)&&<a className="note-preview-link" href={block.url} target="_blank" rel="noreferrer"><Link2 size={14}/>{block.label||block.url}</a>}</div>}
            {block.type==='image'&&<div className="note-image-fields"><label className="note-image-picker"><Image size={17}/><span>{block.name||'Choose image · max 2 MB'}</span><input className="note-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>upload(block,event.target.files?.[0])}/></label>{block.dataUrl&&<div className="note-image-preview"><img src={block.dataUrl} alt={block.alt}/></div>}<label>Image description<input name="alt" value={block.alt} onChange={event=>changeBlock(block.id,{alt:event.target.value})} placeholder="Describe this image" maxLength={500}/></label></div>}
            {block.type==='table'&&<div className="note-table-editor"><div className="note-table-scroll"><table><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,columnIndex)=><td key={columnIndex}><input data-cell={`${rowIndex}:${columnIndex}`} aria-label={`Row ${rowIndex+1}, column ${columnIndex+1}`} value={cell} maxLength={2000} onChange={event=>changeCell(block,rowIndex,columnIndex,event.target.value)}/></td>)}</tr>)}</tbody></table></div><div className="note-table-actions"><button type="button" onClick={()=>addRow(block)} disabled={block.rows.length>=20}>+ Row</button><button type="button" onClick={()=>addColumn(block)} disabled={block.rows[0].length>=10}>+ Column</button><button type="button" onClick={()=>removeRow(block)} disabled={block.rows.length<=1}>− Row</button><button type="button" onClick={()=>removeColumn(block)} disabled={block.rows[0].length<=1}>− Column</button></div></div>}
            {block.type==='code'&&<div className="note-code-editor"><label>Language<select value={block.language} onChange={event=>changeBlock(block.id,{language:event.target.value})}>{codeLanguages.map(language=><option key={language} value={language}>{language}</option>)}</select></label><textarea value={block.code} onChange={event=>changeBlock(block.id,{code:event.target.value})} placeholder="Paste or write code…" rows={10} maxLength={100000} spellCheck="false"/></div>}
          </article>)}</div>
          <div className="note-builder-toolbar" aria-label="Add page block"><span>Add to page</span><button type="button" data-add-block="text" onClick={()=>addBlock('text')}><Type size={15}/>Text</button><button type="button" data-add-block="link" onClick={()=>addBlock('link')}><Link2 size={15}/>URL</button><button type="button" data-add-block="image" onClick={()=>addBlock('image')}><Image size={15}/>Photo</button><button type="button" data-add-block="table" onClick={()=>addBlock('table')}><Table2 size={15}/>Table</button><button type="button" data-add-block="code" onClick={()=>addBlock('code')}><Code2 size={15}/>Code</button></div>
        </form>}
      </section>
    </div>
  </div>;
}
