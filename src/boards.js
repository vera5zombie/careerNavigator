import { convert } from 'html-to-text';
import { assert, safeUrl, str } from './domain.js';

export const textOnly = html => convert(String(html??''), {wordwrap:false, selectors:[
  {selector:'a',options:{ignoreHref:true}}, {selector:'img',format:'skip'},
]}).slice(0,60000);

export function boardUrl(provider, board) {
  assert(/^[a-zA-Z0-9_-]{1,80}$/.test(board),'Use the company board slug, not a URL.');
  const p=encodeURIComponent(board);
  if(provider==='greenhouse') return `https://boards-api.greenhouse.io/v1/boards/${p}/jobs?content=true`;
  if(provider==='lever') return `https://api.lever.co/v0/postings/${p}?mode=json`;
  if(provider==='ashby') return `https://api.ashbyhq.com/posting-api/job-board/${p}?includeCompensation=true`;
  assert(false,'Supported sources: Greenhouse, Lever and Ashby.');
}
export function normalize(provider, board, data, now=new Date().toISOString()) {
  const rows=provider==='lever'?data:data.jobs;
  assert(Array.isArray(rows),'The employer feed returned an unexpected format.',502);
  return rows.slice(0,5000).flatMap(r=>{
    let url; try {url=safeUrl(r.absolute_url||r.applyUrl||r.applicationUrl||r.jobUrl);} catch {return [];}
    const raw=r.content||r.descriptionPlain||r.descriptionHtml||r.description||'';
    const description=textOnly(raw)+(r.lists||[]).map(l=>'\n'+textOnly(l.text)+'\n'+textOnly(l.content)).join('');
    const c=r.compensation?.compensationTierSummary;
    return [{company:board,title:String(r.title||r.text||'Untitled role').slice(0,2000),url,
      location:String(r.location?.name||r.categories?.location||r.location||'').slice(0,2000),
      workMode:String(r.workplaceType||r.categories?.workplaceType||''),description:description.slice(0,60000),
      requirements:'',payEvidence:textOnly(c||r.salaryDescription||''),tcMin:null,tcMax:null,
      source:`${provider}:${board}`,sourceCheckedAt:now,notes:'',followup:''}];
  });
}
export async function discover(input, fetcher=fetch) {
  const provider=str(input.provider,30),board=str(input.board,80),query=str(input.query??'',200).toLowerCase(),location=str(input.location??'',200).toLowerCase();
  const response=await fetcher(boardUrl(provider,board),{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  assert(response.ok,`Employer feed unavailable (${response.status}). Check its board slug or try later.`,502);
  assert(Number(response.headers.get('content-length')||0)<12000000,'Employer feed is too large.',502);
  const reader=response.body.getReader(); const chunks=[]; let size=0;
  while(true) {const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>12000000){await reader.cancel();assert(false,'Employer feed is too large.',502);}chunks.push(value);}
  let data; try{data=JSON.parse(new TextDecoder().decode(await new Blob(chunks).arrayBuffer()));}catch{assert(false,'Employer returned invalid job data.',502);}
  const all=normalize(provider,board,data);
  const terms=query.split(/\s+/).filter(Boolean);
  const matches=all.filter(r=>terms.every(t=>r.title.toLowerCase().includes(t))&&(!location||r.location.toLowerCase().includes(location)));
  return {jobs:matches.slice(0,100),total:matches.length,checkedAt:new Date().toISOString(),truncated:matches.length>100};
}
