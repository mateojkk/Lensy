import { db, fromRow, json, requireOwner, route, upstream } from '../../../lib/server';
import { runVerification, validatePayments } from '../../../lib/verification';
import type { ProviderResult, QuoteItem } from '../../../lib/lensy';
export async function POST(req:Request){return route(req,async()=>{
  const owner=requireOwner(req),data=await req.json() as {id?:string;payments?:unknown};
  if(typeof data.id!=='string')return json({error:'Quote ID is required.'},400);
  const database=db();
  const row=await database.prepare("SELECT * FROM checks WHERE id = ? AND owner = ? AND mode = 'live'").bind(data.id,owner).first();
  if(!row)return json({error:'Quote not found.'},404);
  if(row.status!=='quoted')return json({check:fromRow(row,owner),alreadySubmitted:true},row.status==='running'?202:200);
  const stored=JSON.parse(row.result as string),quotes=stored.quotes as QuoteItem[];
  if(Date.now()-Date.parse(row.created_at as string)>120000)throw new Error('Quote expired. Request a fresh quote before signing.');
  if(!Array.isArray(quotes)||!quotes.length)throw new Error('Quote is invalid.');
  const payments=validatePayments(data.payments,quotes);
  const providers:ProviderResult[]=quotes.map(q=>({intent:q.intent,status:'pending',cost:null}));
  const base={...fromRow(row,owner),status:'running',verdict:'Checking media',cost:null,knownCost:'0.000000',providers,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  const claimed=await database.prepare("UPDATE checks SET status = 'running', result = ? WHERE id = ? AND owner = ? AND status = 'quoted' RETURNING id").bind(JSON.stringify(base),data.id,owner).first();
  if(!claimed){const current=await database.prepare('SELECT * FROM checks WHERE id = ? AND owner = ?').bind(data.id,owner).first();return current?json({check:fromRow(current,owner),alreadySubmitted:true},202):json({error:'Check not found.'},404);}
  const check=await runVerification(database,upstream,data.id,base,quotes,payments);
  return json({check:{...check,viewerIsOwner:true,canShare:['complete','partial'].includes(check.status)}});
});}
