import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from '../server.js';
test('standalone server serves vanilla assets and enforces API boundaries',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const path of ['/','/style.css','/main.js','/lib/zip.js','/lib/instagram-url.js','/favicon.svg','/fonts-ui.js','/lib/fonts.js'])assert.equal((await fetch(base+path)).status,200);
  assert.equal((await fetch(base+'/server.js')).status,404);
  for(const path of ['/.env','/.env.example','/prompts/person-intro.txt'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/api/intro')).status,404);
  assert.equal((await fetch(base+'/api/extract')).status,405);
  const invalid=await fetch(base+'/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'bad'})});assert.equal(invalid.status,400);assert.equal((await invalid.json()).code,'INVALID_URL');
  assert.equal((await fetch(base+'/api/extract',{method:'POST',headers:{origin:'https://other.test'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/media?url=https://127.0.0.1/private')).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
