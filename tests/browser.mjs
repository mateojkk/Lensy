// Browser checks use a separate SQLite database and never submit a paid request.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.LENSY_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),directory=path.join(root,'.sites-runtime','browser-tests',crypto.randomUUID()),port=5180,base='http://127.0.0.1:'+port;
process.env.LENSY_DATA_DIRECTORY=directory;await fs.mkdir(directory,{recursive:true});
const storage=await import('../scripts/local-storage.mjs');storage.initializeLocalDatabase();
const {assembleCheck,readProviderResult,VERIFY_INTENT}=await import(pathToFileURL(path.join(root,'.sites-runtime/test-build/lib/verification.js')).href);
const id=crypto.randomUUID(),owner=crypto.randomUUID(),hash='0x'+'ab'.repeat(32),payer='0x'+'1'.repeat(40);
const networkResponse={result_shape:'intent',result:{verdict:'Likely authentic',confidence:.92,summary:'Isolated browser-test fixture.',findings:['Test finding']},cost_usd:.01};
const receipt={receipt_hash:hash,rail:'escrow',payer,intent:VERIFY_INTENT,amount_uusdc:'10000',epoch_id:314};
const response=new Response(JSON.stringify(networkResponse),{headers:{'X-PAYMENT-RESPONSE':btoa(JSON.stringify(receipt))}});
const check=assembleCheck({id,name:'browser-check.jpg',media:'https://example.com/media.jpg',mediaType:'image/jpeg',mode:'live',createdAt:new Date().toISOString(),status:'complete',verdict:'',confidence:null,summary:'',findings:[],receipts:[],cost:null},[readProviderResult(VERIFY_INTENT,response,networkResponse,'10000')],true);
await storage.bindings.DB.prepare('INSERT INTO checks (id,owner,created_at,name,media,media_type,mode,status,result) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,owner,check.createdAt,check.name,check.media,check.mediaType,'live','complete',JSON.stringify(check)).run();
let logs='';const server=spawn(process.execPath,['scripts/run-local.mjs'],{cwd:root,env:{...process.env,LENSY_PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);
 let browser;
try{
 let serving=false;for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/config',{signal:AbortSignal.timeout(1000)});await r.arrayBuffer();if(r.ok){serving=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 assert.ok(serving,'Isolated local server started: '+logs.slice(-1500));
 browser=await chromium.launch({headless:true,...(process.env.LENSY_BROWSER_EXECUTABLE?{executablePath:process.env.LENSY_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addCookies([{name:'lensy_session',value:owner,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage(),errors=[];let purchases=0;
 page.on('pageerror',error=>{errors.push(error.message);console.error('Browser page error:',error.message);});page.on('request',r=>{if(r.url().includes('/api/verify'))purchases++;});
 await page.addInitScript(()=>{
  const listeners={};window.__testWalletListeners=listeners;
  window.ethereum={request:async({method})=>method==='eth_accounts'?[]:method==='eth_requestAccounts'?['0x'+'1'.repeat(40)]:method==='eth_chainId'?'0xaa36a7':method==='wallet_switchEthereumChain'?null:Promise.reject(new Error('Signing is disabled in browser tests.')),on:(name,listener)=>listeners[name]=listener,removeListener:(name)=>delete listeners[name]};
 });
 await page.goto(base+'/app');await page.getByRole('heading',{name:'New check',exact:true}).waitFor();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'Connect Ethereum wallet',exact:true}).click();
 await page.getByRole('button',{name:'0x1111…1111'}).waitFor();
 await page.evaluate(()=>window.__testWalletListeners.accountsChanged(['0x'+'3'.repeat(40)]));await page.getByRole('button',{name:'0x3333…3333'}).waitFor();
 await page.route('**/api/quote',async route=>{
  const caption=route.request().postDataJSON().caption;const intents=['MEDIA_FORENSIC_VERIFY_GENERAL',...(caption?['IMAGE_CAPTIONING_GENERAL']:[])];
  await route.fulfill({json:{id:crypto.randomUUID(),quotes:intents.map(intent=>({intent,amount:'10000',escrow:{scheme:'escrow',network:'eip155:11155111',payTo:'0x'+'2'.repeat(40),extra:{message:'test'}}})),total:caption?'0.020000':'0.010000',expiresAt:new Date(Date.now()+120000).toISOString()}});
 });
 await page.getByLabel('Media URL',{exact:true}).fill('https://example.com/image.jpg');await page.getByRole('checkbox',{name:/^Image description/}).check();await page.getByRole('button',{name:'Get quote',exact:true}).click();
 await page.getByRole('button',{name:'Approve $0.020000',exact:true}).waitFor();assert.equal(await page.locator('.quote-lines li').count(),2);
 await page.clock.install();await page.clock.fastForward(121000);await page.getByText('Quote expired',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/^Approve \$/}).count(),0);
 await page.getByRole('button',{name:'My checks',exact:true}).click();await page.getByRole('heading',{name:'My checks',exact:true}).waitFor();await page.getByText('browser-check.jpg',{exact:true}).waitFor();
 assert.equal(await page.locator('.history-stats>div').count(),3);assert.ok((await page.locator('.history-stats').innerText()).includes('$0.010000'));
 const exportReady=page.waitForEvent('download');await page.getByRole('button',{name:'Export history'}).click();const exported=JSON.parse(await fs.readFile(await(await exportReady).path(),'utf8'));assert.equal(exported.checks.length,1);assert.ok(!('quotes'in exported.checks[0]));
 await page.locator('.check-card').filter({hasText:'browser-check.jpg'}).click();await page.waitForURL(base+'/app/checks/'+id);await page.getByRole('heading',{name:'Result',exact:true}).waitFor();await page.getByRole('heading',{name:'Likely authentic',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Likely authentic',exact:true}).waitFor();
 await page.getByRole('button',{name:'Share result',exact:true}).click();await page.getByLabel('Show in community feed').check();await page.getByRole('button',{name:'Create share link'}).click();
 const linkInput=page.getByLabel('Shareable result link');await linkInput.waitFor();const firstLink=await linkInput.inputValue();assert.ok(firstLink.startsWith(base+'/s/'));assert.ok(!firstLink.endsWith(id));
 const viewer=await browser.newContext({viewport:{width:1280,height:900}}),shared=await viewer.newPage();shared.on('pageerror',e=>errors.push(e.message));
 await shared.goto(firstLink);await shared.getByRole('heading',{name:'Likely authentic',exact:true}).waitFor();assert.equal(await shared.getByRole('button',{name:'Manage sharing'}).count(),0);assert.equal((await viewer.request.get(base+'/api/checks/'+id)).status(),404);
 await shared.getByRole('button',{name:'Community feed',exact:true}).click();await shared.getByText('browser-check.jpg',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Revoke sharing'}).click();await page.getByRole('button',{name:'Create share link'}).waitFor();
 await shared.goto(firstLink);await shared.getByRole('heading',{name:'Result unavailable'}).waitFor();
 await page.getByRole('button',{name:'Create share link'}).click();await page.getByLabel('Shareable result link').waitFor();const nextLink=await page.getByLabel('Shareable result link').inputValue();assert.notEqual(nextLink,firstLink);
 assert.equal((await viewer.request.get(base+'/api/shared/'+firstLink.split('/').pop())).status(),404);
 await page.getByRole('button',{name:'Close dialog'}).click();await page.screenshot({path:'outputs/phase-2-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/app');await page.getByRole('heading',{name:'New check',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile layout has no horizontal overflow');
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('button',{name:'My checks',exact:true}).click();await page.getByText('browser-check.jpg',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
 await page.screenshot({path:'outputs/phase-2-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.equal(purchases,0);assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile app, wallet account changes, quote itemization/expiry, history statistics/export, refresh recovery, owner-only results, public share reads, revocation/rotation, feed, and zero paid calls.');
}finally{await fs.writeFile('outputs/browser-server.log',logs);if(browser)await browser.close();server.kill();}
