// Deterministic, data-only Markdown import. Never evaluate code, HTML or document instructions.
import {createHash} from 'node:crypto';

const prefixes={SQL:'sql',PG:'postgres',PY:'python',SPARK:'pyspark',DBX:'databricks',ARCH:'architecture'};
const sectionNames={SQL:'sql',PostgreSQL:'postgres',Python:'python',PySpark:'pyspark',Databricks:'databricks',Architecture:'architecture'};
export const collectionDocument='LinkedIn_Senior_DE_622_Interview_Questions_Answers.md';
const plain=value=>value.replace(/\x60([^\x60]+)\x60/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').trim();
const links=value=>[...value.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].flatMap(([,label,url])=>{
  try{const parsed=new URL(url);return parsed.protocol==='https:'?[{label:plain(label),url:parsed.href}]:[]}catch{return []}
});

function content(lines){
  const prose=[],examples=[];let fence=null,code=[];
  for(const line of lines){
    const marker=line.match(/^\s*(\x60{3,}|~{3,})(.*)$/);
    if(fence){
      if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim()){
        examples.push({language:fence.language,code:code.join('\n')});fence=null;code=[];
      }else code.push(line);
    }else if(marker){fence={char:marker[1][0],length:marker[1].length,language:marker[2].trim()||'text'};prose.push('');}
    else if(!/^\^[\w-]+\s*$/.test(line))prose.push(line);
  }
  if(fence)throw Error('Unclosed code fence in question.');
  return {paragraphs:prose.join('\n').split(/\n\s*\n/).map(plain).filter(Boolean),examples};
}

