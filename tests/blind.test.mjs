import test from 'node:test';
import a from 'node:assert/strict';
import { blindScreen,validateJob,transition,packet,csv } from '../src/domain.js';
import { createApi } from '../src/api.js';
import { sqliteBinding } from '../tools/sqlite.mjs';
const base={company:'Sample',title:'Engineer',url:'https://jobs.lever.co/sample/role',description:'Java APIs',blindSourceUrl:'https://www.teamblind.com/company/Sample/reviews',blindCheckedDate:'2026-09-14'};
test('Blind veto uses OR, exact cutoffs pass and missing values never count as a pass',()=>{
 for(const [wlb,overall,result] of [[2.99,5,'no'],[5,3.49,'no'],[2,2,'no'],[3,3.5,'pass'],[3.01,3.51,'pass'],[null,null,'unknown'],[3,null,'unknown'],[null,4,'unknown'],[2.9,null,'no'],[null,3.4,'no']]){
   a.equal(blindScreen({...base,blindWorkLifeBalance:wlb,blindOverall:overall}).status,result);
 }
 a.equal(blindScreen({}).status,'unknown');
 a.equal(blindScreen({blindWorkLifeBalance:5,blindOverall:5}).status,'unknown');
});
test('ratings need provenance and valid numbers; blank is not zero',()=>{
 a.equal(validateJob({...base,blindWorkLifeBalance:' ',blindOverall:''}).blindWorkLifeBalance,null);
 a.equal(validateJob({...base,blindWorkLifeBalance:'3.0',blindOverall:'3.5'}).blindOverall,3.5);
 for(const invalid of [-1,0,5.1,'NaN',true,[],{}])a.throws(()=>validateJob({...base,blindOverall:invalid}));
 a.throws(()=>validateJob({...base,blindOverall:4,blindSourceUrl:''}));
 a.throws(()=>validateJob({...base,blindOverall:4,blindCheckedDate:''}));
 a.throws(()=>validateJob({...base,blindOverall:4,blindCheckedDate:'2026-02-30'}));
 a.throws(()=>validateJob({...base,blindOverall:4,blindCheckedDate:'2999-01-01'}));
 a.throws(()=>validateJob({...base,blindOverall:4,blindSourceUrl:'https://teamblind.com.evil.example.com/reviews'}));
});
test('higher pay cannot override a veto, including direct API packet calls',()=>{
 const no={...base,blindOverall:3.4,blindWorkLifeBalance:5,tcMin:900000,status:'review_ready',draft:{},draftProfileRevision:1};
 a.throws(()=>transition(no,'approved',{review:{facts:true,constraints:true,contents:true}},1),/Blind minimums/);
 a.throws(()=>transition({...no,status:'approved',approval:{profileRevision:1}},'preparing',{},1),/Blind minimums/);
 a.throws(()=>packet({...no,status:'approved',approval:{profileRevision:1}},{},1),/Blind minimums/);
 a.equal(transition({...no,blindOverall:null,blindWorkLifeBalance:null},'approved',{review:{facts:true,constraints:true,contents:true}},1).status,'approved');
});
test('saved rating changes preserve drafts and submission history while invalidating approval',async()=>{
 const DB=sqliteBinding(),api=createApi(),origin='https://navigator.example.com';
 const call=async(path,method='GET',data)=>{const r=await api(new Request(origin+'/api'+path,{method,headers:{'oai-authenticated-user-id':'owner',Origin:origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),{DB});return {status:r.status,data:await r.json()};};
 try{
 const p=(await call('/state')).data.profile;
 await call('/profile','PUT',{...p,facts:[{id:'f',claim:'Built Java APIs',source:'Candidate resume',confirmed:true,usable:true}]});
 let j=(await call('/jobs','POST',{...base,blindOverall:4,blindWorkLifeBalance:3})).data.job;
 j=(await call(`/jobs/${j.id}/draft`,'POST',{revision:j.revision,factIds:['f']})).data;
 const review={facts:true,constraints:true,contents:true};
 j=(await call(`/jobs/${j.id}/transition`,'POST',{revision:j.revision,status:'approved',review})).data;
 j=(await call(`/jobs/${j.id}`,'PUT',{...j,blindOverall:3.4})).data;
 a.equal(j.status,'review_ready');a.equal(j.approval,null);a.ok(j.draft.resume.includes('Built Java APIs'));
 a.equal((await call(`/jobs/${j.id}/transition`,'POST',{revision:j.revision,status:'approved',review})).status,400);
 j=(await call(`/jobs/${j.id}`,'PUT',{...j,blindOverall:3.5})).data;
 j=(await call(`/jobs/${j.id}/transition`,'POST',{revision:j.revision,status:'approved',review})).data;
 j=(await call(`/jobs/${j.id}/transition`,'POST',{revision:j.revision,status:'submitted',confirmed:true,receipt:'Employer confirmation'})).data;
 const submittedAt=j.submittedAt;
 j=(await call(`/jobs/${j.id}`,'PUT',{...j,blindWorkLifeBalance:2.5})).data;
 a.equal(j.status,'submitted');a.equal(j.submittedAt,submittedAt);a.equal(blindScreen(j).status,'no');
 a.equal((await call('/state')).data.jobs[0].blindWorkLifeBalance,2.5);
 a.ok(csv([j]).includes('"No"'));
 }finally{DB.close();}
});
