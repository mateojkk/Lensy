import { db, json, NODE, requireOwner, route, upstream, VERIFY } from "../../../lib/server";
import type { Check, Receipt } from "../../../lib/lensy";
export async function POST(req:Request) { return route(req,async()=>{
  const owner=requireOwner(req); const {id,payments}=await req.json() as any;
  const row=await db().prepare("SELECT * FROM checks WHERE id = ? AND owner = ?").bind(id,owner).first();
  if(!row) return json({error:"Quote not found."},404);
  if(row.status!=="quoted") return json({error:"This check has already been submitted. Open it from My checks; submitting again could create a second charge."},409);
  const stored=JSON.parse(row.result as string); const quotes=stored.quotes;
  if(Date.now()-Date.parse(row.created_at as string)>120000) throw new Error("Your quote expired. Request a new quote before signing.");
  if(!Array.isArray(payments)||payments.length!==quotes.length) throw new Error("Sign each quoted request before continuing.");
  for(let i=0;i<quotes.length;i++) {
    if(typeof payments[i]!=="string"||payments[i].length>12000) throw new Error("Invalid payment authorization.");
    const p=JSON.parse(atob(payments[i]));
    if(p.scheme!=="escrow" || p.network!==quotes[i].escrow.network || p.payload?.authorization?.value!==quotes[i].amount || p.payload?.authorization?.to?.toLowerCase()!==quotes[i].escrow.payTo.toLowerCase()) throw new Error("The payment authorization does not match this quote.");
  }
  const claimed=await db().prepare("UPDATE checks SET status = 'running' WHERE id = ? AND owner = ? AND status = 'quoted' RETURNING id").bind(id,owner).first();
  if(!claimed) return json({error:"This check is already running."},409);
  const results=await Promise.allSettled(quotes.map(async(q:any,i:number)=>{
    const {res,body}=await upstream("/engine/v1/ask",{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":payments[i]},body:JSON.stringify(q.requestBody)});
    if(!res.ok) throw new Error(body.reason||body.message||body.error||"Telegraph request failed.");
    const h=res.headers.get("X-PAYMENT-RESPONSE")||res.headers.get("X-TELEGRAPH-RECEIPT");
    let receipt:any=null; try {receipt=h?JSON.parse(atob(h)):null;}catch{}
    const amount=receipt?.amount_uusdc ? (Number(receipt.amount_uusdc)/1e6).toFixed(6) : Number.isFinite(body.cost_usd)?Number(body.cost_usd).toFixed(6):null;
    const item:Receipt={intent:q.intent,amount:amount||"0.000000",raw:receipt||body};
    if(receipt?.receipt_hash){item.hash=receipt.receipt_hash;item.epoch=receipt.epoch_id; if(Number.isInteger(receipt.epoch_id)&&/^0x[a-fA-F0-9]{64}$/.test(receipt.receipt_hash)) item.url=`${NODE}/v1/blocks/${receipt.epoch_id}/deliveries/${receipt.receipt_hash}`;}
    else if(/^0x[a-fA-F0-9]{64}$/.test(body.signal_hash||"")) item.url=`${NODE}/engine/v1/signal/${body.signal_hash}`;
    return {intent:q.intent,body,receipt:item,known:amount!==null,hasReceipt:!!receipt};
  }));
  const ok=results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);
  const errors=results.flatMap(r=>r.status==="rejected"?[r.reason.message]:[]);
  const verification=ok.find(r=>r.intent===VERIFY)?.body;
  const r=verification?.result_shape==="intent"?verification.result:null;
  const accepted=["Authentic","Likely authentic","Manipulated","Likely manipulated","Inconclusive"];
  const check:Check={...stored,status:ok.length?"complete":"failed",verdict:accepted.includes(r?.verdict)?r.verdict:"Inconclusive",confidence:typeof r?.confidence==="number"&&r.confidence>=0&&r.confidence<=1?r.confidence:null,summary:typeof r?.summary==="string"?r.summary:verification?"The provider returned an unstructured answer. Inspect the raw response for details.":"The verification could not be completed.",findings:Array.isArray(r?.findings)?r.findings.map((f:any)=>typeof f==="string"?f:JSON.stringify(f)):[],receipts:ok.map(r=>r.receipt),cost:(ok.reduce((sum,r)=>sum+Math.round(Number(r.receipt.amount)*1e6),0)/1e6).toFixed(6),warning:[...errors,...(ok.some(r=>!r.known)?["Some costs were not returned. The total only includes reported charges."]:[]),...(ok.some(r=>!r.hasReceipt)?["A provider returned no payment receipt. Its raw response is available."]:[])].join(" ")||undefined};
  delete (check as any).quotes;
  const description=ok.find(r=>r.intent!==VERIFY)?.body.result;
  if(description) check.caption=typeof description==="string"?description:JSON.stringify(description);
  await db().prepare("UPDATE checks SET status = ?, result = ? WHERE id = ?").bind(check.status,JSON.stringify(check),id).run();
  return json({check});
}); }
