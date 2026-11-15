import { insertCheck, json, mediaUrl, quote, VERIFY, CAPTION, route } from "../../../lib/server";
import type { Check } from "../../../lib/lensy";
export async function POST(req:Request) { return route(req,async()=>{
  const data=await req.json() as any; const url=mediaUrl(data.url);
  const quotes=await Promise.all([quote(VERIFY,url),...(data.caption?[quote(CAPTION,url)]:[])]);
  const check:Check={id:crypto.randomUUID(),name:new URL(url).pathname.split("/").pop()||"Linked media",media:url,mediaType:/\.(mp4|webm)(\?|$)/i.test(url)?"video/mp4":"image/jpeg",mode:"live",createdAt:new Date().toISOString(),verdict:"Awaiting payment",confidence:null,summary:"",findings:[],cost:"0.000000",receipts:[],status:"quoted"};
  await insertCheck(req,{...check,...{quotes}});
  return json({id:check.id,quotes:quotes.map(({requestBody,...q})=>q),total:(quotes.reduce((s,q)=>s+Number(q.amount),0)/1e6).toFixed(6)});
}); }
