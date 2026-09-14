import test from 'node:test';import a from 'node:assert/strict';
import {boardUrl,normalize,discover} from '../src/boards.js';
test('source URLs are fixed to supported public APIs',()=>{
 a.throws(()=>boardUrl('greenhouse','../private'));a.throws(()=>boardUrl('other','company'));
 a.equal(new URL(boardUrl('ashby','sample')).hostname,'api.ashbyhq.com');
});
test('employer HTML is converted to inert text, salary is not silently assigned to TC',()=>{
 const rows=normalize('greenhouse','sample',{jobs:[{title:'Engineer',content:'&lt;p&gt;Java &amp;amp; Kafka&lt;/p&gt;',absolute_url:'https://jobs.example.com/123',location:{name:'NYC'}}]});
 a.equal(rows.length,1);a.equal(rows[0].tcMax,null);a.ok(rows[0].description.includes('Java'));
});
test('discovery filters, limits, source errors and unsafe redirects',async()=>{
 let options;
 const mock=async(url,opts)=>{options=opts;return Response.json([{text:'Java Engineer',descriptionPlain:'Build APIs',applyUrl:'https://jobs.lever.co/sample/1',categories:{location:'NYC'}},{text:'Designer',descriptionPlain:'Design',applyUrl:'https://jobs.lever.co/sample/2'}]);};
 const result=await discover({provider:'lever',board:'sample',query:'java',location:'nyc'},mock);a.equal(result.jobs.length,1);a.equal(options.redirect,'error');
 await a.rejects(()=>discover({provider:'lever',board:'sample'},async()=>new Response('',{status:429})),/429/);
});
