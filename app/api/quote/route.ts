import { insertCheck, json, quote, VERIFY, CAPTION, route, requireOwner } from "../../../lib/server";
import type { Check } from "../../../lib/lensy";
import { fromMicros } from '../../../lib/money';
import {resolveMediaInput} from '../../../lib/uploads';
export async function POST(req:Request) { return route(req,async()=>{
  requireOwner(req);
  const data=await req.json() as any; const {url,upload}=await resolveMediaInput(req,data);
  const quotes=await Promise.all([quote(VERIFY,url),...(data.caption?[quote(CAPTION,url)]:[])]);
  const check:Check={id:crypto.randomUUID(),name:new URL(url).pathname.split("/").pop()||"Linked media",media:url,mediaType:/\.(mp4|webm)(\?|$)/i.test(url)?"video/mp4":"image/jpeg",mode:"live",createdAt:new Date().toISOString(),verdict:"Awaiting payment",confidence:null,summary:"",findings:[],cost:"0.000000",receipts:[],status:"quoted"};
  if(upload)Object.assign(check,{uploadId:upload.id,name:upload.name,mediaType:upload.contentType,media:'/api/media/'+check.id});
  await insertCheck(req,{...check,...{quotes}});
  return json({id:check.id,quotes:quotes.map(({requestBody,...q})=>q),total:fromMicros(quotes.reduce((s,q)=>s+BigInt(q.amount),0n)),expiresAt:new Date(Date.parse(check.createdAt)+120000).toISOString()});
}); }
