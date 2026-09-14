import { createApi } from './api.js';
import { appHtml, planHtml, seed, companionZip } from '../.build/assets.js';
const api=createApi(seed);
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    let response;
    if(url.pathname==='/health') response=new Response('ok');
    else if(url.pathname.startsWith('/api/')) response=await api(request,env);
    else if(!request.headers.get('oai-authenticated-user-id')) response=new Response('Sign in to continue.',{status:401});
    else if(url.pathname==='/companion.zip') response=new Response(Uint8Array.from(atob(companionZip),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="career-navigator-companion.zip"'}});
    else if(url.pathname==='/applications'||url.pathname==='/applications/'||(!planHtml&&url.pathname==='/')) response=new Response(appHtml,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    else if(url.pathname==='/'&&planHtml&&request.headers.get('oai-authenticated-user-email')===seed.email) response=new Response(planHtml,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    else response=new Response('Not found.',{status:404});
    const h=new Headers(response.headers);
    h.set('Cache-Control','private, no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('X-Robots-Tag','noindex, nofollow');
    h.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
    return new Response(response.body,{status:response.status,headers:h});
  },
};
