import { db, json, requireOwner, route } from '../../../lib/server';
import { totalCosts } from '../../../lib/money';
export async function GET(req:Request){return route(req,async()=>{
 const rows=await db().prepare("SELECT status, json_extract(result, '$.cost') AS cost, json_extract(result, '$.knownCost') AS known_cost, json_extract(result, '$.receipts') AS receipts FROM checks WHERE owner = ? AND mode = 'live' AND status != 'quoted'").bind(requireOwner(req)).all();
 let receipts=0,unconfirmed=0;
 const values=rows.results.map(r=>{if(r.cost===null)unconfirmed++;try{receipts+=JSON.parse(String(r.receipts||'[]')).filter((x:any)=>/^0x[a-fA-F0-9]{64}$/.test(x.hash||'')).length;}catch{}return typeof r.known_cost==='string'?r.known_cost:typeof r.cost==='string'?r.cost:null;});
 const totals=totalCosts(values);
 return json({checks:rows.results.length,receipts,knownSpend:totals.knownCost,unconfirmed,completed:rows.results.filter(r=>r.status==='complete'||r.status==='partial').length});
});}
