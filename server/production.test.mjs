import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductionServer} from './production.mjs';
test('production serves frontend, API and health without exposing source or secrets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'clause-production-'));
 await mkdir(join(root,'assets'));await writeFile(join(root,'index.html'),'<html>Clause</html>');await writeFile(join(root,'assets','app.js'),'console.log("Clause")');
 const server=createProductionServer({distDirectory:root,apiKey:''});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  let response=await fetch(base+'/');assert.equal(response.status,200);assert.match(await response.text(),/Clause/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  response=await fetch(base+'/assets/app.js');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  response=await fetch(base+'/health');assert.equal(await response.text(),'ok');
  response=await fetch(base+'/api/health');assert.equal((await response.json()).configured,false);
  for(const path of ['/.env','/server/index.mjs','/assets/missing.js','/%2eenv','/%5c..%5c.env']){response=await fetch(base+path);assert.equal(response.status,404,path)}
  response=await fetch(base+'/review/contract');assert.equal(response.status,200);
  response=await fetch(base+'/',{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'');
  response=await fetch(base+'/',{method:'POST'});assert.equal(response.status,405);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true})}
});
