import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
await fs.mkdir('.build',{recursive:true});await fs.mkdir('.openai',{recursive:true});
if(!existsSync('.openai/hosting.json'))await fs.copyFile('.openai/hosting.example.json','.openai/hosting.json');
await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',outfile:'.build/app.js',target:'es2022'});
const css=await fs.readFile('src/app.css','utf8'),js=await fs.readFile('.build/app.js','utf8');
const appHtml=(await fs.readFile('src/app.html','utf8')).replace('/*APP_CSS*/',css).replace('/*APP_JS*/',()=>js.replaceAll('</script','<\\/script'));
const seed=existsSync('private.seed.json')?JSON.parse(await fs.readFile('private.seed.json','utf8')):{};
let planHtml='';
if(existsSync('build.py')&&existsSync('runbook.json')) {
  execFileSync('python3',['build.py'],{stdio:'inherit'});
  planHtml=await fs.readFile('dist/index.html','utf8');
  planHtml=planHtml.replace('<nav class="nav"','<a href="/applications" style="display:block;padding:12px;color:#1e6551;font-weight:650">Applications &rarr;</a><nav class="nav"');
  await fs.unlink('dist/index.html');
}
execFileSync('zip',['-q','-r','../.build/companion.zip','manifest.json','popup.html','popup.js','fill.js','README.md'],{cwd:'companion'});
const companionZip=(await fs.readFile('.build/companion.zip')).toString('base64');
await fs.writeFile('.build/assets.js',`export const appHtml=${JSON.stringify(appHtml)};\nexport const planHtml=${JSON.stringify(planHtml)};\nexport const seed=${JSON.stringify(seed)};\nexport const companionZip=${JSON.stringify(companionZip)};\n`);
