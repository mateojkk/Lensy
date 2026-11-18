import { fromMicros, toMicros, totalCosts } from './money';
import type { Check, ProviderResult, QuoteItem, Receipt } from './lensy';

export const TELEGRAPH_NODE='https://devnode.telegraphprotocol.com';
export const VERIFY_INTENT='MEDIA_FORENSIC_VERIFY_GENERAL';
const hashPattern=/^0x[a-fA-F0-9]{64}$/;
const verdicts=['Authentic','Likely authentic','Manipulated','Likely manipulated','Inconclusive'];
type Database={prepare(sql:string):{bind(...values:any[]):any}};
type Upstream=(path:string,options:RequestInit)=>Promise<{res:Response;body:any}>;

export function validatePayments(payments:unknown,quotes:QuoteItem[],now=Date.now()) {
  if(!Array.isArray(payments)||payments.length!==quotes.length)throw new Error('Sign every quoted request before continuing.');
  const nonces=new Set<string>();let payer='';
  payments.forEach((encoded,i)=>{
    if(typeof encoded!=='string'||encoded.length>12000)throw new Error('Invalid payment authorization.');
    let p:any;try{p=JSON.parse(atob(encoded));}catch{throw new Error('Invalid payment authorization.');}
    const a=p.payload?.authorization,q=quotes[i];
    if(!/^0x[a-fA-F0-9]{130}$/.test(p.payload?.signature||''))throw new Error('A valid wallet signature is required for every paid check.');
    if(p.scheme!=='escrow'||p.network!==q.escrow.network||a?.value!==q.amount||a?.to?.toLowerCase()!==q.escrow.payTo.toLowerCase()||!/^0x[a-fA-F0-9]{40}$/.test(a?.from||''))throw new Error('Payment does not match the quoted request.');
    if(payer&&payer!==a.from.toLowerCase())throw new Error('All payments must use the same wallet.');payer=a.from.toLowerCase();
    const after=Number(a.validAfter),before=Number(a.validBefore),seconds=Math.floor(now/1000);
    if(!Number.isSafeInteger(after)||!Number.isSafeInteger(before)||before<=seconds||after>seconds+5||before-after>120||before<=after)throw new Error('Payment authorization expired or has an invalid validity window.');
    if(typeof a.nonce!=='string'||!a.nonce||a.nonce.length>128||nonces.has(a.nonce))throw new Error('Each payment requires a unique nonce.');nonces.add(a.nonce);
  });
  return payments as string[];
}

export function readPaymentReceipt(intent:string,res:Response):Receipt|undefined {
  let raw:any=null;const encoded=res.headers.get('X-PAYMENT-RESPONSE')||res.headers.get('X-TELEGRAPH-RECEIPT');
  try{if(encoded)raw=JSON.parse(atob(encoded));}catch{}
  let receipt:Receipt|undefined;
  if(hashPattern.test(raw?.receipt_hash||'')&&raw.intent===intent&&typeof raw.amount_uusdc==='string'&&/^\d{1,60}$/.test(raw.amount_uusdc)){
    receipt={intent,hash:raw.receipt_hash,amount:fromMicros(raw.amount_uusdc),raw};
    if(Number.isSafeInteger(raw.epoch_id)&&raw.epoch_id>=0){receipt.epoch=raw.epoch_id;receipt.url=`${TELEGRAPH_NODE}/v1/blocks/${raw.epoch_id}/deliveries/${raw.receipt_hash}`;}
  }
  return receipt;
}
export function readProviderResult(intent:string,res:Response,body:any,quotedAmount:string):ProviderResult {
  const completedAt=new Date().toISOString(),receipt=readPaymentReceipt(intent,res);
  if(!res.ok)return {intent,status:receipt||res.status===402?'failed':'unknown',receipt,cost:receipt?.amount??(res.status===402?'0.000000':null),error:String(body?.reason||body?.message||body?.error||`Provider returned HTTP ${res.status}.`),completedAt};
  if(body?.lensy_read_error)return {intent,status:receipt?'failed':'unknown',receipt,cost:receipt?.amount??null,error:String(body.lensy_read_error),response:body,completedAt};
  const reported=toMicros(body?.cost_usd);const cost=receipt?.amount??(reported===null?null:fromMicros(reported));
  const warnings=[];
  if(!receipt)warnings.push('No valid payment receipt was returned; the provider response is stored separately.');
  if(cost===null)warnings.push('The network did not report the charge.');
  if(receipt&&toMicros(receipt.amount)!==BigInt(quotedAmount))warnings.push('The receipt amount differs from the quote.');
  return {intent,status:'succeeded',cost,response:body,receipt,warning:warnings.join(' ')||undefined,completedAt};
}

