import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const output=process.env.LENSY_TEST_BUILD;
globalThis.__lensyTestEnvironment={};
const load=p=>import(pathToFileURL(path.join(output,p+'.js')).href);
const {toMicros,fromMicros,totalCosts,formatMoney}=await load('lib/money');
const {readProviderResult,assembleCheck,runVerification,validatePayments,VERIFY_INTENT}=await load('lib/verification');
const verifyRoute=await load('app/api/verify/route'),checkRoute=await load('app/api/checks/[id]/route'),sharedRoute=await load('app/api/shared/[token]/route'),historyRoute=await load('app/api/checks/route'),statsRoute=await load('app/api/stats/route'),exportRoute=await load('app/api/checks/export/route');
const alice='alice',bob='bob',payer='0x'+'1'.repeat(40),diamond='0x'+'2'.repeat(40),hash='0x'+'ab'.repeat(32),CAPTION='IMAGE_CAPTIONING_GENERAL';
function database(){
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(path.join('drizzle',file),'utf8'));
 const prepare=(query,values=[])=>({bind(...args){return prepare(query,args);},async first(column){const row=sql.prepare(query).get(...values);return row?(column?row[column]:{...row}):null;},async all(){return {results:sql.prepare(query).all(...values).map(r=>({...r}))};},async run(){return sql.prepare(query).run(...values);}});
 const db={prepare,sql};globalThis.__lensyTestEnvironment.DB=db;return db;
}
function quote(intent=VERIFY_INTENT){return {intent,amount:'10000',requestBody:{intent,params:{media_url:'https://example.com/media.jpg'}},escrow:{scheme:'escrow',network:'eip155:11155111',payTo:diamond,extra:{message:'test-only message template'}}};}
function base(id=crypto.randomUUID()){return {id,name:'media.jpg',media:'https://example.com/media.jpg',mediaType:'image/jpeg',mode:'live',createdAt:new Date().toISOString(),verdict:'Awaiting payment',confidence:null,summary:'',findings:[],receipts:[],cost:'0.000000',status:'quoted'};}
function seed(db,check,owner=alice,quotes=[quote()]){db.sql.prepare('INSERT INTO checks (id,owner,created_at,name,media,media_type,mode,status,result) VALUES (?,?,?,?,?,?,?,?,?)').run(check.id,owner,check.createdAt,check.name,check.media,check.mediaType,check.mode,check.status,JSON.stringify({...check,quotes}));return check;}
function payment(q=quote(),overrides={}){const now=Math.floor(Date.now()/1000);return btoa(JSON.stringify({scheme:'escrow',network:q.escrow.network,payload:{signature:'0x'+'1'.repeat(130),authorization:{from:payer,to:diamond,value:q.amount,validAfter:String(now-5),validBefore:String(now+100),nonce:crypto.randomUUID(),...overrides}}}));}
function request(url,body,owner=alice,method='POST'){return new Request('https://lensy.test'+url,{method,headers:{origin:'https://lensy.test','Content-Type':'application/json',...(owner?{'oai-authenticated-user-id':owner}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
const params=id=>({params:Promise.resolve({id})});
const tokenParams=token=>({params:Promise.resolve({token})});
function response(intent=VERIFY_INTENT,{cost=true,receipt=true,status=200}={}){const body={intent,result_shape:'intent',result:{verdict:'Likely authentic',confidence:.92,summary:'Provider assessment.',findings:['Consistent detail']},...(cost?{cost_usd:.01}:{})};const raw={receipt_hash:hash,rail:'escrow',payer,miner:'123',intent,amount_uusdc:'10000',epoch_id:314};return {body,res:new Response(JSON.stringify(body),{status,headers:receipt?{'X-PAYMENT-RESPONSE':btoa(JSON.stringify(raw))}:{}})};}
const body=async r=>{const value=await r.json();return value;};
const compareRoute=await load('app/api/compare/route');
const {comparisonSummary,evidenceHTML,evidenceCSV,parseComparisonIds}=await load('lib/evidence');

test('comparison preserves order, requires ownership of every check, and never purchases',async t=>{
 const db=database(),first=seed(db,{...base(),status:'complete'}),second=seed(db,{...base(),status:'partial',cost:null,knownCost:'0.010001'}),privateCheck=seed(db,{...base(),status:'complete'},bob),unpaid=seed(db,base());
 let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('Comparisons must not call a provider');};t.after(()=>globalThis.fetch=original);
 const query=ids=>request('/api/compare?ids='+ids.join(','),null,alice,'GET');
 const report=await body(await compareRoute.GET(query([second.id,first.id])));assert.deepEqual(report.checks.map(c=>c.id),[second.id,first.id]);assert.equal(report.summary.cost,null);assert.equal(report.summary.knownCost,'0.010001');assert.ok(report.checks.every(c=>!('quotes'in c)&&c.viewerIsOwner));
 assert.equal((await compareRoute.GET(query([first.id,privateCheck.id]))).status,404);assert.equal((await compareRoute.GET(query([unpaid.id]))).status,404);
 assert.equal((await compareRoute.GET(query([first.id,first.id]))).status,400);assert.equal((await compareRoute.GET(request('/api/compare?ids='+first.id,null,null,'GET'))).status,400);assert.equal(calls,0);
 assert.throws(()=>parseComparisonIds('a,b,c,d,e'));assert.throws(()=>parseComparisonIds('a,'));assert.throws(()=>parseComparisonIds('a/<script>'));
});
test('comparison totals retain known partial charges and deduplicate receipt hashes',()=>{
 const first={...base(),status:'complete',verdict:'Likely authentic',cost:'9007199254740993.000001',receipts:[{hash,amount:'0.010000',intent:VERIFY_INTENT}]};
 const second={...base(),status:'partial',verdict:'Likely AI-generated',cost:null,knownCost:'0.000009',receipts:[{hash:hash.toUpperCase(),amount:'0.010000',intent:VERIFY_INTENT}]};
 const totals=comparisonSummary([first,second]);assert.equal(totals.cost,null);assert.equal(totals.knownCost,'9007199254740993.000010');assert.equal(totals.receipts,1);assert.equal(totals.unconfirmed,1);assert.equal(totals.differingVerdicts,true);
});
test('offline evidence reports escape untrusted responses and exclude executable URLs',()=>{
 const unsafe='</pre><script>globalThis.reportExecuted=true</script><img src=x onerror=alert(1)>';
 const check={...base(),status:'complete',name:unsafe,summary:unsafe,findings:[unsafe],media:'javascript:alert(1)',providers:[{intent:VERIFY_INTENT,status:'succeeded',cost:null,response:{answer:unsafe}}],receipts:[{intent:unsafe,amount:null,hash,url:'javascript:alert(2)',raw:{unsafe}}]};
 const html=evidenceHTML([check],'2026-11-17T00:00:00.000Z');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes("default-src 'none'"));assert.ok(html.includes('Not reported'));assert.ok(html.includes(hash));assert.ok(html.includes('Original provider responses'));
});
test('CSV evidence handles quotes/newlines and neutralizes spreadsheet formulas',()=>{
 const csv=evidenceCSV([{...base(),name:'  =HYPERLINK("https://example.com")\nname',verdict:'+malicious',cost:null,knownCost:'0.000001'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'  =HYPERLINK(""https://example.com"")\nname"'));assert.ok(csv.includes('"\'+malicious"'));assert.ok(csv.includes('"0.000001"'));
});
test('history searches beyond pagination, treats SQL wildcards literally, and filters recovery states',async()=>{
 const db=database();for(let i=0;i<55;i++)seed(db,{...base(),createdAt:new Date(Date.now()-i*1000).toISOString(),status:'complete',name:'recent-'+i+'.jpg'});
 const target=seed(db,{...base(),createdAt:'2020-01-01T00:00:00.000Z',status:'complete',name:'100%_original.jpg',verdict:'Likely AI-generated'});
 seed(db,{...base(),status:'complete',name:'private-100%_original.jpg'},bob);
 const get=async query=>body(await historyRoute.GET(request('/api/checks?'+query,null,alice,'GET')));
 assert.equal((await get('')).checks.length,50);assert.equal((await get('q=100%25_')).checks[0].id,target.id);assert.equal((await get('q=AI-generated')).checks.length,1);assert.equal((await get('q=100%25_&status=failed')).checks.length,0);
 const stalled=seed(db,{...base(),status:'running',startedAt:'2020-01-01T00:00:00.000Z',providers:[{intent:VERIFY_INTENT,status:'pending',cost:null}]});
 const pending=seed(db,{...base(),status:'running',startedAt:new Date().toISOString(),providers:[{intent:VERIFY_INTENT,status:'pending',cost:null}]});
 assert.deepEqual((await get('status=interrupted')).checks.map(c=>c.id),[stalled.id]);assert.deepEqual((await get('status=running')).checks.map(c=>c.id),[pending.id]);
 assert.equal((await historyRoute.GET(request('/api/checks?status=quoted',null,alice,'GET'))).status,400);
});

test('USDC calculations preserve six decimals and large exact values',()=>{
 assert.equal(toMicros('1000000000000000.000001'),1000000000000000000001n);assert.equal(fromMicros(1000000000000000000001n),'1000000000000000.000001');
 assert.equal(toMicros(1e-6),1n);assert.equal(toMicros('0.0000001'),null);assert.equal(toMicros(-1),null);assert.equal(toMicros(null),null);
 assert.deepEqual(totalCosts(['0.010001',null,'0.000009']),{cost:null,knownCost:'0.010010'});assert.equal(formatMoney(null),'Not reported');assert.equal(formatMoney('0'),'$0.000000');
});
test('raw answers are not counted as receipts and absent charges stay unknown',()=>{
 const noReceipt=response(VERIFY_INTENT,{cost:false,receipt:false});const result=readProviderResult(VERIFY_INTENT,noReceipt.res,noReceipt.body,'10000');
 assert.equal(result.receipt,undefined);assert.equal(result.cost,null);assert.ok(result.response);assert.match(result.warning,/No valid payment receipt/);
 const known=response(VERIFY_INTENT,{receipt:false});assert.equal(readProviderResult(VERIFY_INTENT,known.res,known.body,'10000').cost,'0.010000');
});
test('payment receipts retain exact charges, epoch URLs, and charges on failed responses',()=>{
 const result=response();const outcome=readProviderResult(VERIFY_INTENT,result.res,result.body,'10000');assert.equal(outcome.receipt.hash,hash);assert.equal(outcome.receipt.amount,'0.010000');assert.ok(outcome.receipt.url.endsWith('/v1/blocks/314/deliveries/'+hash));
 const failed=response(VERIFY_INTENT,{status:500});const error=readProviderResult(VERIFY_INTENT,failed.res,{error:'failed after payment'},'10000');assert.equal(error.receipt.hash,hash);assert.equal(error.cost,'0.010000');
});
test('rejected verdicts and out-of-range confidence never become confident assessments',()=>{
 const fixture=response();fixture.body.field_status={verdict:'rejected'};fixture.body.result.confidence=1.4;
 const p=readProviderResult(VERIFY_INTENT,fixture.res,fixture.body,'10000'),check=assembleCheck(base(),[p],true);
 assert.equal(check.verdict,'No structured verdict');assert.equal(check.confidence,null);
});
test('parallel requests persist the first receipt before the other request finishes',async()=>{
 const db=database(),check={...base(),status:'running',startedAt:new Date().toISOString(),providers:[{intent:VERIFY_INTENT,status:'pending',cost:null},{intent:CAPTION,status:'pending',cost:null}]};seed(db,check);
 let rejectCaption;const caption=new Promise((_,reject)=>{rejectCaption=reject;});
 const running=runVerification(db,async(_,options)=>JSON.parse(options.body).intent===VERIFY_INTENT?response():caption,check.id,check,[quote(),quote(CAPTION)],['test-only','test-only']);
 for(let i=0;i<20;i++){await new Promise(resolve=>setImmediate(resolve));const row=await db.prepare('SELECT result FROM checks WHERE id = ?').bind(check.id).first();if(JSON.parse(row.result).providers[0].receipt)break;}
 const intermediate=JSON.parse((await db.prepare('SELECT result FROM checks WHERE id = ?').bind(check.id).first()).result);assert.equal(intermediate.providers[0].receipt.hash,hash);assert.equal(intermediate.providers[1].status,'pending');
 rejectCaption(new Error('network timeout'));const result=await running;
 assert.equal(result.status,'partial');assert.equal(result.receipts.length,1);assert.equal(result.cost,null);assert.equal(result.knownCost,'0.010000');assert.match(result.warning,/unconfirmed/);
});
test('stale requests require review and preserve evidence without an automatic retry',()=>{
 const fixture=response();const complete=readProviderResult(VERIFY_INTENT,fixture.res,fixture.body,'10000');
 const result=assembleCheck({...base(),startedAt:new Date(Date.now()-180000).toISOString()},[complete,{intent:CAPTION,status:'pending',cost:null}],false);
 assert.equal(result.status,'interrupted');assert.equal(result.receipts.length,1);assert.equal(result.cost,null);
});
test('authorization validation rejects expired windows, wrong amounts and reused nonces',()=>{
 assert.throws(()=>validatePayments([payment(quote(),{validBefore:'1'})],[quote()]),/expired/);
 assert.throws(()=>validatePayments([payment(quote(),{value:'1'})],[quote()]),/match/);
 assert.throws(()=>validatePayments([payment(quote(),{nonce:'same'}),payment(quote(CAPTION),{nonce:'same'})],[quote(),quote(CAPTION)]),/unique/);
 assert.throws(()=>validatePayments([],[quote()]),/Sign every/);
});
test('an expired quote never reaches the provider and an unpaid quote cannot be shared',async t=>{
 const db=database(),check=seed(db,{...base(),createdAt:new Date(Date.now()-180000).toISOString()});const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network purchase');};t.after(()=>globalThis.fetch=original);
 const response=await verifyRoute.POST(request('/api/verify',{id:check.id,payments:[payment()]}));assert.equal(response.status,400);assert.equal(calls,0);
 assert.equal((await checkRoute.PATCH(request('/api/checks/'+check.id,{listed:true},alice,'PATCH'),params(check.id))).status,403);
 assert.equal((await checkRoute.GET(request('/api/checks/'+check.id,null,alice,'GET'),params(check.id))).status,404);
});
test('failed authorization is a known zero charge, but a connection loss is not',()=>{
 const rejected=readProviderResult(VERIFY_INTENT,new Response('{}',{status:402}),{reason:'insufficient escrow'},'10000');assert.equal(rejected.status,'failed');assert.equal(rejected.cost,'0.000000');
 const result=assembleCheck(base(),[{intent:VERIFY_INTENT,status:'unknown',cost:null,error:'connection lost'}],true);assert.equal(result.status,'interrupted');assert.equal(result.cost,null);assert.equal(result.knownCost,'0.000000');
});
test('concurrent duplicate submissions make exactly one paid provider request',async t=>{
 const db=database(),check=seed(db,base());const original=globalThis.fetch;let calls=0,release;
 const hold=new Promise(resolve=>{release=resolve;});globalThis.fetch=async()=>{calls++;await hold;const fixture=response();return fixture.res;};t.after(()=>globalThis.fetch=original);
 const signed=payment(),first=verifyRoute.POST(request('/api/verify',{id:check.id,payments:[signed]}));
 while(calls===0)await new Promise(resolve=>setImmediate(resolve));
 const duplicate=await verifyRoute.POST(request('/api/verify',{id:check.id,payments:[signed]}));assert.equal(duplicate.status,202);assert.equal(calls,1);
 release();const completed=await body(await first);assert.equal(completed.check.status,'complete');assert.equal(completed.check.receipts.length,1);
 const again=await body(await verifyRoute.POST(request('/api/verify',{id:check.id,payments:[signed]})));assert.equal(again.alreadySubmitted,true);assert.equal(calls,1);
 const stored=(await db.prepare('SELECT result FROM checks WHERE id = ?').bind(check.id).first()).result;assert.ok(!stored.includes(signed));assert.ok(!stored.includes('quotes'));
});
test('an unreadable network response cannot discard its payment receipt',async t=>{
 const db=database(),check=seed(db,base()),original=globalThis.fetch;globalThis.fetch=async()=>new Response('<not-json>',{headers:{'X-PAYMENT-RESPONSE':btoa(JSON.stringify({receipt_hash:hash,intent:VERIFY_INTENT,amount_uusdc:'10000',epoch_id:314}))}});t.after(()=>globalThis.fetch=original);
 const result=await body(await verifyRoute.POST(request('/api/verify',{id:check.id,payments:[payment()]})));
 assert.equal(result.check.receipts.length,1);assert.equal(result.check.cost,'0.010000');assert.equal(result.check.status,'failed');assert.match(result.check.warning,/unreadable/);
});
test('sharing is owner-only, revocation removes feed entries and old links stay revoked',async()=>{
 const db=database(),fixture=response(),complete=assembleCheck(base(),[readProviderResult(VERIFY_INTENT,fixture.res,fixture.body,'10000')],true);seed(db,complete);
 assert.equal((await checkRoute.GET(request('/api/checks/'+complete.id,null,bob,'GET'),params(complete.id))).status,404);
 assert.equal((await checkRoute.PATCH(request('/api/checks/'+complete.id,{listed:true},bob,'PATCH'),params(complete.id))).status,403);
 const shared=await body(await checkRoute.PATCH(request('/api/checks/'+complete.id,{listed:true},alice,'PATCH'),params(complete.id)));const firstToken=shared.url.split('/').pop();assert.notEqual(firstToken,complete.id);
 assert.equal((await sharedRoute.GET(request('/api/shared/'+firstToken,null,null,'GET'),tokenParams(firstToken))).status,200);
 assert.equal((await body(await historyRoute.GET(request('/api/checks?feed=1',null,null,'GET')))).checks.length,1);
 await checkRoute.PATCH(request('/api/checks/'+complete.id,{shared:false},alice,'PATCH'),params(complete.id));
 assert.equal((await sharedRoute.GET(request('/api/shared/'+firstToken,null,null,'GET'),tokenParams(firstToken))).status,404);
 assert.equal((await body(await historyRoute.GET(request('/api/checks?feed=1',null,null,'GET')))).checks.length,0);
 const reshared=await body(await checkRoute.PATCH(request('/api/checks/'+complete.id,{listed:false},alice,'PATCH'),params(complete.id)));assert.notEqual(reshared.url,shared.url);
 assert.equal((await sharedRoute.GET(request('/api/shared/'+firstToken,null,null,'GET'),tokenParams(firstToken))).status,404);
});
test('simultaneous sharing requests keep the same active link',async()=>{
 const db=database(),fixture=response(),check=assembleCheck(base(),[readProviderResult(VERIFY_INTENT,fixture.res,fixture.body,'10000')],true);seed(db,check);
 const results=await Promise.all([true,false].map(listed=>checkRoute.PATCH(request('/api/checks/'+check.id,{listed},alice,'PATCH'),params(check.id)).then(body)));
 assert.equal(results[0].url,results[1].url);
});
test('history pagination, export, and exact statistics stay scoped to the owner',async()=>{
 const db=database();for(let i=0;i<53;i++)seed(db,{...base(),status:'complete',cost:'0.010001',knownCost:'0.010001'});
 seed(db,{...base(),status:'complete',cost:'999.000000'},bob);seed(db,{...base(),status:'failed',cost:null,knownCost:'0.000003'});
 const first=await body(await historyRoute.GET(request('/api/checks',null,alice,'GET')));assert.equal(first.checks.length,50);assert.ok(first.nextCursor);
 const second=await body(await historyRoute.GET(request('/api/checks?cursor='+encodeURIComponent(first.nextCursor),null,alice,'GET')));assert.equal(second.checks.length,4);assert.equal(new Set([...first.checks,...second.checks].map(c=>c.id)).size,54);
 const stats=await body(await statsRoute.GET(request('/api/stats',null,alice,'GET')));assert.equal(stats.checks,54);assert.equal(stats.knownSpend,'0.530056');assert.equal(stats.unconfirmed,1);
 const exported=await body(await exportRoute.GET(request('/api/checks/export',null,alice,'GET')));assert.equal(exported.checks.length,54);assert.ok(exported.checks.every(c=>!('quotes'in c)&&!('owner'in c)));
});
test('storage failures return the available evidence and a download warning',async()=>{
 const db=database(),check={...base(),status:'running'};seed(db,check);const broken={prepare(){return {bind(){return {async run(){throw new Error('storage unavailable');}};}};}};
 const result=await runVerification(broken,async()=>response(),check.id,check,[quote()],['test-only']);assert.equal(result.receipts.length,1);assert.equal(result.persistenceWarning,true);assert.match(result.warning,/Download/);
});

const sponsorRoute=await load('app/api/sponsored/route'),configRoute=await load('app/api/config/route');
const uploadRoute=await load('app/api/uploads/route'),mediaRoute=await load('app/api/media/[id]/route');
const {resolveMediaInput,MAX_IMAGE_BYTES}=await load('lib/uploads');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=','base64');
function uploadFixture(t,options={}){
 const db=database(),env=globalThis.__lensyTestEnvironment,original=globalThis.fetch,objects=new Map();let relayed=0;
 env.BUCKET={async put(id,bytes,metadata){objects.set(id,{body:bytes,httpMetadata:metadata.httpMetadata});},async get(id){return objects.get(id)||null;},async delete(id){objects.delete(id);}};
 globalThis.fetch=async(url,init)=>{relayed++;assert.equal(String(url),'https://litterbox.catbox.moe/resources/internals/api.php');assert.ok(!init.headers?.Authorization);assert.equal(init.body.get('time'),'1h');assert.equal(init.body.get('reqtype'),'fileupload');assert.deepEqual(new Uint8Array(await init.body.get('fileToUpload').arrayBuffer()),new Uint8Array(png));return new Response(options.url||'https://litter.catbox.moe/testimage.png',{status:options.status||200});};
 t.after(()=>{globalThis.fetch=original;delete env.BUCKET;});
 const run=(bytes=png,owner=alice,extra={})=>uploadRoute.POST(new Request('https://lensy.test/api/uploads',{method:'POST',headers:{origin:'https://lensy.test','content-type':'image/png','x-file-name':encodeURIComponent('my photo.png'),...(owner?{'oai-authenticated-user-id':owner}:{}),...extra},body:bytes}));
 return {db,objects,run,get relayed(){return relayed;}};
}
test('uploads retain original image bytes and use a temporary relay without Telegraph credentials',async t=>{
 const f=uploadFixture(t),r=await f.run(),saved=await body(r);assert.equal(r.status,201);assert.equal(saved.name,'my photo.png');assert.equal(saved.contentType,'image/png');assert.equal(saved.size,png.length);assert.equal(f.relayed,1);assert.equal(f.objects.size,1);assert.ok(!('url'in saved));
 const input=await resolveMediaInput(request('/api/sponsored',{}),{uploadId:saved.uploadId,url:'https://malicious.example/ignored.png'});assert.equal(input.url,'https://litter.catbox.moe/testimage.png');assert.equal(input.upload.name,'my photo.png');
 assert.equal(f.db.sql.prepare('SELECT size FROM uploads').get().size,png.length);
});
test('uploads reject missing ownership, cross-origin, disguised files, empty and oversized bodies before relaying',async t=>{
 const f=uploadFixture(t);
 for(const [bytes,owner,headers,status] of [[png,null,{},400],[png,alice,{origin:'https://elsewhere.test'},403],[Buffer.from('<svg/>'),alice,{},400],[Buffer.alloc(0),alice,{},400],[png,alice,{'content-length':String(MAX_IMAGE_BYTES+1)},400],[Buffer.alloc(MAX_IMAGE_BYTES+1),alice,{},400]])assert.equal((await f.run(bytes,owner,headers)).status,status);
 assert.equal(f.relayed,0);assert.equal(f.objects.size,0);
});
test('upload relay failures clean stored bytes, count quota attempts and reject unexpected output hosts',async t=>{
 const f=uploadFixture(t,{url:'https://elsewhere.test/image.png'});
 for(let i=0;i<10;i++)assert.equal((await f.run()).status,400);
 assert.equal(f.objects.size,0);assert.equal(f.relayed,10);assert.equal((await f.run()).status,400);assert.equal(f.relayed,10);
 assert.equal(f.db.sql.prepare('SELECT count(*) AS n FROM uploads').get().n,10);
});
test('uploaded sources require ownership and a live link; saved previews follow sharing and revocation',async t=>{
 const f=uploadFixture(t),saved=await body(await f.run());
 await assert.rejects(resolveMediaInput(request('/api/sponsored',{},bob),{uploadId:saved.uploadId}),/workspace/);
 const check={...base(),status:'complete',uploadId:saved.uploadId,name:saved.name,media:'/api/media/placeholder'};seed(f.db,check);
 const read=owner=>mediaRoute.GET(request('/api/media/'+check.id,null,owner,'GET'),params(check.id));
 assert.equal((await read(bob)).status,404);const own=await read(alice);assert.equal(own.status,200);assert.equal(own.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await own.arrayBuffer()),new Uint8Array(png));
 f.db.sql.prepare('UPDATE uploads SET expires_at = 0').run();await assert.rejects(resolveMediaInput(request('/api/sponsored',{}),{uploadId:saved.uploadId}),/expired/);assert.equal((await read(alice)).status,200);
 f.db.sql.prepare('UPDATE checks SET shared = 1').run();assert.equal((await read(bob)).status,200);f.db.sql.prepare('UPDATE checks SET shared = 0').run();assert.equal((await read(bob)).status,404);
});
test('later uploads clean expired unused images while retaining completed report originals',async t=>{
 const f=uploadFixture(t),abandoned=await body(await f.run()),retained=await body(await f.run());
 seed(f.db,{...base(),status:'complete',uploadId:retained.uploadId});
 f.db.sql.prepare('UPDATE uploads SET expires_at = 0').run();await f.run();
 assert.equal(f.objects.has(abandoned.uploadId),false);assert.equal(f.objects.has(retained.uploadId),true);
 assert.equal(f.db.sql.prepare('SELECT count(*) AS n FROM uploads').get().n,3,'Cleanup cannot refund upload quotas');
});
const {sponsorConfig,sponsoredOutcome}=await load('lib/sponsored');
function sponsorFixture(t,options={}){
 const db=database(),env=globalThis.__lensyTestEnvironment,original=globalThis.fetch;
 Object.assign(env,{TELEGRAPH_API_KEY:'anjoman_test_only_key',LENSY_SPONSOR_ENABLED:'true',LENSY_SPONSOR_MAX_CALL_USDC:'.05',LENSY_SPONSOR_DAILY_USDC:'1',LENSY_SPONSOR_CHECKS_PER_USER:'3'});
 // Exact decimal parsing deliberately rejects a missing leading zero.
 env.LENSY_SPONSOR_MAX_CALL_USDC='0.05';
 const calls=[];let paid=0;
 globalThis.fetch=async(url,init={})=>{
  const parsed=new URL(url),method=init.method||'GET';calls.push({url:String(url),method,init});
  if(parsed.hostname==='backend.telegraphprotocol.com'){
   assert.equal(init.headers.Authorization,'Bearer '+env.TELEGRAPH_API_KEY);
   if(parsed.pathname==='/engine/escrow/balance')return Response.json({effectiveBalance:options.balance??'5',agentDebt:options.debt??'0'},{status:options.balanceStatus??200});
   if(parsed.pathname==='/agent/chat'){
    paid++;const value=JSON.parse(init.body);assert.ok([VERIFY_INTENT,CAPTION].includes(value.intent));assert.equal(value.maxSpendUsd,Number(env.LENSY_SPONSOR_MAX_CALL_USDC||'0.30'));assert.ok(!('paymentMethod'in value));assert.ok(value.params);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM checks WHERE status = ?').get('running').n>0,true,'Saved before purchase');
    if(options.lost)throw new Error('Connection lost');
    if(options.direct)return Response.json({status:'complete',answer:'Network response',costUsd:.01,jobId:'direct-job'});
    const data=new TextEncoder().encode('event: conversation\r\ndata: {"conversationId":"test"}\r\n\r\nevent: job\r\ndata: {"jobId":"job-'+paid+'"}\r\n\r\n');let offset=0;
    return new Response(new ReadableStream({pull(controller){if(offset>=data.length){controller.close();return;}controller.enqueue(data.slice(offset,offset+=7));}}),{headers:{'content-type':'text/event-stream'}});
   }
   if(parsed.pathname.startsWith('/agent/jobs/'))return Response.json({status:'complete',answer:JSON.stringify({verdict:'Likely authentic',confidence:.8,summary:'Network assessment',findings:['Reported finding']}),costUsd:.01});
   throw new Error('Unexpected account endpoint');
  }
  assert.equal(parsed.hostname,'devnode.telegraphprotocol.com');assert.ok(!init.headers?.Authorization,'No key sent to the node');
  if(parsed.pathname.includes('/intents/'))return Response.json({miner_count:1,request:{params:[{name:'media_url'}]}});
  assert.equal(parsed.pathname,'/engine/v1/ask');assert.ok(!init.headers?.['X-PAYMENT'],'Unsigned discovery only');
  const intent=JSON.parse(init.body).intent;return Response.json({accepts:[{...quote(intent).escrow,extra:{message:'Amount: '+(options.price??'10000')+' uUSDC'}}]},{status:402});
 };
 t.after(()=>{globalThis.fetch=original;for(const key of Object.keys(env))if(key!=='DB')delete env[key];});
 return {db,calls,env,get paid(){return paid;},run:(id=crypto.randomUUID(),owner=alice,caption=false)=>sponsorRoute.POST(request('/api/sponsored',{id,url:'https://example.com/media.jpg',caption,maxSpendUsd:999,intent:'FORGED'},owner))};
}
test('sponsored configuration never exposes the key and no-key checks never purchase',async t=>{
 const f=sponsorFixture(t);delete f.env.TELEGRAPH_API_KEY;
 const config=await body(await configRoute.GET(request('/api/config',null,alice,'GET')));assert.equal(config.sponsored.available,false);assert.ok(!JSON.stringify(config).includes('anjoman_'));
 assert.equal((await f.run()).status,503);assert.equal(f.calls.length,0);
 f.env.TELEGRAPH_API_KEY='anjoman_test_only_key';f.env.LENSY_SPONSOR_DAILY_USDC='invalid';assert.equal(sponsorConfig().available,false);assert.equal((await f.run()).status,503);assert.equal(f.paid,0);
});
test('default account allowance permits routing while storing only the actual reported charge',async t=>{
 const f=sponsorFixture(t,{direct:true,balance:'1'});delete f.env.LENSY_SPONSOR_MAX_CALL_USDC;
 const result=await body(await f.run());assert.equal(result.check.status,'complete');assert.equal(result.check.cost,'0.010000');assert.equal(f.paid,1);
 assert.equal(f.db.sql.prepare('SELECT reserved_micros FROM sponsorships').get().reserved_micros,300000);
});
test('insufficient allowance is explained without purchasing a job',async t=>{
 const f=sponsorFixture(t,{balance:'0.29'});delete f.env.LENSY_SPONSOR_MAX_CALL_USDC;
 const response=await f.run();assert.equal(response.status,503);const result=await body(response);assert.match(result.error,/0\.300000 test USDC/);assert.match(result.error,/not the final charge/);assert.equal(f.paid,0);
});
test('sponsored balance, debt, and quote limits fail before a paid request',async t=>{
 for(const options of [{balance:'0'},{debt:'0.001'},{balanceStatus:401},{price:'50001'}])await t.test(JSON.stringify(options),async child=>{const f=sponsorFixture(child,options);assert.equal((await f.run()).status,503);assert.equal(f.paid,0);assert.equal(f.db.sql.prepare('SELECT COUNT(*) AS n FROM sponsorships').get().n,0);});
});
test('sponsored uploads send the resolved URL, retain their preview, and recover after link expiry without purchasing again',async t=>{
 const f=sponsorFixture(t),uploadId=crypto.randomUUID(),id=crypto.randomUUID();
 f.db.sql.prepare('INSERT INTO uploads (id,owner,created_at,expires_at,name,content_type,size,public_url) VALUES (?,?,?,?,?,?,?,?)').run(uploadId,alice,Date.now(),Date.now()+3600000,'original.png','image/png',68,'https://litter.catbox.moe/test.png');
 const run=owner=>sponsorRoute.POST(request('/api/sponsored',{id,uploadId,caption:false},owner));
 assert.equal((await run(bob)).status,400);assert.equal(f.paid,0);
 const started=await body(await run(alice));assert.equal(f.paid,1);assert.equal(started.check.name,'original.png');assert.equal(started.check.media,'/api/media/'+id);assert.equal(started.check.uploadId,uploadId);
 const paid=JSON.parse(f.calls.find(c=>c.url.endsWith('/agent/chat')).init.body);assert.equal(paid.params.media_url,'https://litter.catbox.moe/test.png');assert.ok(!paid.message.includes('localhost'));
 f.db.sql.prepare('UPDATE uploads SET expires_at = 0').run();assert.equal((await run(alice)).status,200);assert.equal(f.paid,1);
 const complete=await body(await checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id)));assert.equal(complete.check.uploadId,uploadId);assert.equal(complete.check.cost,'0.010000');assert.equal(f.paid,1);
});
test('sponsored jobs are durable, idempotent, owner-only, and polled without another purchase',async t=>{
 const f=sponsorFixture(t),id=crypto.randomUUID();const first=await body(await f.run(id,alice,true));assert.equal(first.check.paymentSource,'lensy');assert.equal(first.check.status,'running');assert.equal(first.check.providers.length,2);assert.equal(f.paid,2);assert.ok(first.check.providers.every(p=>p.jobId));
 assert.equal((await f.run(id)).status,200);assert.equal(f.paid,2);assert.equal((await f.run(id,bob)).status,409);
 assert.equal((await checkRoute.GET(request('/api/checks/'+id,null,bob,'GET'),params(id))).status,404);
 const final=await body(await checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id)));assert.equal(final.check.status,'complete');assert.equal(final.check.cost,'0.020000');assert.equal(final.check.receipts.length,0);assert.equal(final.check.verdict,'Likely authentic');assert.equal(final.check.viewerIsOwner,true);assert.equal(f.paid,2);assert.equal(f.db.sql.prepare('SELECT active_until FROM sponsorships').get().active_until,0);
 assert.ok(!JSON.stringify(final).includes(f.env.TELEGRAPH_API_KEY));
});
test('concurrent sponsorship reservations enforce one purchase, global budget and owner allowance',async t=>{
 const f=sponsorFixture(t,{direct:true}),id=crypto.randomUUID();const duplicate=await Promise.all([f.run(id),f.run(id)]);assert.equal(f.paid,1);assert.ok(duplicate.some(r=>r.status===200));
 f.env.LENSY_SPONSOR_CHECKS_PER_USER='1';assert.equal((await f.run()).status,429);assert.equal(f.paid,1);
 f.env.LENSY_SPONSOR_DAILY_USDC='0.1';await Promise.all([f.run(crypto.randomUUID(),bob),f.run(crypto.randomUUID(),'carol')]);assert.equal(f.paid,2);assert.equal(f.db.sql.prepare('SELECT SUM(reserved_micros) AS n FROM sponsorships').get().n,100000);
});
test('active sponsored jobs throttle polling and bound concurrency',async t=>{
 const f=sponsorFixture(t);await f.run();await f.run(crypto.randomUUID(),bob);assert.equal((await f.run(crypto.randomUUID(),'carol')).status,429);assert.equal(f.paid,2);
 const id=f.db.sql.prepare('SELECT id FROM checks WHERE owner = ?').get(alice).id;
 const original=globalThis.fetch;globalThis.fetch=async(url,init)=>String(url).includes('/agent/jobs/')?(f.calls.push({url:String(url),method:'GET'}),Response.json({status:'running',jobId:'job-1',costUsd:null})):original(url,init);
 await Promise.all([checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id)),checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id))]);await checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id));assert.equal(f.calls.filter(c=>c.url.includes('/agent/jobs/')).length,1);assert.equal(f.paid,2);
});
test('lost sponsored startup retains unknown charges and cannot purchase the same ID twice',async t=>{
 const f=sponsorFixture(t,{lost:true}),id=crypto.randomUUID();const result=await body(await f.run(id));assert.equal(result.check.status,'interrupted');assert.equal(result.check.cost,null);assert.equal(result.check.receipts.length,0);assert.equal(f.paid,1);await f.run(id);await checkRoute.GET(request('/api/checks/'+id,null,alice,'GET'),params(id));assert.equal(f.paid,1);assert.equal(f.db.sql.prepare('SELECT reserved_micros FROM sponsorships').get().reserved_micros,50000);
});
test('sponsored reports retain actual receipts, redact secrets and reject invalid structured fields',()=>{
 const raw=response(),key='anjoman_example';const outcome=sponsoredOutcome(VERIFY_INTENT,raw.res,{status:'complete',costUsd:.02,answer:JSON.stringify({result_shape:'intent',field_status:{verdict:'rejected'},result:{verdict:'Authentic',confidence:2,summary:key}})},key);
 assert.equal(outcome.cost,'0.010000');assert.equal(outcome.receipt.hash,hash);assert.ok(!JSON.stringify(outcome).includes(key));const check=assembleCheck({...base(),paymentSource:'lensy'},[outcome],true);assert.equal(check.verdict,'No structured verdict');assert.equal(check.confidence,null);
 const prose=sponsoredOutcome(VERIFY_INTENT,new Response(),{status:'complete',answer:'Authentic with 99% confidence',costUsd:null});const report=assembleCheck(base(),[prose],true);assert.equal(report.verdict,'No structured verdict');assert.equal(report.confidence,null);assert.equal(report.cost,null);
});

