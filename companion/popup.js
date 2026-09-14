import { fillReviewedFields } from './fill.js';
const file=document.getElementById('packet'),button=document.getElementById('fill'),result=document.getElementById('result');
let packet;
file.addEventListener('change',async()=>{
  button.disabled=true;packet=null;result.textContent='';
  try {
    const f=file.files[0];if(!f||f.size>1000000)throw new Error('Select an application packet under 1 MB.');
    const p=JSON.parse(await f.text());
    if(p.schema!=='career-navigator.packet.v1'||!p.job?.url||!p.contact||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.now())throw new Error('Select a valid, unexpired approved application packet.');
    packet=p;document.getElementById('job').textContent=`${p.job.company}: ${p.job.title}\n${p.job.url}`;button.disabled=false;
  } catch(e){result.textContent=e.message;}
});
button.addEventListener('click',async()=>{
  button.disabled=true;
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const rows=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillReviewedFields,args:[packet]});
    const r=rows[0]?.result;if(!r)throw new Error('This form could not be filled.');
    result.textContent=`Filled ${r.filled.length} fields.\n${r.filled.join(', ')}${r.skipped.length?'\nStill needs attention: '+r.skipped.join(', '):''}\nNothing was submitted.`;
  }catch(e){result.textContent=e.message;}finally{button.disabled=false;}
});
