const normalize=value=>value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const clean=value=>value.trim().replace(/^\*\*(.*)\*\*$/,'$1').trim();

function headingMap(markdown){
  const lines=normalize(markdown).split('\n');
  const headings=[];
  let fence=null;
  lines.forEach((line,index)=>{
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(!fence&&marker){
      const token=marker[1];
      fence={character:token[0],length:token.length};
      return;
    }
    if(fence){
      if(marker){
        const token=marker[1];
        if(token[0]===fence.character&&token.length>=fence.length&&/^[ \t]*$/.test(marker[2]))fence=null;
      }
      return;
    }
    const match=line.match(/^(##|###) (?!#)(.+?)\s*$/);
    if(match)headings.push({level:match[1].length,title:clean(match[2]),line:index});
  });
  if(fence)throw new Error('Study material contains an unclosed fenced code block.');
  return {lines,headings};
}

const markdownBetween=(lines,start,end)=>lines.slice(start,end).join('\n').trim();
const groupForDay=day=>{
  if(day<=7)return 'SQL & PostgreSQL';
  if(day===8)return 'Python';
  if(day<=14)return 'PySpark';
  if(day<=21)return 'Databricks';
  if(day<=24)return 'System design';
  if(day===25)return 'SQL & PostgreSQL';
  return 'Interview rehearsal';
};

/** Parse a trusted local Markdown snapshot as inert content. No Markdown is evaluated here. */
export function parseStudyMaterial(markdown,{id='senior-de-30-day',sourceDocument='30-day-data-engineering-interview-prep.md',hash=''}={}){
  if(typeof markdown!=='string'||!markdown.trim())throw new Error('Study material must be non-empty Markdown.');
  const normalized=normalize(markdown);
  const {lines,headings}=headingMap(normalized);
  const h1=lines.find(line=>/^# (?!#)/.test(line));
  if(!h1)throw new Error('Study material is missing its title.');
  const levelTwo=headings.filter(heading=>heading.level===2);
  const dayHeadings=levelTwo.map((heading,index)=>{
    const match=heading.title.match(/^Day (\d{2}) · (.+)$/);
    return match?{...heading,day:Number(match[1]),dayTitle:clean(match[2]),blockEnd:levelTwo[index+1]?.line??lines.length}:null;
  }).filter(Boolean);
  if(dayHeadings.length!==30)throw new Error(`Expected 30 study days, found ${dayHeadings.length}.`);
  dayHeadings.forEach((heading,index)=>{
    const expected=index+1;
    if(heading.day!==expected)throw new Error(`Expected Day ${String(expected).padStart(2,'0')}, found Day ${String(heading.day).padStart(2,'0')}.`);
  });
  const days=dayHeadings.map(dayHeading=>{
    const sectionHeadings=headings.filter(heading=>heading.level===3&&heading.line>dayHeading.line&&heading.line<dayHeading.blockEnd);
    const dayPrefix=`${id}-day-${String(dayHeading.day).padStart(2,'0')}`;
    const sections=[{
      id:`${dayPrefix}-briefing`,title:'Day briefing',markdown:markdownBetween(lines,dayHeading.line+1,sectionHeadings[0]?.line??dayHeading.blockEnd),order:0
    },...sectionHeadings.map((heading,index)=>({
      id:`${dayPrefix}-section-${String(index+1).padStart(2,'0')}`,
      title:heading.title,
      markdown:markdownBetween(lines,heading.line+1,sectionHeadings[index+1]?.line??dayHeading.blockEnd),
      order:index+1
    }))];
    if(sections.some(section=>!section.markdown))throw new Error(`Day ${String(dayHeading.day).padStart(2,'0')} contains an empty study section.`);
    return {id:dayPrefix,day:dayHeading.day,title:dayHeading.dayTitle,group:groupForDay(dayHeading.day),sections};
  });
  const resources=[];
  const firstLevelTwo=levelTwo[0]?.line??lines.length;
  const preface=markdownBetween(lines,1,firstLevelTwo);
  if(preface)resources.push({id:`${id}-resource-00`,title:'Workbook introduction',markdown:preface,order:0});
  levelTwo.forEach((heading,index)=>{
    if(/^Day \d{2} · /.test(heading.title))return;
    resources.push({
      id:`${id}-resource-${String(resources.length).padStart(2,'0')}`,
      title:heading.title,
      markdown:markdownBetween(lines,heading.line+1,levelTwo[index+1]?.line??lines.length),
      order:resources.length
    });
  });
  return {
    id,
    title:clean(h1.replace(/^# /,'')),
    description:'Senior Data Engineer study notes and interview workbook covering SQL, Python, PySpark, Databricks, and system design.',
    source:{document:sourceDocument,hash},
    days,
    resources
  };
}
