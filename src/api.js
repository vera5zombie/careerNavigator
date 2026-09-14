import { assert, str, emptyProfile, validateProfile, validateJob, createDraft, transition, packet, csv } from './domain.js';
import { discover } from './boards.js';

export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const at=()=>new Date().toISOString();
async function body(request) {
  assert((request.headers.get('content-type')||'').startsWith('application/json'),'JSON is required.',415);
  assert(Number(request.headers.get('content-length')||0)<1000000,'Request is too large.',413);
  const text=await request.text();assert(text.length<1000000,'Request is too large.',413);
  let parsed; try {parsed=JSON.parse(text);} catch {assert(false,'Invalid JSON.');}
  assert(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'Expected an object.'); return parsed;
}
const decoded = r => r?{...JSON.parse(r.data),revision:r.revision}:null;

export function createApi(seed={}) {
  return async function api(request, env) {
    try {
      const owner=request.headers.get('oai-authenticated-user-id');
      assert(owner,'Sign in to open your application workspace.',401);
      const url=new URL(request.url),method=request.method;
      if(method!=='GET') {
        assert(request.headers.get('origin')===url.origin && request.headers.get('sec-fetch-site')!=='cross-site','Cross-site changes are not allowed.',403);
      }
      assert(env.DB,'Application storage is unavailable.',503);
      const db=env.DB;
      const seeded=seed.email && request.headers.get('oai-authenticated-user-email')===seed.email;
      const init=await db.prepare('INSERT OR IGNORE INTO profiles(owner,data,revision) VALUES(?,?,0)').bind(owner,JSON.stringify(seeded?validateProfile(seed.profile):emptyProfile())).run();
      if(init.meta.changes===1&&seeded&&seed.jobs?.length) {
        const initial=seed.jobs.map(input=>({...validateJob(input),id:crypto.randomUUID(),status:'discovered',createdAt:at(),updatedAt:at(),draft:null,approval:null}));
        await db.batch(initial.map(j=>db.prepare('INSERT OR IGNORE INTO applications(id,owner,url,status,data,revision,updated) VALUES(?,?,?,?,?,0,?)').bind(j.id,owner,j.url,j.status,JSON.stringify(j),j.updatedAt)));
      }
      const profile=decoded(await db.prepare('SELECT data,revision FROM profiles WHERE owner=?').bind(owner).first());
      if(url.pathname==='/api/state'&&method==='GET') {
        const rows=await db.prepare('SELECT data,revision FROM applications WHERE owner=? ORDER BY updated DESC LIMIT 1000').bind(owner).all();
        return json({profile,jobs:rows.results.map(decoded)});
      }
      if(url.pathname==='/api/profile'&&method==='PUT') {
        const input=await body(request),p=validateProfile(input);
        const result=await db.prepare('UPDATE profiles SET data=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(p),owner,input.revision).run();
        assert(result.meta.changes===1,'Your profile changed elsewhere. Reload before saving.',409);
        return json({...p,revision:input.revision+1});
      }
      if(url.pathname==='/api/discover'&&method==='POST') return json(await discover(await body(request)));
      if(url.pathname==='/api/jobs'&&method==='POST') {
        const input=await body(request),data=validateJob(input);
        assert((await db.prepare('SELECT count(*) AS n FROM applications WHERE owner=?').bind(owner).first()).n<1000,'This workspace has reached 1,000 applications.');
        const existing=await db.prepare('SELECT data,revision FROM applications WHERE owner=? AND url=?').bind(owner,data.url).first();
        if(existing) return json({job:decoded(existing),duplicate:true});
        const job={...data,id:crypto.randomUUID(),status:'discovered',createdAt:at(),updatedAt:at(),draft:null,approval:null};
        try {await db.batch([
          db.prepare('INSERT INTO applications(id,owner,url,status,data,revision,updated) VALUES(?,?,?,?,?,0,?)').bind(job.id,owner,job.url,job.status,JSON.stringify(job),job.updatedAt),
          db.prepare('INSERT INTO events(id,owner,job_id,action,timestamp) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),owner,job.id,'discovered',at()),
        ]);} catch(e) {
          if(String(e).includes('UNIQUE')) return json({job:decoded(await db.prepare('SELECT data,revision FROM applications WHERE owner=? AND url=?').bind(owner,data.url).first()),duplicate:true});
          throw e;
        }
        return json({job:{...job,revision:0},duplicate:false},201);
      }
      if(url.pathname==='/api/export'&&method==='GET') {
        const rows=await db.prepare('SELECT data,revision FROM applications WHERE owner=? ORDER BY updated DESC').bind(owner).all();
        return new Response(csv(rows.results.map(decoded)),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="applications.csv"','Cache-Control':'private, no-store'}});
      }
      const match=url.pathname.match(/^\/api\/jobs\/([a-z0-9-]{36})(?:\/(draft|answer|transition|packet|events))?$/);
      assert(match,'Not found.',404);
      const [,id,action]=match;
      const current=decoded(await db.prepare('SELECT data,revision FROM applications WHERE owner=? AND id=?').bind(owner,id).first());
      assert(current,'Application not found.',404);
      if(method==='GET'&&action==='packet') return json(packet(current,profile,profile.revision));
      if(method==='GET'&&action==='events') return json((await db.prepare('SELECT action,timestamp FROM events WHERE owner=? AND job_id=? ORDER BY timestamp DESC').bind(owner,id).all()).results);
      const input=await body(request);
      assert(input.revision===current.revision,'This application changed elsewhere. Reload before saving.',409);
      let updated, event='edited';
      if(method==='PUT'&&!action) {
        updated={...current,...validateJob(input)};
        const material=['url','company','title','description','requirements','location','workMode','tcMin','tcMax','payEvidence'].some(k=>updated[k]!==current[k]);
        if(material) {
          assert(!['submitted','interview','offer','rejected','withdrawn'].includes(current.status),'Keep submitted content unchanged. Notes and follow-up dates can still be edited.');
          updated.draft=null;updated.approval=null;updated.answers=[];
          if(['approved','preparing','review_ready'].includes(updated.status)) updated.status='discovered';
        }
      } else if(method==='POST'&&action==='draft') {
        assert(!['submitted','interview','offer','rejected','withdrawn','expired','skipped'].includes(current.status),'This application is closed for drafting.');
        updated={...current,draft:createDraft(current,profile,input.factIds),draftProfileRevision:profile.revision,answers:current.draftProfileRevision===profile.revision?(current.answers||[]):[],approval:null,status:'review_ready'};
        event='drafted';
      } else if(method==='POST'&&action==='answer') {
        assert(['review_ready','approved','preparing'].includes(current.status)&&current.draftProfileRevision===profile.revision,'Generate a current draft first.');
        const question=str(input.question??'',2000);assert(question,'Enter an application question.');
        const evidence=createDraft(current,profile,input.factIds);
        const answers=[...(current.answers||[]),{question,text:evidence.citations.map(c=>c.claim).join('\n\n'),citations:evidence.citations}];
        assert(answers.length<=20,'At most 20 answer drafts per application.');
        updated={...current,answers,approval:null,status:'review_ready'};event='answer drafted';
      } else if(method==='POST'&&action==='transition') {
        updated=transition(current,input.status,input,profile.revision);event=updated.status;
      } else assert(false,'Method not allowed.',405);
      updated.updatedAt=at();delete updated.revision;
      const results=await db.batch([
        db.prepare('UPDATE applications SET url=?,status=?,data=?,revision=revision+1,updated=? WHERE owner=? AND id=? AND revision=?')
          .bind(updated.url,updated.status,JSON.stringify(updated),updated.updatedAt,owner,id,input.revision),
        db.prepare('INSERT INTO events(id,owner,job_id,action,timestamp) SELECT ?,?,?,?,? WHERE changes()=1')
          .bind(crypto.randomUUID(),owner,id,event,updated.updatedAt),
      ]);
      assert(results[0].meta.changes===1,'This application changed elsewhere. Reload before saving.',409);
      return json({...updated,revision:input.revision+1});
    } catch(error) {
      return json({error:error.status?error.message:'Unable to save or load this workspace. Please try again.'},error.status||500);
    }
  };
}
