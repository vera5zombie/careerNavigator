import test from 'node:test';import a from 'node:assert/strict';
import { fillReviewedFields } from '../companion/fill.js';
const packet={schema:'career-navigator.packet.v1',expiresAt:'2099-01-01',submitted:false,job:{url:'https://jobs.lever.co/sample/role'},contact:{name:'Sample Person',email:'sample@example.com'},resumeText:'Confirmed experience'};
class Input {
 constructor(name,type='text',initial=''){Object.assign(this,{name,id:name,type,labels:[{textContent:name}],tagName:'INPUT',_value:initial,maxLength:-1,required:true,events:[]});}
 get value(){return this._value;}set value(v){this._value=v;}
 getClientRects(){return [{}];}getAttribute(){return null;}dispatchEvent(e){this.events.push(e.type);}
}
test('autofill fills exact known fields, skips custom and sensitive fields, never submits',()=>{
 const fields=[new Input('name'),new Input('email'),new Input('phone','tel','Already filled'),new Input('salary'),new Input('visa'),new Input('question_1'),new Input('resume','file'),new Input('agree','checkbox'),new Input('submit','submit')];
 globalThis.location=new URL(packet.job.url);globalThis.document={querySelectorAll:()=>fields};globalThis.HTMLInputElement=Input;globalThis.HTMLTextAreaElement=Input;
 try{const result=fillReviewedFields(packet);a.deepEqual(result.filled,['name','email']);a.equal(result.submitted,false);a.equal(fields[0].value,'Sample Person');a.equal(fields[2].value,'Already filled');for(const f of fields.slice(3))a.equal(f.value,'');}finally{delete globalThis.location;delete globalThis.document;delete globalThis.HTMLInputElement;delete globalThis.HTMLTextAreaElement;}
});
test('autofill rejects wrong role, unsupported domains and expired packets',()=>{
 try {globalThis.location=new URL('https://jobs.lever.co/sample/wrong');a.throws(()=>fillReviewedFields(packet),/reviewed job URL/);
 globalThis.location=new URL('https://evil.example.com/sample/role');a.throws(()=>fillReviewedFields({...packet,job:{url:location.href}}),/reviewed job URL/);
 globalThis.location=new URL(packet.job.url);a.throws(()=>fillReviewedFields({...packet,expiresAt:'2020-01-01'}),/expired/);a.throws(()=>fillReviewedFields({...packet,expiresAt:''}),/invalid/);
 } finally{delete globalThis.location;}
});