export function assembleCheck(base:Check,providers:ProviderResult[],final:boolean):Check {
  const v=providers.find(p=>p.intent===VERIFY_INTENT),answer=v?.response as any;
  let reported=answer?.result_shape==='intent'?answer.result:null;
  let fieldStatus=answer?.field_status;
  // The account API may return the direct intent's JSON answer as a string.
  // Never infer a verdict or confidence from prose or unrelated source objects.
  if(v?.channel==='anjoman'&&!reported&&typeof answer?.answer==='string'){
    try{const parsed=JSON.parse(answer.answer);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){reported=parsed.result_shape==='intent'?parsed.result:parsed;fieldStatus=parsed.field_status??fieldStatus;}}catch{}
  }
  const fields=reported?Object.fromEntries(Object.entries(reported).filter(([key])=>!fieldStatus?.[key]||fieldStatus[key]==='ok')):null;
  const pending=providers.some(p=>p.status==='pending');
  const uncertain=providers.some(p=>p.status==='unknown');
  const interrupted=(!final&&Date.now()-Date.parse(base.startedAt||base.createdAt)>(base.paymentSource==='lensy'?900000:120000))||final&&pending;
  const status=interrupted?'interrupted':!final&&pending?'running':v?.status==='succeeded'?providers.some(p=>p.status!=='succeeded')?'partial':'complete':uncertain?'interrupted':'failed';
  const costs=totalCosts(providers.map(p=>p.cost));
  const summary=typeof fields?.summary==='string'?fields.summary:v?.channel==='anjoman'&&typeof answer?.answer==='string'&&answer.answer?answer.answer:status==='running'?'Waiting for the provider response.':status==='interrupted'?'The request may have been billed. Check the saved evidence and network ledger before purchasing again.':v?.status==='succeeded'?'The provider returned no structured verdict. Inspect its original response.':v?.error||'Verification could not be completed.';
  const warnings=providers.flatMap(p=>[p.error,p.warning].filter(Boolean));
  if(interrupted||uncertain)warnings.push('Payment status is unconfirmed for at least one request. This check will not be purchased again automatically.');
  const result:Check={...base,...costs,status,providers,receipts:providers.flatMap(p=>p.receipt?[p.receipt]:[]),verdict:status==='running'?'Checking media':typeof fields?.verdict==='string'&&verdicts.includes(fields.verdict)?fields.verdict:v?.status==='succeeded'?'No structured verdict':status==='interrupted'?'Needs review':'Verification unavailable',confidence:typeof fields?.confidence==='number'&&fields.confidence>=0&&fields.confidence<=1?fields.confidence:null,summary,findings:Array.isArray(fields?.findings)?fields.findings.map((f:unknown)=>typeof f==='string'?f:JSON.stringify(f)):[],warning:warnings.join(' ')||undefined};
  const captionProvider=providers.find(p=>p.intent!==VERIFY_INTENT&&p.status==='succeeded'),caption=captionProvider?.response as any;
  if(captionProvider?.channel==='anjoman'&&typeof caption?.answer==='string')result.caption=caption.answer;
  if(caption?.result)result.caption=typeof caption.result==='string'?caption.result:JSON.stringify(caption.result);
  return result;
}

export async function runVerification(database:Database,upstream:Upstream,id:string,base:Check,quotes:QuoteItem[],payments:string[]):Promise<Check> {
  const providers:ProviderResult[]=quotes.map(q=>({intent:q.intent,status:'pending',cost:null}));
  let saveFailed=false;
  await Promise.all(quotes.map(async(q,i)=>{
    let outcome:ProviderResult;
    try{const {res,body}=await upstream('/engine/v1/ask',{method:'POST',headers:{'Content-Type':'application/json','X-PAYMENT':payments[i]},body:JSON.stringify(q.requestBody)});outcome=readProviderResult(q.intent,res,body,q.amount);}
    catch{outcome={intent:q.intent,status:'unknown',cost:null,error:'The provider connection ended before its billing status could be confirmed.',completedAt:new Date().toISOString()};}
    providers[i]=outcome;
    try{await database.prepare("UPDATE checks SET result = json_set(result, ?, json(?), '$.updatedAt', ?) WHERE id = ? AND status = 'running'").bind(`$.providers[${i}]`,JSON.stringify(outcome),new Date().toISOString(),id).run();}
    catch{saveFailed=true;}
  }));
  const check=assembleCheck({...base,updatedAt:new Date().toISOString()},providers,true);
  try{await database.prepare('UPDATE checks SET status = ?, result = ? WHERE id = ?').bind(check.status,JSON.stringify(check),id).run();saveFailed=false;}
  catch{saveFailed=true;}
  if(saveFailed){check.persistenceWarning=true;check.warning=[check.warning,'Could not save the complete report. Download it now and do not resubmit the purchase.'].filter(Boolean).join(' ');}
  return check;
}
