import {useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronDown,ChevronRight,FilePlus2,FileText,Folder,FolderPlus,Image,Link2,Pencil,Plus,Save,Search,Table2,Trash2,Type} from 'lucide-react';
import {mutate,notify,uid} from './store';

const copy=value=>JSON.parse(JSON.stringify(value));
const newTextBlock=()=>({id:uid(),type:'text',text:''});
const newPage=(sectionId,order)=>({id:uid(),sectionId,order,title:'',createdAt:new Date().toISOString(),blocks:[newTextBlock()]});
const blockFor=type=>type==='link'?{id:uid(),type,label:'',url:''}:type==='image'?{id:uid(),type,name:'',alt:'',dataUrl:''}:type==='table'?{id:uid(),type,rows:[['',''],['','']]}:newTextBlock();
const safeLink=value=>{try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?value:null}catch{return null}};
const shortDate=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));

export default function Notes({data}){
  const sections=data.noteSections||[];
  const notes=data.notes||[];
  const firstSection=notes[0]?.sectionId||sections[0]?.id||null;
  const [query,setQuery]=useState('');
  const [selectedSectionId,setSelectedSectionId]=useState(firstSection);
  const [selectedId,setSelectedId]=useState(notes.find(note=>note.sectionId===firstSection)?.id||null);
  const [draft,setDraft]=useState(()=>selectedId?copy(notes.find(note=>note.id===selectedId)):null);
  const [dirty,setDirty]=useState(false);
  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    if(!value)return notes;
    return notes.filter(note=>`${note.title} ${note.blocks.map(block=>block.text||block.label||block.alt||(block.rows||[]).flat().join(' ')||'').join(' ')}`.toLowerCase().includes(value));
  },[notes,query]);
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
  const selectSection=section=>{if(!confirmDiscard())return;setSelectedSectionId(section.id);const page=notes.find(note=>note.sectionId===section.id);setSelectedId(page?.id||null);setDraft(page?copy(page):null);setDirty(false)};
  const selectPage=note=>{if(!confirmDiscard())return;setSelectedSectionId(note.sectionId);setSelectedId(note.id);setDraft(copy(note));setDirty(false)};
  const createSection=async()=>{
    const title=window.prompt('Section name');if(!title?.trim())return;
    const section={id:uid(),title:title.trim(),collapsed:false,order:sections.length,createdAt:new Date().toISOString()};
    if(await mutate('/api/note-sections','POST',section)){setSelectedSectionId(section.id);setSelectedId(null);setDraft(null);setDirty(false)}
  };
  const renameSection=async section=>{const title=window.prompt('Rename section',section.title);if(!title?.trim()||title.trim()===section.title)return;await mutate('/api/note-sections','POST',{...section,title:title.trim()})};
  const toggleSection=async section=>{setSelectedSectionId(section.id);await mutate('/api/note-sections','POST',{...section,collapsed:!section.collapsed})};
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
  return <div className="notes-page">
    <div className="notes-heading"><div><span>LOCAL STUDY NOTEBOOK</span><h1>My notes</h1><p>Organize study material into sections and flexible pages.</p></div><div className="notes-heading-actions"><button className="subtle-button" data-action="new-section" onClick={createSection}><FolderPlus size={16}/>New section</button><button className="primary-button" data-action="new-page" onClick={()=>createPage()}><FilePlus2 size={16}/>New page</button></div></div>
    <div className="notes-workspace">
      <aside className="notes-index" aria-label="Notebook sections and pages">
        <label className="notes-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search pages" aria-label="Search pages"/></label>
        <div className="note-tree">{sections.map(section=>{
          const pages=filtered.filter(note=>note.sectionId===section.id);
          const selected=section.id===selectedSectionId;
          return <section key={section.id} className={`note-section-item ${selected?'selected':''}`} data-section-id={section.id}>
            <header>
              <button type="button" className="note-section-toggle" aria-label={`${section.collapsed?'Expand':'Collapse'} ${section.title}`} aria-expanded={!section.collapsed} onClick={()=>toggleSection(section)}>{section.collapsed?<ChevronRight size={15}/>:<ChevronDown size={15}/>}</button>
              <button type="button" className="note-section-name" onClick={()=>selectSection(section)}><Folder size={15}/><span>{section.title}</span><small>{notes.filter(note=>note.sectionId===section.id).length}</small></button>
              {selected&&<span className="note-section-actions"><button type="button" data-action="rename-section" aria-label={`Rename ${section.title}`} onClick={()=>renameSection(section)}><Pencil size={13}/></button>{section.id!=='section-default'&&<button type="button" data-action="delete-section" aria-label={`Delete ${section.title}`} onClick={()=>deleteSection(section)}><Trash2 size={13}/></button>}</span>}
            </header>
            {!section.collapsed&&<div className="note-section-pages">{pages.map(note=><button key={note.id} className={`note-list-item ${note.id===selectedId?'active':''}`} onClick={()=>selectPage(note)}><FileText size={15}/><span><strong>{note.title}</strong><small>{shortDate(note.updatedAt)}</small></span></button>)}{!pages.length&&<div className="note-section-empty">{query?'No matching pages':'No pages'}</div>}<button type="button" className="note-inline-add" onClick={()=>createPage(section.id)}><Plus size={13}/>Add page</button></div>}
          </section>})}</div>
      </aside>
      <section className="note-editor-shell">
        {!draft?<div className="note-editor-empty"><FileText size={28}/><h2>{sections.length?'Choose or create a page.':'Your notebook is ready.'}</h2><p>Pages can mix written notes, links, photos, and editable tables.</p><button className="primary-button" data-action="new-page" onClick={()=>createPage()}><Plus size={16}/>Create page</button></div>:
        <form className="note-editor" onSubmit={save}>
          <div className="note-editor-top"><div><span>{saved?'SAVED PAGE':'NEW PAGE'}{dirty?' · UNSAVED':''}</span><input id="note-title" value={draft.title} onChange={event=>changePage({title:event.target.value})} placeholder="Page title" maxLength={200} aria-label="Page title"/></div><div>{saved&&<button type="button" className="note-delete" data-action="delete-note" onClick={remove}><Trash2 size={15}/>Delete</button>}<button className="primary-button" data-action="save-note"><Save size={15}/>Save page</button></div></div>
          <div className="note-blocks">{draft.blocks.map((block,index)=><article className="note-block" data-block-type={block.type} key={block.id}>
            <header><span>{block.type==='text'?<Type size={14}/>:block.type==='link'?<Link2 size={14}/>:block.type==='image'?<Image size={14}/>:<Table2 size={14}/>} {block.type}</span><div><button type="button" aria-label="Move block up" disabled={index===0} onClick={()=>moveBlock(index,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move block down" disabled={index===draft.blocks.length-1} onClick={()=>moveBlock(index,1)}><ArrowDown size={14}/></button><button type="button" aria-label="Remove block" onClick={()=>removeBlock(block.id)}><Trash2 size={14}/></button></div></header>
            {block.type==='text'&&<textarea value={block.text} onChange={event=>changeBlock(block.id,{text:event.target.value})} placeholder="Write your notes…" rows={7} maxLength={100000}/>} 
            {block.type==='link'&&<div className="note-link-fields"><label>Link label<input name="label" value={block.label} onChange={event=>changeBlock(block.id,{label:event.target.value})} placeholder="PostgreSQL documentation" maxLength={300}/></label><label>URL<input name="url" type="url" value={block.url} onChange={event=>changeBlock(block.id,{url:event.target.value})} placeholder="https://…" maxLength={2000}/></label>{safeLink(block.url)&&<a className="note-preview-link" href={block.url} target="_blank" rel="noreferrer"><Link2 size={14}/>{block.label||block.url}</a>}</div>}
            {block.type==='image'&&<div className="note-image-fields"><label className="note-image-picker"><Image size={17}/><span>{block.name||'Choose image · max 2 MB'}</span><input className="note-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>upload(block,event.target.files?.[0])}/></label>{block.dataUrl&&<div className="note-image-preview"><img src={block.dataUrl} alt={block.alt}/></div>}<label>Image description<input name="alt" value={block.alt} onChange={event=>changeBlock(block.id,{alt:event.target.value})} placeholder="Describe this image" maxLength={500}/></label></div>}
            {block.type==='table'&&<div className="note-table-editor"><div className="note-table-scroll"><table><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,columnIndex)=><td key={columnIndex}><input data-cell={`${rowIndex}:${columnIndex}`} aria-label={`Row ${rowIndex+1}, column ${columnIndex+1}`} value={cell} maxLength={2000} onChange={event=>changeCell(block,rowIndex,columnIndex,event.target.value)}/></td>)}</tr>)}</tbody></table></div><div className="note-table-actions"><button type="button" onClick={()=>addRow(block)} disabled={block.rows.length>=20}>+ Row</button><button type="button" onClick={()=>addColumn(block)} disabled={block.rows[0].length>=10}>+ Column</button><button type="button" onClick={()=>removeRow(block)} disabled={block.rows.length<=1}>− Row</button><button type="button" onClick={()=>removeColumn(block)} disabled={block.rows[0].length<=1}>− Column</button></div></div>}
          </article>)}</div>
          <div className="note-builder-toolbar" aria-label="Add page block"><span>Add to page</span><button type="button" data-add-block="text" onClick={()=>addBlock('text')}><Type size={15}/>Text</button><button type="button" data-add-block="link" onClick={()=>addBlock('link')}><Link2 size={15}/>Link</button><button type="button" data-add-block="image" onClick={()=>addBlock('image')}><Image size={15}/>Photo</button><button type="button" data-add-block="table" onClick={()=>addBlock('table')}><Table2 size={15}/>Table</button></div>
        </form>}
      </section>
    </div>
  </div>;
}
