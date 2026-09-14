import test from 'node:test';
import a from 'node:assert/strict';
import { emptyProfile,validateProfile,validateJob,assess,createDraft,transition,packet,csv,safeUrl } from '../src/domain.js';
const fact={id:'f1',claim:'Built Java and Kafka backend services.',source:'Candidate resume',confirmed:true,usable:true};
const profile={...emptyProfile(),name:'Sample Candidate',facts:[fact,{...fact,id:'f2',claim:'Worked on a C++ query engine.',confirmed:false}]};
const job={...validateJob({company:'Example',title:'Backend Engineer',url:'https://jobs.lever.co/example/123',description:'Java Kafka C++ query engine Flink',location:'New York'}),status:'discovered',id:'j1'};
test('URL validation blocks unsafe protocols, credentials, IPs and private hosts',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://127.0.0.1','https://user:pass@example.com','https://foo.local'])a.throws(()=>safeUrl(url));
 a.equal(safeUrl('https://jobs.lever.co/example/123?utm_source=a#form'),'https://jobs.lever.co/example/123');
});
test('matching does not count unconfirmed evidence or claim qualification',()=>{
 const r=assess(job,profile);a.equal(r.pay,'Unknown');a.ok(r.unknowns.some(x=>x.startsWith('C++')));a.ok(r.unknowns.some(x=>x.startsWith('Flink')));a.equal(r.evidence.find(e=>e.label==='Java').factIds[0],'f1');
});
test('draft copies selected facts without importing job requirements',()=>{
 const draft=createDraft(job,profile,['f1']);a.ok(draft.resume.includes(fact.claim));a.ok(!draft.resume.includes('C++'));a.ok(!draft.letter.includes('Flink'));a.throws(()=>createDraft(job,profile,['f2']));a.throws(()=>createDraft(job,profile,['unknown']));a.throws(()=>createDraft(job,profile,[]));
});
test('approval needs three reviews and a current draft',()=>{
 const draftJob={...job,status:'review_ready',draft:createDraft(job,profile,['f1']),draftProfileRevision:1};
 a.throws(()=>transition(draftJob,'approved',{review:{facts:true}},1));
 a.throws(()=>transition(draftJob,'approved',{review:{facts:true,constraints:true,contents:true}},2));
 const approved=transition(draftJob,'approved',{review:{facts:true,constraints:true,contents:true}},1);
 a.equal(packet(approved,profile,1).submitted,false);a.throws(()=>packet(approved,profile,2));
 a.throws(()=>transition(approved,'submitted',{},1));
 a.equal(transition(approved,'submitted',{confirmed:true,receipt:'Employer confirmation displayed'},1).status,'submitted');
});
test('compensation evidence is required and unknown remains unknown',()=>{
 a.throws(()=>validateJob({...job,tcMin:270000}));
 const pay={...job,tcMin:200000,tcMax:280000,payEvidence:'Recruiter annual TC estimate'};a.equal(assess(pay,profile).pay,'Range may meet target');
 a.equal(assess({...job,tcMin:250001},profile).pay,'Range above target');a.equal(assess({...job,tcMax:250000},profile).pay,'Disclosed range below target');
});
test('profile validates sources, identities and constraints',()=>{
 a.equal(validateProfile(profile).officeDays,null);a.throws(()=>validateProfile({...profile,facts:[fact,fact]}));a.throws(()=>validateProfile({...profile,email:'broken'}));
});
test('CSV escapes quotes and formulas',()=>{const result=csv([{company:'=SUM(1)',title:'A "role"',notes:'+cmd'}]);a.ok(result.includes('"\'=SUM(1)"'));a.ok(result.includes('"A ""role"""'));a.ok(result.includes('"\'+cmd"'));});
