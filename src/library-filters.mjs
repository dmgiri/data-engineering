export const sourceKind=question=>question.provenance?.kind==='candidate-reported'?'candidate-reported':'practice';

export function filterQuestions(questions,filters={},bookmarks=[]){
  const {subject='all',topic='all',subtopic='all',sourceKind:kind='all',search='',savedOnly=false}=filters;
  const query=search.trim().toLowerCase();
  return questions.filter(q=>
    (subject==='all'||q.subject===subject)&&
    (topic==='all'||q.topic===topic)&&
    (subtopic==='all'||(q.subtopic||q.title)===subtopic)&&
    (kind==='all'||sourceKind(q)===kind)&&
    (!savedOnly||bookmarks.includes(q.id))&&
    [q.title,q.topic,q.subtopic,q.prompt,...(q.answer||[]),q.code,q.provenance?.kind==='imported-collection'&&q.provenance.sourceId,...(q.provenance?.examples||[]).map(example=>example.code)].filter(Boolean).join(' ').toLowerCase().includes(query)
  );
}