test('sponsored report storage errors preserve the returned charge and recovery warning',async t=>{
 const f=sponsorFixture(t,{direct:true}),prepare=f.db.prepare;let purchasesStarted=false;
 const upstream=globalThis.fetch;globalThis.fetch=async(url,options)=>{const result=await upstream(url,options);if(String(url).endsWith('/agent/chat'))purchasesStarted=true;return result;};
 f.db.prepare=sql=>{if(purchasesStarted&&sql.startsWith('UPDATE checks'))return {bind(){return this;},async run(){throw new Error('Storage unavailable');}};return prepare(sql);};
 const result=await body(await f.run());assert.equal(f.paid,1);assert.equal(result.check.cost,'0.010000');assert.equal(result.check.persistenceWarning,true);assert.match(result.check.warning,/Download it now/);assert.equal(result.check.canShare,false);
});
test('sponsored ownership, invalid inputs, and same-origin checks reject before purchase',async t=>{
 const f=sponsorFixture(t);
 assert.equal((await sponsorRoute.POST(request('/api/sponsored',{id:crypto.randomUUID(),url:'https://example.com/a.jpg',caption:false},null))).status,400);
 assert.equal((await sponsorRoute.POST(new Request('https://lensy.test/api/sponsored',{method:'POST',headers:{origin:'https://elsewhere.test'},body:'{}'}))).status,403);
 assert.equal((await sponsorRoute.POST(request('/api/sponsored',{id:'not-valid',url:'https://example.com/a.jpg',caption:false}))).status,400);
 assert.equal((await sponsorRoute.POST(request('/api/sponsored',{id:crypto.randomUUID(),url:'https://127.0.0.1/a.jpg',caption:false}))).status,400);assert.equal(f.paid,0);assert.equal(f.calls.length,0);
});
