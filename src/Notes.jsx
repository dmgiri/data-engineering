import {useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,FileText,Image,Link2,Plus,Save,Search,Trash2,Type} from 'lucide-react';
import {mutate,notify,uid} from './store';

const copy=value=>JSON.parse(JSON.stringify(value));
const newTextBlock=()=>({id:uid(),type:'text',text:''});
const newNote=()=>({id:uid(),title:'',createdAt:new Date().toISOString(),blocks:[newTextBlock()]});
const blockFor=type=>type==='link'?{id:uid(),type,label:'',url:''}:type==='image'?{id:uid(),type,name:'',alt:'',dataUrl:''}:newTextBlock();
const safeLink=value=>{try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?value:null}catch{return null}};
const shortDate=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));

export default function Notes({data}){
  const notes=data.notes||[];
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState(notes[0]?.id||null);
  const [draft,setDraft]=useState(()=>notes[0]?copy(notes[0]):null);
  const [dirty,setDirty]=useState(false);
  const filtered=useMemo(()=>notes.filter(note=>`${note.title} ${note.blocks.map(block=>block.text||block.label||block.alt||'').join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),[notes,query]);
  const saved=notes.some(note=>note.id===selectedId);
  useEffect(()=>{
    if(dirty)return;
    const note=notes.find(item=>item.id===selectedId);
    if(note)setDraft(copy(note));
    else if(!selectedId&&notes[0]){setSelectedId(notes[0].id);setDraft(copy(notes[0]))}
  },[notes,selectedId,dirty]);
  const select=note=>{if(dirty&&!window.confirm('Discard unsaved note changes?'))return;setSelectedId(note.id);setDraft(copy(note));setDirty(false)};
  const changeNote=changes=>{setDraft(current=>({...current,...changes}));setDirty(true)};
  const changeBlock=(blockId,changes)=>{setDraft(current=>({...current,blocks:current.blocks.map(block=>block.id===blockId?{...block,...changes}:block)}));setDirty(true)};
  const addBlock=type=>{setDraft(current=>({...current,blocks:[...current.blocks,blockFor(type)]}));setDirty(true)};
  const removeBlock=blockId=>{setDraft(current=>({...current,blocks:current.blocks.length===1?[newTextBlock()]:current.blocks.filter(block=>block.id!==blockId)}));setDirty(true)};
  const moveBlock=(index,direction)=>{setDraft(current=>{const blocks=[...current.blocks],target=index+direction;if(target<0||target>=blocks.length)return current;[blocks[index],blocks[target]]=[blocks[target],blocks[index]];return {...current,blocks}});setDirty(true)};
  const upload=(block,file)=>{
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))return notify('Choose a PNG, JPEG, WebP, or GIF image.');
    if(file.size>2*1024*1024)return notify('Keep each note image under 2 MB.');
    const reader=new FileReader();reader.onload=()=>changeBlock(block.id,{name:file.name,dataUrl:String(reader.result)});reader.onerror=()=>notify('The image could not be read.');reader.readAsDataURL(file);
  };
  const create=()=>{if(dirty&&!window.confirm('Discard unsaved note changes?'))return;const note=newNote();setSelectedId(note.id);setDraft(note);setDirty(true)};
  const save=async event=>{event.preventDefault();if(!draft.title.trim())return notify('Add a title before saving.');if(draft.blocks.some(block=>block.type==='image'&&!block.dataUrl))return notify('Choose an image or remove the empty image block.');if(await mutate('/api/notes','POST',draft)){setDirty(false);notify('Note saved to SQLite.')}};
  const remove=async()=>{if(!saved||!window.confirm('Delete this note permanently?'))return;if(await mutate('/api/notes/'+selectedId,'DELETE',{})){setDirty(false);setSelectedId(null);setDraft(null);notify('Note deleted.')}};
  return <div className="notes-page">
    <div className="notes-heading"><div><span>LOCAL STUDY NOTEBOOK</span><h1>My notes</h1><p>Keep explanations, useful links, and reference images together.</p></div><button className="primary-button" data-action="new-note" onClick={create}><Plus size={16}/>New note</button></div>
    <div className="notes-workspace">
      <aside className="notes-index" aria-label="Saved notes">
        <label className="notes-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search notes" aria-label="Search notes"/></label>
        <div className="notes-list">{filtered.map(note=><button key={note.id} className={`note-list-item ${note.id===selectedId?'active':''}`} onClick={()=>select(note)}><FileText size={16}/><span><strong>{note.title}</strong><small>{shortDate(note.updatedAt)}</small></span></button>)}{!filtered.length&&<div className="notes-empty"><FileText size={22}/><strong>{notes.length?'No matching notes':'No notes yet'}</strong><span>{notes.length?'Try another search.':'Create your first study note.'}</span></div>}</div>
      </aside>
      <section className="note-editor-shell">
        {!draft?<div className="note-editor-empty"><FileText size={28}/><h2>Your notebook is ready.</h2><p>Create a note, then add text, links, and images as separate blocks.</p><button className="primary-button" data-action="new-note" onClick={create}><Plus size={16}/>Create note</button></div>:
        <form className="note-editor" onSubmit={save}>
          <div className="note-editor-top"><div><span>{saved?'SAVED NOTE':'NEW NOTE'}{dirty?' · UNSAVED':''}</span><input id="note-title" value={draft.title} onChange={event=>changeNote({title:event.target.value})} placeholder="Note title" maxLength={200} aria-label="Note title"/></div><div>{saved&&<button type="button" className="note-delete" data-action="delete-note" onClick={remove}><Trash2 size={15}/>Delete</button>}<button className="primary-button" data-action="save-note"><Save size={15}/>Save note</button></div></div>
          <div className="note-blocks">{draft.blocks.map((block,index)=><article className="note-block" data-block-type={block.type} key={block.id}>
            <header><span>{block.type==='text'?<Type size={14}/>:block.type==='link'?<Link2 size={14}/>:<Image size={14}/>} {block.type}</span><div><button type="button" aria-label="Move block up" disabled={index===0} onClick={()=>moveBlock(index,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move block down" disabled={index===draft.blocks.length-1} onClick={()=>moveBlock(index,1)}><ArrowDown size={14}/></button><button type="button" aria-label="Remove block" onClick={()=>removeBlock(block.id)}><Trash2 size={14}/></button></div></header>
            {block.type==='text'&&<textarea value={block.text} onChange={event=>changeBlock(block.id,{text:event.target.value})} placeholder="Write your note…" rows={7} maxLength={100000}/>} 
            {block.type==='link'&&<div className="note-link-fields"><label>Link label<input name="label" value={block.label} onChange={event=>changeBlock(block.id,{label:event.target.value})} placeholder="PostgreSQL documentation" maxLength={300}/></label><label>URL<input name="url" type="url" value={block.url} onChange={event=>changeBlock(block.id,{url:event.target.value})} placeholder="https://…" maxLength={2000}/></label>{safeLink(block.url)&&<a className="note-preview-link" href={block.url} target="_blank" rel="noreferrer"><Link2 size={14}/>{block.label||block.url}</a>}</div>}
            {block.type==='image'&&<div className="note-image-fields"><label className="note-image-picker"><Image size={17}/><span>{block.name||'Choose image · max 2 MB'}</span><input className="note-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>upload(block,event.target.files?.[0])}/></label>{block.dataUrl&&<div className="note-image-preview"><img src={block.dataUrl} alt={block.alt}/></div>}<label>Image description<input name="alt" value={block.alt} onChange={event=>changeBlock(block.id,{alt:event.target.value})} placeholder="Describe this image" maxLength={500}/></label></div>}
          </article>)}</div>
          <div className="note-builder-toolbar" aria-label="Add note block"><span>Add block</span><button type="button" data-add-block="text" onClick={()=>addBlock('text')}><Type size={15}/>Text</button><button type="button" data-add-block="link" onClick={()=>addBlock('link')}><Link2 size={15}/>Link</button><button type="button" data-add-block="image" onClick={()=>addBlock('image')}><Image size={15}/>Image</button></div>
        </form>}
      </section>
    </div>
  </div>;
}
