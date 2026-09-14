import http from 'node:http';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
import { sqliteBinding } from './sqlite.mjs';
fs.mkdirSync('.local',{recursive:true});
const DB=sqliteBinding('.local/applications.db'),port=Number(process.env.PORT||8766);
const seed=fs.existsSync('private.seed.json')?JSON.parse(fs.readFileSync('private.seed.json','utf8')):{};
const server=http.createServer(async(req,res)=>{
  try {
    if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);res.end();return;}
    const headers=new Headers(req.headers);for(const k of [...headers.keys()])if(k.startsWith('oai-authenticated-user-'))headers.delete(k);
    headers.set('oai-authenticated-user-id','local-only');headers.set('oai-authenticated-user-email',seed.email||'local@example.test');
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>1000000)throw new Error('Request too large');chunks.push(c);}
    const response=await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),{DB});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local request failed.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/applications`));
const close=()=>server.close(()=>{DB.close();process.exit(0);});process.on('SIGINT',close);process.on('SIGTERM',close);