export function parseCollection(markdown){
  if(typeof markdown!=='string')throw TypeError('Collection must be Markdown text.');
  const normalized=markdown.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const documentHash=createHash('sha256').update(markdown).digest('hex');
  const entries=[],references=new Map();let subject=null,part='source-aligned',entry=null,fence=null,readingReferences=false;
  const flush=()=>{if(entry){entries.push(entry);entry=null}};
  for(const line of normalized.split('\n')){
    const marker=line.match(/^\s*(\x60{3,}|~{3,})(.*)$/);
    if(fence){
      entry?.lines.push(line);
      if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;
      continue;
    }
    if(marker){fence={char:marker[1][0],length:marker[1].length};entry?.lines.push(line);continue;}
    const section=line.match(/^# (SQL|PostgreSQL|Python|PySpark|Databricks|Architecture):/);
    if(section){flush();subject=sectionNames[section[1]];part='source-aligned';readingReferences=false;continue;}
    if(/^## Part [AB]\b/.test(line)){flush();part=/^## Part B\b/.test(line)?'original-practice':'source-aligned';readingReferences=false;continue;}
    if(/^## Official technical reference\s*$/.test(line)){flush();readingReferences=true;continue;}
    const heading=line.match(/^### ([A-Z][A-Z0-9]*)-(\d{3,}) [—–-] (.+)$/);
    if(heading){
      flush();const [,prefix,number,title]=heading;
      if(!prefixes[prefix])throw Error('Unsupported question subject prefix: '+prefix);
      if(prefixes[prefix]!==subject)throw Error('Question subject does not match section: '+prefix+'-'+number);
      entry={sourceId:prefix+'-'+number,subject,origin:part,title:plain(title),lines:[line]};readingReferences=false;continue;
    }
    if(readingReferences&&subject){const known=references.get(subject)||[];references.set(subject,[...known,...links(line)]);}
    else entry?.lines.push(line);
  }
  if(fence)throw Error('Unclosed code fence in collection.');
  flush();
  const seen=new Set();
  return entries.map(item=>{
    if(seen.has(item.sourceId))throw Error('Duplicate source question ID: '+item.sourceId);
    seen.add(item.sourceId);
    // Metadata markers are recognized only outside code, so code cannot become parser directives.
    const visible=[];let inside=null;
    item.lines.forEach((line,index)=>{
      const marker=line.match(/^\s*(\x60{3,}|~{3,})(.*)$/);
      if(inside){if(marker&&marker[1][0]===inside.char&&marker[1].length>=inside.length&&!marker[2].trim())inside=null;return;}
      if(marker){inside={char:marker[1][0],length:marker[1].length};return;}
      visible.push({line,index});
    });
    const find=pattern=>visible.find(({line})=>pattern.test(line))?.index??-1;
    const answerStart=find(/^(?:### Reference answer|\*\*Detailed reference answer\*\*)\s*$/);
    if(answerStart<0)throw Error('Missing reference answer: '+item.sourceId);
    const followupStart=find(/^> \[!question\]/);
    const boundary=visible.filter(({line,index})=>index>answerStart&&/^(?:### Example or implementation|\*\*Practical illustration\*\*|\*\*Public LinkedIn context:|\*\*Provenance:|> \[!question\]|\^[\w-]+)/.test(line)).map(v=>v.index)[0]??item.lines.length;
    const answer=content(item.lines.slice(answerStart+1,boundary));
    const exampleStart=find(/^(?:### Example or implementation|\*\*Practical illustration\*\*)\s*$/);
    let illustration={paragraphs:[],examples:[]};
    if(exampleStart>=0){
      const end=visible.filter(({line,index})=>index>exampleStart&&/^(?:\*\*Public LinkedIn context:|\*\*Provenance:|> \[!question\]|\^[\w-]+)/.test(line)).map(v=>v.index)[0]??item.lines.length;
      illustration=content(item.lines.slice(exampleStart+1,end));
    }
    if(!answer.paragraphs.length)throw Error('Missing answer text: '+item.sourceId);
    const metadata=visible.map(v=>v.line).join('\n');
    const description=plain(metadata.match(/^\*\*Description[^\n]*?\*\*\s*(.+)$/m)?.[1]||'');
    const topic=plain(metadata.match(/\*\*Topic:\*\*\s*([^\n]+)/)?.[1]||'Foundations & scenarios');
    const priority=metadata.match(/\*\*Priority:\*\*\s*\x60?(P[012])/)?.[1]||'P1';
    const rawType=plain(metadata.match(/\*\*Question type:\*\*\s*([^·\n]+)/)?.[1]||'');
    const examples=[...answer.examples,...illustration.examples];
    const followups=followupStart<0?[]:item.lines.slice(followupStart+1).filter(line=>/^>\s*/.test(line)&&!/^> \[!/.test(line)).map(line=>plain(line.replace(/^>\s*/,''))).filter(Boolean);
    const themeLinks=visible.filter(({line})=>/\*\*(?:Topics in publicly accessible LinkedIn posts|Public LinkedIn context):\*\*/.test(line)).flatMap(v=>links(v.line));
    const official=references.get(item.subject)||[];
    if(!official.length)throw Error('Missing technical reference for subject: '+item.subject);
    return {
      id:'collection622-'+item.sourceId.toLowerCase(),subject:item.subject,topic,
      subtopic:rawType||'Applied questions',title:item.title,prompt:item.title,difficulty:'Senior',
      type:rawType|| (examples.length?'Coding':'Concept'),minutes:/Scenario|implementation/.test(rawType)?12:8,
      answer:[...answer.paragraphs,...illustration.paragraphs.map(p=>'Example: '+p)],
      code:examples[0]?.code||'',language:examples[0]?.language||'text',pitfalls:[],followups,
      sourceUrl:official[0].url,
      provenance:{kind:'imported-collection',sourceId:item.sourceId,sourceDocument:collectionDocument,documentHash,
        description,priority,origin:item.origin,references:themeLinks,examples,
        rawMarkdown:item.lines.join('\n').trim(),
        originalStatement:plain(metadata.match(/^\*\*Provenance:\*\*\s*(.+)$/m)?.[1]||'')}
    };
  });
}
