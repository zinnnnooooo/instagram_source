// Node.js 기본 모듈만 사용합니다. npm install이나 빌드가 필요 없습니다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { POST } from './api/extract.js';
import { GET } from './api/media.js';

const publicFiles = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html',['index.html','text/html; charset=utf-8']],
  ['/style.css',['style.css','text/css; charset=utf-8']],
  ['/main.js',['main.js','text/javascript; charset=utf-8']],
  ['/fonts-ui.js',['fonts-ui.js','text/javascript; charset=utf-8']],
  ['/lib/fonts.js',['lib/fonts.js','text/javascript; charset=utf-8']],
  ['/favicon.svg',['favicon.svg','image/svg+xml']],
  ['/lib/instagram-url.js',['lib/instagram-url.js','text/javascript; charset=utf-8']],
  ['/lib/zip.js',['lib/zip.js','text/javascript; charset=utf-8']],
]);
export function createServer() {
  return http.createServer(async (req,res)=>{
    const controller = new AbortController();
    res.on('close',()=>controller.abort());
    try {
      const host=req.headers.host || 'localhost';
      const url=new URL(req.url,`http://${host}`);
      let response;
      if(['/api/extract','/api/media'].includes(url.pathname)) {
        const method=url.pathname==='/api/media'?'GET':'POST';
        if(req.method!==method) response=new Response('Method not allowed',{status:405,headers:{Allow:method}});
        else {
          const options={method,headers:req.headers,signal:controller.signal};
          if(method==='POST'){options.body=Readable.toWeb(req);options.duplex='half';}
          const request=new Request(url,options);
          response=await (method==='POST'?POST(request):GET(request));
        }
      } else {
        const file=publicFiles.get(url.pathname);
        if(!file) response=new Response('Not found',{status:404});
        else if(!['GET','HEAD'].includes(req.method)) response=new Response('Method not allowed',{status:405});
        else response=new Response(req.method==='HEAD'?null:await readFile(new URL(file[0],import.meta.url)),{headers:{'Content-Type':file[1],'Cache-Control':'no-cache'}});
      }
      res.writeHead(response.status,{...Object.fromEntries(response.headers),'X-Content-Type-Options':'nosniff'});
      if(response.body) await pipeline(Readable.fromWeb(response.body),res);
      else res.end();
    } catch {
      if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'서버에서 요청을 처리하지 못했어요.'}));}
      else res.destroy();
    }
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3000);
  createServer().listen(port,'127.0.0.1',()=>console.log(`InstaSave: http://localhost:${port}`));
}
