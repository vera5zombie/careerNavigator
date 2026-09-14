export const statuses = ['discovered','verified','review_ready','approved','preparing','submitted','interview','offer','rejected','withdrawn','expired','blocked','skipped'];
const transitions = {
  discovered:['verified','review_ready','blocked','skipped','expired'],
  verified:['review_ready','blocked','skipped','expired'],
  review_ready:['approved','blocked','skipped','expired'],
  approved:['preparing','submitted','review_ready','withdrawn','expired'],
  preparing:['submitted','review_ready','withdrawn','blocked','expired'],
  submitted:['interview','rejected','withdrawn'],
  interview:['offer','rejected','withdrawn'],
  offer:['withdrawn'], rejected:[], withdrawn:[], expired:[], skipped:['discovered'], blocked:['discovered','review_ready'],
};
export const nextStatuses = status => transitions[status] || [];
export function assert(condition, message, status=400) {
  if (!condition) throw Object.assign(new Error(message), {status});
}
export function str(value, max=1000) {
  assert(typeof value === 'string' && value.length <= max, `Expected text of at most ${max} characters.`);
  return value.trim();
}
export function safeUrl(value) {
  let u;
  try {u=new URL(value);} catch {assert(false,'Enter a complete HTTPS job URL.');}
  assert(u.protocol==='https:' && !u.username && !u.password && !u.port &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
    !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(u.hostname), 'A public HTTPS URL is required.');
  u.hash='';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) u.searchParams.delete(key);
  return u.href;
}
export function emptyProfile() {
  return {name:'',firstName:'',lastName:'',email:'',phone:'',linkedin:'',website:'',
    targetTC:250000,locations:'',officeDays:null,weeklyHours:8,facts:[]};
}
export function validateProfile(input) {
  const p=emptyProfile();
  for (const k of ['name','firstName','lastName','email','phone','linkedin','website','locations']) p[k]=str(input[k]??'',1000);
  assert(!p.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email),'Enter a valid email.');
  for(const k of ['linkedin','website']) if(p[k]) p[k]=safeUrl(p[k]);
  p.targetTC=Number(input.targetTC); assert(Number.isFinite(p.targetTC)&&p.targetTC>=0&&p.targetTC<=10000000,'Invalid compensation target.');
  p.weeklyHours=Number(input.weeklyHours); assert(p.weeklyHours>0&&p.weeklyHours<=168,'Invalid weekly hours.');
  p.officeDays=input.officeDays===null||input.officeDays===''?null:Number(input.officeDays);
  assert(p.officeDays===null || (Number.isInteger(p.officeDays)&&p.officeDays>=0&&p.officeDays<=5),'Office days must be 0 to 5 or unknown.');
  assert(Array.isArray(input.facts)&&input.facts.length<=200,'Too many evidence facts.');
  const seen=new Set();
  p.facts=input.facts.map(f=>{
    const id=str(f.id,160); assert(id&&!seen.has(id),'Evidence IDs must be unique.'); seen.add(id);
    const claim=str(f.claim,5000),source=str(f.source,1000);
    assert(claim&&source,'Each fact needs a claim and a source.');
    return {id,claim,source,confirmed:f.confirmed===true,usable:f.usable===true};
  });
  return p;
}
export function validateJob(input) {
  const j={};
  for(const k of ['company','title','location','workMode','payEvidence','notes','source']) j[k]=str(input[k]??'',k==='notes'?10000:2000);
  assert(j.company&&j.title,'Company and role are required.');
  j.url=safeUrl(input.url);j.description=str(input.description??'',60000);
  j.requirements=str(input.requirements??'',12000);
  j.followup=str(input.followup??'',10);
  assert(!j.followup || (/^\d{4}-\d{2}-\d{2}$/.test(j.followup)&&Number.isFinite(Date.parse(j.followup))&&new Date(j.followup).toISOString().slice(0,10)===j.followup),'Invalid follow-up date.');
  j.sourceCheckedAt=str(input.sourceCheckedAt??'',40);
  j.tcMin=input.tcMin===''||input.tcMin==null?null:Number(input.tcMin);
  j.tcMax=input.tcMax===''||input.tcMax==null?null:Number(input.tcMax);
  for(const n of [j.tcMin,j.tcMax]) assert(n===null||(Number.isFinite(n)&&n>=0&&n<=10000000),'Invalid annual total compensation.');
  assert(j.tcMin===null||j.tcMax===null||j.tcMin<=j.tcMax,'Compensation minimum exceeds maximum.');
  assert((j.tcMin===null&&j.tcMax===null)||j.payEvidence,'Total compensation needs a source or recruiter quote. Base salary is not total compensation.');
  return j;
}
const dictionary = [
  ['Java',/\bjava\b/i],['C++',/\bc\+\+(?=\W|$)/i],['Python',/\bpython\b/i],['Go',/\bgolang\b|\bGo\b/],
  ['Kafka',/\bkafka\b/i],['Spark',/\bspark\b/i],['Flink',/\bflink\b/i],['SQL',/\bsql\b|postgres|mysql/i],
  ['AWS',/\baws\b|amazon web services/i],['GCP',/\bgcp\b|google cloud|pub\/sub/i],
  ['Distributed systems',/distributed systems?/i],['Microservices',/micro.?services?/i],['Data pipelines',/pipeline|ingestion|backfill/i],
  ['Performance',/latency|performance|throughput/i],['Reliability',/reliability|disaster recovery|\bRTO\b|availability/i],
  ['Mentorship',/mentor/i],['Ads',/advertising|\bads\b/i],['Payments',/payments?|billing/i],
  ['Database internals',/database internals|storage engine|query execution|query engine|autotun|workload optim/i],
  ['AI/ML',/\bLLMs?\b|\bAI\b|machine learning|generative/i],
];
export function assess(job, profile) {
  const wanted=dictionary.filter(([,re])=>re.test(job.description+' '+job.requirements));
  const facts=profile.facts.filter(f=>f.confirmed&&f.usable);
  const evidence=wanted.map(([label,re])=>({label,factIds:facts.filter(f=>re.test(f.claim)).map(f=>f.id)}));
  let pay='Unknown';
  if(job.tcMin!==null&&job.tcMin>profile.targetTC) pay='Range above target';
  else if(job.tcMax!==null&&job.tcMax<=profile.targetTC) pay='Disclosed range below target';
  else if(job.tcMax!==null&&job.tcMax>profile.targetTC) pay='Range may meet target';
  return {evidence,pay,unknowns:[...evidence.filter(e=>!e.factIds.length).map(e=>`${e.label}: no confirmed evidence matched`),
    ...(!profile.locations?['Future location constraints not confirmed']:[]),
    ...(!job.workMode?['Office schedule not confirmed']:[]),
    ...(pay==='Unknown'?['Recurring annual total compensation not confirmed']:[])],
    inference:'Keyword overlap suggests relevant evidence, not demonstrated proficiency, qualification, or a hiring probability.'};
}
export function createDraft(job, profile, ids) {
  assert(Array.isArray(ids)&&ids.length>0&&ids.length<=30,'Select at least one confirmed fact.');
  const facts=[...new Set(ids)].map(id=>profile.facts.find(f=>f.id===id&&f.confirmed&&f.usable));
  assert(facts.every(Boolean),'Draft contains unconfirmed, excluded or missing evidence.');
  return {factIds:facts.map(f=>f.id),resume:[profile.name,...[profile.email,profile.phone,profile.linkedin,profile.website].filter(Boolean),
    '', 'SELECTED EXPERIENCE',...facts.map(f=>'- '+f.claim)].filter(x=>x!==undefined).join('\n'),
    letter:`Dear ${job.company} hiring team,\n\nI am applying for the ${job.title} role. Relevant experience from my background includes:\n\n${facts.map(f=>'- '+f.claim).join('\n')}\n\nThank you for considering my application.\n${profile.name}`,
    citations:facts.map(f=>({factId:f.id,source:f.source,claim:f.claim}))};
}
export function transition(job, next, input, profileRevision, now=new Date().toISOString()) {
  assert(nextStatuses(job.status).includes(next),'That status change is not available.');
  const out={...job,status:next};
  if(next==='approved') {
    assert(job.draft&&job.draftProfileRevision===profileRevision,'Create a current evidence draft before approval.');
    assert(input.review?.facts===true&&input.review?.constraints===true&&input.review?.contents===true,'Review facts, constraints and application contents first.');
    out.approval={at:now,profileRevision};
  }
  if(next==='preparing'||next==='submitted') assert(job.approval?.profileRevision===profileRevision,'This approval is stale. Review the current profile and draft.');
  if(next==='submitted') {
    assert(input.confirmed===true,'Confirm you submitted on the employer website.');
    out.receipt=str(input.receipt??'',2000); assert(out.receipt,'Record the confirmation message or receipt reference.');
    out.submittedAt=now;
  }
  if(next==='review_ready') out.approval=null;
  return out;
}
export function packet(job, profile, revision, now=new Date().toISOString()) {
  assert(['approved','preparing'].includes(job.status)&&job.approval?.profileRevision===revision&&job.draftProfileRevision===revision,'Review and approve the current application before exporting.',409);
  return {schema:'career-navigator.packet.v1',createdAt:now,expiresAt:new Date(Date.parse(now)+86400000).toISOString(),
    job:{id:job.id,url:job.url,company:job.company,title:job.title},
    contact:Object.fromEntries(['name','firstName','lastName','email','phone','linkedin','website'].map(k=>[k,profile[k]])),
    resumeText:job.draft.resume,coverLetter:job.draft.letter,submitted:false};
}
export function csv(rows) {
  const columns=['company','title','url','location','status','followup','submittedAt','notes'];
  const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  return [columns.map(cell).join(','),...rows.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\r\n');
}
