import {env} from 'cloudflare:workers';
import {db,fromRow,quote,VERIFY,CAPTION} from './server';
import {assembleCheck,readPaymentReceipt} from './verification';
import {toMicros,fromMicros} from './money';
import type {Check,ProviderResult,QuoteItem} from './lensy';
import type {UploadedMedia} from './uploads';

const API='https://backend.telegraphprotocol.com';
export function sponsorConfig(){
 // Account routing temporarily authorizes up to 0.26 USDC; the final reported cost may be lower.
 const key=(env.TELEGRAPH_API_KEY||'').trim(),call=toMicros(env.LENSY_SPONSOR_MAX_CALL_USDC||'0.30'),daily=toMicros(env.LENSY_SPONSOR_DAILY_USDC||'1');
 const checks=Number(env.LENSY_SPONSOR_CHECKS_PER_USER||'3');
 const valid=call!==null&&daily!==null&&call>0n&&call<=1000000n&&daily>=call&&daily<=100000000n&&Number.isInteger(checks)&&checks>0&&checks<=100;
 return {key,available:!!key&&env.LENSY_SPONSOR_ENABLED!=='false'&&valid,call:Number(call||0n),daily:Number(daily||0n),checks};
}
function redact(value:unknown,key:string){return key?JSON.parse(JSON.stringify(value).replaceAll(key,'[redacted]')):value;}
async function body(res:Response,key:string){
 const reader=res.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
 try{if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000)throw new Error('Report too large.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return redact(JSON.parse(text),key) as any;}
 finally{await reader?.cancel().catch(()=>{});}
}
async function get(path:string,key:string){const res=await fetch(API+path,{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(15000)});return {res,data:await body(res,key)};}
const validJob=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function sponsoredOutcome(intent:string,res:Response,data:any,key=''):ProviderResult{
 data=redact(data,key);const receipt=readPaymentReceipt(intent,res);if(receipt)receipt.raw=redact(receipt.raw,key);
 const amount=toMicros(data?.costUsd),cost=receipt?.amount??(amount===null?null:fromMicros(amount));
 const status=!res.ok?'unknown':['running','queued','pending'].includes(data?.status)&&validJob(data?.jobId)?'pending':['complete','completed','partial'].includes(data?.status)?'succeeded':'failed';
 return {intent,channel:'anjoman',jobId:validJob(data?.jobId)?data.jobId:undefined,status,cost,response:data,receipt,completedAt:status==='pending'?undefined:new Date().toISOString(),warning:receipt?undefined:'The account API did not return a payment receipt. Reported cost is stored separately.',error:!res.ok?'The network could not confirm this job. It will not be purchased again automatically.':undefined};
}
function uncertain(intent:string):ProviderResult{return {intent,channel:'anjoman',status:'unknown',cost:null,error:'The connection ended before a job ID could be saved. Review the Lensy account ledger before starting another check.'};}
async function start(item:QuoteItem,url:string,config:ReturnType<typeof sponsorConfig>):Promise<ProviderResult>{
 const res=await fetch(API+'/agent/chat',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({message:(item.intent===VERIFY?'Verify this public media: ':'Describe this public image: ')+url,intent:item.intent,params:(item.requestBody as any).params,stream:true,maxSpendUsd:config.call/1000000}),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!res.ok||!res.headers.get('content-type')?.includes('text/event-stream')){
  try{return sponsoredOutcome(item.intent,res,await body(res,config.key),config.key);}
  catch{return {...sponsoredOutcome(item.intent,res,{},config.key),status:'unknown',error:'The response body could not be read. Review the account ledger before starting another check.'};}
 }
 const reader=res.body?.getReader();if(!reader)throw new Error('Missing job stream.');const decoder=new TextDecoder();let buffer='',size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000)throw new Error('Job stream too large.');buffer+=decoder.decode(value,{stream:true});buffer=buffer.replaceAll('\r\n','\n');let index;
  while((index=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,index);buffer=buffer.slice(index+2);const lines=block.split('\n'),event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();let data:any;try{data=JSON.parse(lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n'));}catch{continue;}
   if(event==='job'&&validJob(data?.jobId))return sponsoredOutcome(item.intent,res,{jobId:data.jobId,status:'running'},config.key);
   if(event==='done')return sponsoredOutcome(item.intent,res,data,config.key);
   if(event==='error')throw new Error('Network rejected the job.');
  }
 }throw new Error('No job ID returned.');}finally{await reader.cancel().catch(()=>{});}
}
async function finish(id:string,owner:string,fallback:Check):Promise<Check>{
 try{
  const row=await db().prepare('SELECT * FROM checks WHERE id = ? AND owner = ?').bind(id,owner).first();if(!row)throw new Error('Missing saved check.');
  const current=fromRow(row,owner),providers=(current.providers||[]).map((p,i)=>{
   const candidate=fallback.providers?.[i];if(!candidate)return p;
   return p.status==='pending'&&(!p.jobId||p.jobId===candidate.jobId)&&candidate.status!=='pending'?candidate:p.status==='pending'&&!p.jobId&&candidate.jobId?candidate:p;
  });
  const result=assembleCheck({...current,updatedAt:new Date().toISOString()},providers,!providers.some(p=>p.status==='pending'));
  await db().prepare('UPDATE checks SET status = ?, result = ? WHERE id = ? AND owner = ?').bind(result.status,JSON.stringify({...result,sponsorPollAt:JSON.parse(String(row.result)).sponsorPollAt}),id,owner).run();
  if(!providers.some(p=>p.status==='pending'||p.status==='unknown'))await db().prepare('UPDATE sponsorships SET active_until = 0 WHERE check_id = ?').bind(id).run();
  return {...result,viewerIsOwner:true,canShare:['complete','partial'].includes(result.status)};
 }catch{return {...fallback,viewerIsOwner:true,persistenceWarning:true,canShare:false,warning:[fallback.warning,'Could not save the complete report. Download it now; do not resubmit the purchase.'].filter(Boolean).join(' ')};}
}
export async function beginSponsored(owner:string,id:string,url:string,caption:boolean,upload?:UploadedMedia){
 const existing=await db().prepare('SELECT * FROM checks WHERE id = ?').bind(id).first();
 if(existing)return existing.owner===owner?{status:200,check:fromRow(existing,owner)}:{status:409,error:'This request ID is already in use.'};
 const config=sponsorConfig();if(!config.available)return {status:503,error:'Lensy-funded checks are not available yet. The owner must configure and fund the Lensy account.'};
 const reserved=config.call*(caption?2:1);
 try{const {res,data}=await get('/engine/escrow/balance',config.key),balance=toMicros(data?.effectiveBalance),debt=toMicros(data?.agentDebt);if(!res.ok||balance===null||debt===null)throw new Error();if(debt>0n)return {status:503,error:'Lensy must settle its account debt before covering another check.'};if(balance<BigInt(reserved))return {status:503,error:'Lensy needs '+fromMicros(BigInt(reserved))+' test USDC available for this check’s spending allowance. This allowance is not the final charge. No check was purchased.'};}catch{return {status:503,error:'Could not confirm the Lensy account balance. No check was purchased.'};}
 let quotes:QuoteItem[];
 try{quotes=await Promise.all([VERIFY,...(caption?[CAPTION]:[])].map(intent=>quote(intent,url)));if(quotes.some(q=>BigInt(q.amount)>BigInt(config.call)||!(q.requestBody as any).params))throw new Error();}catch{return {status:503,error:'A provider is unavailable or exceeds the Lensy spending limit. No check was purchased.'};}
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 const claim=await db().prepare(`INSERT INTO sponsorships (check_id,owner,day,reserved_micros,active_until) SELECT ?,?,?,?,? WHERE
 (SELECT COALESCE(SUM(reserved_micros),0) FROM sponsorships WHERE day = ?) + ? <= ? AND
 (SELECT COUNT(*) FROM sponsorships WHERE owner = ? AND day = ?) < ? AND
 (SELECT COUNT(*) FROM sponsorships WHERE active_until > ?) < 2
 ON CONFLICT(check_id) DO NOTHING RETURNING check_id`).bind(id,owner,day,reserved,now+900000,day,reserved,config.daily,owner,day,config.checks,now).first();
 if(!claim)return {status:429,error:'The Lensy daily allowance is used or checks are busy. Try again later.'};
 const base:Check={id,name:new URL(url).pathname.split('/').pop()||'Media check',media:url,mediaType:/\.(mp4|webm|mov)(\?|$)/i.test(url)?'video':'image',mode:'live',paymentSource:'lensy',createdAt:new Date(now).toISOString(),startedAt:new Date(now).toISOString(),status:'running',verdict:'Checking media',confidence:null,summary:'Waiting for the network.',findings:[],receipts:[],cost:null,knownCost:'0.000000',providers:quotes.map(q=>({intent:q.intent,channel:'anjoman',status:'pending',cost:null}))};
 if(upload)Object.assign(base,{uploadId:upload.id,name:upload.name,mediaType:upload.contentType,media:'/api/media/'+id});
 // Persist recovery state before the first paid request. A reservation is never refunded automatically.
 await db().prepare('INSERT INTO checks (id,owner,created_at,name,media,media_type,mode,status,result,shared,listed) VALUES (?,?,?,?,?,?,?,?,?,0,0)').bind(id,owner,base.createdAt,base.name,base.media,base.mediaType,'live','running',JSON.stringify(base)).run();
 const outcomes=await Promise.all(quotes.map(async(q,i)=>{let outcome;try{outcome=await start(q,url,config);}catch{outcome=uncertain(q.intent);}try{await db().prepare("UPDATE checks SET result = json_set(result, ?, json(?)) WHERE id = ?").bind(`$.providers[${i}]`,JSON.stringify(outcome),id).run();}catch{}return outcome;}));
 const check=await finish(id,owner,assembleCheck(base,outcomes,!outcomes.some(p=>p.status==='pending')));return {status:check.status==='running'?202:200,check};
}
export async function refreshSponsored(id:string,owner:string){
 const row=await db().prepare("SELECT * FROM checks WHERE id = ? AND owner = ? AND mode = 'live' AND status != 'quoted'").bind(id,owner).first();if(!row)return null;
 const current=fromRow(row,owner),config=sponsorConfig();if(current.paymentSource!=='lensy'||!config.key||!current.providers?.some(p=>p.status==='pending'&&p.jobId))return current;
 const lease=await db().prepare("UPDATE checks SET result = json_set(result, '$.sponsorPollAt', ?) WHERE id = ? AND COALESCE(json_extract(result, '$.sponsorPollAt'),0) < ? RETURNING id").bind(Date.now(),id,Date.now()-10000).first();if(!lease)return current;
 const providers=await Promise.all(current.providers.map(async(p,i)=>{if(p.status!=='pending'||!validJob(p.jobId))return p;let outcome=p;
  try{const {res,data}=await get('/agent/jobs/'+encodeURIComponent(p.jobId),config.key);if(res.ok)outcome={...sponsoredOutcome(p.intent,res,{...data,jobId:p.jobId},config.key),jobId:p.jobId};else if(res.status===404)outcome={...uncertain(p.intent),jobId:p.jobId};}catch{}
  try{await db().prepare('UPDATE checks SET result = json_set(result, ?, json(?)) WHERE id = ?').bind(`$.providers[${i}]`,JSON.stringify(outcome),id).run();}catch{}return outcome;
 }));return finish(id,owner,assembleCheck(current,providers,!providers.some(p=>p.status==='pending')));
}
