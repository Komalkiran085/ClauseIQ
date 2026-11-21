import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createApi} from './index.mjs';
const defaultDist=fileURLToPath(new URL('../dist/',import.meta.url));
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
export function createProductionServer({distDirectory=defaultDist,...apiOptions}={}){
 const api=createApi(apiOptions);
 const root=resolve(distDirectory);
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Cache-Control','no-store');
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end('Bad request');return}
  if(pathname.startsWith('/api/')){api.emit('request',req,res);return}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}
  if(pathname==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end(req.method==='HEAD'?'':'ok');return}
  if(pathname.includes('\0')||pathname.split('/').some(part=>part.startsWith('.')||part.includes('\\'))){res.writeHead(404);res.end('Not found');return}
  let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(404);res.end('Not found');return}
  try{
   let info;
   try{info=await stat(file)}catch{}
   if(!info?.isFile()){
    if(extname(pathname)){res.writeHead(404);res.end('Not found');return}
    file=resolve(root,'index.html');info=await stat(file);
   }
   res.writeHead(200,{'Content-Type':contentTypes[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':file.includes(sep+'assets'+sep)?'public, max-age=31536000, immutable':'no-cache'});
   if(req.method==='HEAD'){res.end();return}
   createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(503);res.end('Frontend build unavailable. Run npm run build first.')}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT||3001);
 createProductionServer().listen(port,'0.0.0.0',()=>console.log(`Clause production server listening on port ${port}`));
}
