import { env } from "cloudflare:workers";
import type { Check } from "./lensy";
import { assembleCheck } from './verification';

export const NODE = "https://devnode.telegraphprotocol.com";
export const VERIFY = "MEDIA_FORENSIC_VERIFY_GENERAL";
export const CAPTION = "IMAGE_CAPTIONING_GENERAL";
export function db() { if (!env.DB) throw new Error("Result storage is unavailable. Please try again later."); return env.DB; }
export function bucket() { if (!env.BUCKET) throw new Error("Upload storage is unavailable."); return env.BUCKET; }
export function identity(req: Request) { return req.headers.get("oai-authenticated-user-id") || req.headers.get("cookie")?.match(/(?:^|;\s*)lensy_session=([a-f0-9-]{36})(?:;|$)/)?.[1] || null; }
export function requireOwner(req: Request) { const o = identity(req); if (!o) throw new Error("Please refresh the page to start your session."); return o; }
export function json(data: unknown, status = 200, headers: Record<string,string> = {}) { return Response.json(data, {status, headers: {"Cache-Control":"no-store", ...headers}}); }
export async function route(req: Request, run: () => Promise<Response>) {
  if (req.method !== "GET" && req.headers.get("origin") !== new URL(req.url).origin) return json({error:"Please submit from Lensy."},403);
  try { return await run(); } catch(e) { console.error("Lensy:", e instanceof Error ? e.message : "Request failed"); return json({error:e instanceof Error ? e.message : "Something went wrong. Please try again."},400); }
}
export function mediaUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 1800) throw new Error("Enter a public HTTPS media URL under 1,800 characters.");
  const u = new URL(value); const host = u.hostname.toLowerCase();
  if(u.protocol!=="https:" || u.username || u.password || u.port || !host.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(":") || /\.(local|internal|localhost)$/.test(host)) throw new Error("Use a publicly accessible HTTPS image or video URL.");
  return u.href;
}
export function fromRow(row: Record<string,unknown>, owner?:string|null): Check {
  const stored=JSON.parse(row.result as string);
  const base:Check={id:String(row.id),name:String(row.name),media:String(row.media),mediaType:String(row.media_type),mode:String(row.mode),createdAt:String(row.created_at),status:String(row.status),verdict:stored.verdict,confidence:stored.confidence??null,summary:stored.summary||'',findings:stored.findings||[],receipts:(stored.receipts||[]).filter((r:any)=>/^0x[a-fA-F0-9]{64}$/.test(r.hash||'')),cost:stored.cost??null,knownCost:stored.knownCost??stored.cost??'0.000000',warning:stored.warning,caption:stored.caption,startedAt:stored.startedAt,updatedAt:stored.updatedAt};
  const check=Array.isArray(stored.providers)?assembleCheck(base,stored.providers,row.status!=='running'):base;
  check.shared=!!row.shared;check.listed=!!row.listed;check.viewerIsOwner=!!owner&&row.owner===owner;
  check.shareUrl=check.shared?'/s/'+(row.share_token||row.id):null;
  check.canShare=check.viewerIsOwner&&['complete','partial'].includes(check.status);
  return check;
}
export async function findCheck(id:string, req:Request, sharedOnly=false) {
  if(sharedOnly)return null;
  const owner=identity(req);
  const row = await db().prepare("SELECT * FROM checks WHERE id = ? AND mode = 'live' AND status != 'quoted' AND owner = ?").bind(id, owner||'').first();
  return row ? fromRow(row,owner) : null;
}
export async function insertCheck(req:Request, check:Check) {
  await db().prepare("INSERT INTO checks (id,owner,created_at,name,media,media_type,mode,status,result,shared,listed) VALUES (?,?,?,?,?,?,?,?,?,0,0)").bind(check.id,requireOwner(req),check.createdAt,check.name,check.media,check.mediaType,check.mode,check.status,JSON.stringify(check)).run();
}
export async function upstream(path:string, options:RequestInit={}) {
  const res = await fetch(NODE+path,{...options,signal:AbortSignal.timeout(45000)});
  // Preserve response headers (and any payment receipt) even if its body fails.
  const reader=res.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
  try{
    if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();return {res,body:{lensy_read_error:'Network response exceeded the report size limit.'}};}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
    try{return {res,body:JSON.parse(text) as any};}catch{return {res,body:{lensy_read_error:'Network returned an unreadable response.',unparsed_body:text.slice(0,8192)}};}
  }catch{return {res,body:{lensy_read_error:'Network response ended before its body was complete.'}};}
}
export async function discover() {
  const {res,body}=await upstream("/engine/v1/intents/"+VERIFY);
  return res.ok && body.miner_count > 0;
}
export async function quote(intent:string,url:string) {
  const payload= { intent, params: { [intent === VERIFY ? "media_url" : "image_url"]: url } };
  const schema = await upstream("/engine/v1/intents/"+intent);
  if (!schema.res.ok || !schema.body.miner_count) throw new Error("No Telegraph provider is available for this check right now. Please try again later.");
  const param=schema.body.request?.params?.find((p:any)=>/url/.test(p.name));
  if(param) payload.params = {[param.name]:url};
  const requestBody=schema.body.request ? payload : {intent,query:(intent===VERIFY?"Inspect this media for generation or manipulation: ":"Describe this image: ")+url};
  const {res,body}=await upstream("/engine/v1/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(requestBody)});
  if (res.status!==402) throw new Error(body.message || body.error || "The network did not return a payment quote.");
  const escrow=body.accepts?.find((a:any)=>a.scheme==="escrow");
  if(!escrow?.extra?.message) throw new Error("The network is not offering escrow payments right now.");
  const amount=escrow.extra.message.match(/Amount:\s*(\d+)\s*uUSDC/)?.[1];
  if(!amount) throw new Error("The network quote did not include a readable exact price.");
  return {intent, requestBody, escrow, amount};
}
