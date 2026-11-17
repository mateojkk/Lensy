import assert from 'node:assert/strict';

const base=process.env.LENSY_TEST_URL||'http://localhost:5173';
// Optional owner-private Site access is read only from stdin, never argv or disk.
if(process.env.LENSY_TEST_SERVICE_ACCESS==='1') {
  const input=await new Promise(resolve=>{
    let value='';const terminal=process.stdin.isTTY;
    if(terminal)process.stdin.setRawMode(true);
    console.log('Ready for test access JSON on stdin (input hidden).');
    process.stdin.setEncoding('utf8');
    const onData=chunk=>{value+=chunk;if(/[\r\n]/.test(value)){process.stdin.removeListener('data',onData);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();process.stdin.unref?.();resolve(value);}};
    process.stdin.on('data',onData);process.stdin.resume();
  });
  const {token}=JSON.parse(input);
  const directFetch=globalThis.fetch;
  globalThis.fetch=(url,options={})=>{
    if(new URL(url).origin!==new URL(base).origin) throw new Error('Service access is restricted to the selected Site.');
    return directFetch(url,{signal:AbortSignal.timeout(60000),...options,redirect:'manual',headers:{...options.headers,'OAI-Sites-Authorization':'Bearer '+token}});
  };
}
let cookie='';
async function request(path,options={}) {
  const headers={origin:base,...(cookie?{cookie}:{}),...options.headers};
  const response=await fetch(base+path,{...options,headers});
  const text=await response.text();
  let data;try{data=JSON.parse(text);}catch{data={error:text};}
  return {response,data};
}
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const config=await request('/api/config');
assert.equal(config.response.status,200);
cookie=config.response.headers.get('set-cookie')?.split(';')[0]||'';
assert.ok(cookie,'Session cookie is set');


const history=await request('/api/checks');assert.equal(history.response.status,200);assert.ok(history.data.checks.every(c=>c.mode==='live'&&c.status!=='quoted'));
const disabled=await request('/api/checks',post({url:'https://example.com/a.jpg'}));assert.equal(disabled.response.status,405);
const badURL=await request('/api/quote',post({url:'http://127.0.0.1/private'}));assert.equal(badURL.response.status,400);
const forged=await request('/api/quote',{...post({url:'https://example.com/a.jpg'}),headers:{'Content-Type':'application/json',origin:'https://other.example'}});assert.equal(forged.response.status,403);
assert.equal((await request('/api/checks/sample-coast')).response.status,404,'Hard-coded results are removed');
const feed=await request('/api/checks?feed=1');assert.equal(feed.response.status,200);assert.ok(feed.data.checks.every(c=>c.mode==='live'&&['complete','partial'].includes(c.status)));
console.log('PASS: live-only records, removed simulated creation, URL validation, removed sample results, and cross-origin write protection.');

const quote=await request('/api/quote',post({url:'https://images.unsplash.com/photo-1473116763249-2faaef81ccda',caption:false}));
assert.equal(quote.response.status,200,JSON.stringify(quote.data));
assert.equal(quote.data.quotes.length,1);assert.equal(quote.data.quotes[0].intent,'MEDIA_FORENSIC_VERIFY_GENERAL');
const q=quote.data.quotes[0];assert.equal(q.escrow.scheme,'escrow');assert.match(q.amount,/^\d+$/);const micros=BigInt(q.amount);assert.equal(quote.data.total,`${micros/1000000n}.${String(micros%1000000n).padStart(6,'0')}`);assert.ok(Date.parse(quote.data.expiresAt)>Date.now());
assert.equal((await request('/api/checks/'+quote.data.id)).response.status,404,'An unpaid quote is not a verification result');
assert.ok(!(await request('/api/checks')).data.checks.some(c=>c.id===quote.data.id),'Unpaid quotes are excluded from history');
assert.equal((await request('/api/verify',post({id:quote.data.id,payments:[]}))).response.status,400);
const invalid=btoa(JSON.stringify({scheme:'escrow',network:q.escrow.network,payload:{signature:'0x',authorization:{value:q.amount,to:q.escrow.payTo}}}));
assert.equal((await request('/api/verify',post({id:quote.data.id,payments:[invalid]}))).response.status,400,'Invalid signatures are rejected before any network purchase');
assert.equal((await request('/api/checks/'+quote.data.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({listed:true})})).response.status,403,'Unpaid quotes cannot be shared');
assert.equal((await request('/api/checks/'+quote.data.id)).response.status,404);
console.log('PASS: real unsigned Telegraph quote, exact amount, unpaid-result isolation, and missing/invalid payment rejection. No paid requests made.');
