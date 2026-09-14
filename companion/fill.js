// Self-contained because Chrome serializes this function into the active tab.
export function fillReviewedFields(packet, dryRun=false) {
  const normalizeUrl=value=>{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|ref$|source$)/i.test(k))u.searchParams.delete(k);u.pathname=u.pathname.replace(/\/apply\/?$/,'').replace(/\/$/,'');return u.href;};
  const allowed=['job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.eu.lever.co','jobs.ashbyhq.com'];
  if(!allowed.includes(location.hostname)||normalizeUrl(location.href)!==normalizeUrl(packet.job.url))throw new Error('This tab is not the reviewed job URL on a supported employer board.');
  if(!Number.isFinite(Date.parse(packet.expiresAt))||Date.parse(packet.expiresAt)<=Date.now()||packet.schema!=='career-navigator.packet.v1'||packet.submitted!==false)throw new Error('The packet has expired or is invalid. Export a newly reviewed packet.');
  const normalize=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_:*]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const aliases={
    'first name':'firstName','last name':'lastName','full name':'name','name':'name',
    'email':'email','email address':'email','phone':'phone','phone number':'phone',
    'linkedin':'linkedin','linkedin profile':'linkedin','linkedin url':'linkedin',
    'website':'website','personal website':'website','portfolio url':'website',
    'resume text':'resumeText','cover letter':'coverLetter','cover letter text':'coverLetter',
  };
  const filled=[],skipped=[];
  for(const el of document.querySelectorAll('input,textarea')) {
    if(el.disabled||el.readOnly||!el.getClientRects().length||!['text','email','tel','url','textarea'].includes(el.type))continue;
    const labels=[...(el.labels||[])].map(l=>l.textContent);
    const candidates=[...labels,el.getAttribute('aria-label'),el.name,el.id].filter(Boolean);
    const label=candidates[0]||'Unlabelled field';
    if(candidates.some(s=>/salary|compensation|visa|sponsor|citizen|gender|race|ethnic|disab|veteran|consent|agree|legal|authorize|current.company/i.test(s)))continue;
    const keys=[...new Set(candidates.map(s=>aliases[normalize(s)]).filter(Boolean))];
    if(keys.length!==1){if(el.required&&!el.value)skipped.push(label);continue;}
    const key=keys[0],value=packet.contact[key]||(['resumeText','coverLetter'].includes(key)?packet[key]:'');
    if(el.value||!value){if(el.required&&!el.value)skipped.push(label);continue;}
    if(el.maxLength>0&&value.length>el.maxLength){skipped.push(label);continue;}
    if(!dryRun){const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    filled.push(label);
  }
  return {filled,skipped,submitted:false};
}
