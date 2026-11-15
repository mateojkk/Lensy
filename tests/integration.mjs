import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base=process.env.LENSY_TEST_URL||'http://localhost:5173';
// Optional owner-private Site access is read only from stdin, never argv or disk.
if(process.env.LENSY_TEST_SERVICE_ACCESS==='1') {
  const input=await new Promise(resolve=>{
    let value='';const terminal=process.stdin.isTTY;
    if(terminal)process.stdin.setRawMode(true);
    console.log('Ready for test access JSON on stdin (input hidden).');
    process.stdin.setEncoding('utf8');
    const onData=chunk=>{value+=chunk;if(/[\r\n]/.test(value)){process.stdin.removeListener('data',onData);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);}};
    process.stdin.on('data',onData);process.stdin.resume();
  });
  const {token}=JSON.parse(input);
  const directFetch=globalThis.fetch;
  globalThis.fetch=(url,options={})=>{
    if(new URL(url).origin!==new URL(base).origin) throw new Error('Service access is restricted to the selected Site.');
    return directFetch(url,{...options,redirect:'manual',headers:{...options.headers,'OAI-Sites-Authorization':'Bearer '+token}});
  };
}
let cookie='';
async function request(path,options={}) {
  const headers={origin:base,...(cookie?{cookie}:{}),...options.headers};
  const response=await fetch(base+path,{...options,headers});
  return {response,data:await response.json()};
}
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const config=await request('/api/config');
assert.equal(config.response.status,200);
cookie=config.response.headers.get('set-cookie')?.split(';')[0]||'';
assert.ok(cookie,'Session cookie is set');

const empty=await request('/api/checks');assert.equal(empty.response.status,200);
const badURL=await request('/api/checks',post({url:'http://127.0.0.1/private'}));assert.equal(badURL.response.status,400);
const forged=await fetch(base+'/api/checks',{...post({url:'https://example.com/a.jpg'}),headers:{'Content-Type':'application/json',origin:'https://other.example',cookie}});assert.equal(forged.status,403);

const form=new FormData();form.append('file',new File([await readFile(new URL('../public/images/coast.jpg',import.meta.url))],'test-coast.jpg',{type:'image/jpeg'}));
const upload=await request('/api/checks',{method:'POST',body:form});
assert.equal(upload.response.status,201,JSON.stringify(upload.data));
const c=upload.data.check;assert.equal(c.verdict,'Inconclusive');assert.equal(c.mode,'demo');assert.equal(c.cost,'0.000000');assert.equal(c.receipts.length,0);
const media=await fetch(base+c.media,{headers:{cookie}});assert.equal(media.status,200);assert.equal(media.headers.get('content-type'),'image/jpeg');
const stranger=await fetch(base+'/api/checks/'+c.id);assert.equal(stranger.status,404,'Private result is not available without the owner session');
const privateMedia=await fetch(base+c.media);assert.equal(privateMedia.status,404);
const badFile=new FormData();badFile.append('file',new File(['not an image'],'fake.jpg',{type:'image/jpeg'}));assert.equal((await request('/api/checks',{method:'POST',body:badFile})).response.status,400);

const shared=await request('/api/checks/'+c.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({listed:true})});assert.equal(shared.response.status,200);
const publicResult=await fetch(base+'/api/checks/'+c.id);assert.equal(publicResult.status,200);const persisted=(await publicResult.json()).check;
assert.equal(persisted.id,c.id);assert.equal(persisted.cost,'0.000000');assert.deepEqual(persisted.receipts,[]);
assert.equal((await fetch(base+c.media)).status,200,'Shared media is readable');
const feed=await request('/api/checks?feed=1');assert.ok(feed.data.checks.some(x=>x.id===c.id));
await request('/api/checks/'+c.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({listed:false})});
assert.ok(!(await request('/api/checks?feed=1')).data.checks.some(x=>x.id===c.id),'Unlisting removes a check from the feed');
assert.equal((await request('/api/checks/sample-coast')).data.check.mode,'demo');
assert.equal((await fetch(base+'/s/'+c.id)).status,200);
console.log('PASS: upload, file validation, private access, cross-origin rejection, saved results, shared media, feed opt-in, unlisting, and share page.');
