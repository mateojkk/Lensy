import { bucket, db, fromRow, insertCheck, json, mediaUrl, requireOwner, route } from "../../../lib/server";
import type { Check } from "../../../lib/lensy";
export async function GET(req:Request) { return route(req,async()=>{
  const feed=new URL(req.url).searchParams.get("feed")==="1";
  const rows=feed ? await db().prepare("SELECT * FROM checks WHERE listed = 1 AND shared = 1 ORDER BY created_at DESC LIMIT 30").all() : await db().prepare("SELECT * FROM checks WHERE owner = ? ORDER BY created_at DESC LIMIT 50").bind(requireOwner(req)).all();
  return json({checks:rows.results.map(fromRow)});
}); }
export async function POST(req:Request) { return route(req,async()=>{
  requireOwner(req);
  let media:string, name:string, mediaType:string;
  const id=crypto.randomUUID();
  if(req.headers.get("content-type")?.includes("multipart/form-data")) {
    if(Number(req.headers.get("content-length"))>21*1024*1024) throw new Error("Choose a file under 20 MB.");
    const data=await req.formData(); const file=data.get("file");
    if(!(file instanceof File) || file.size===0 || file.size>20*1024*1024) throw new Error("Choose a non-empty file under 20 MB.");
    if(!["image/jpeg","image/png","image/webp","video/mp4","video/webm"].includes(file.type)) throw new Error("Supported files: JPG, PNG, WebP, MP4, and WebM.");
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const valid=(file.type==="image/jpeg"&&bytes[0]===255&&bytes[1]===216) || (file.type==="image/png"&&bytes[0]===137&&bytes[1]===80) || (file.type==="image/webp"&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP") || (file.type==="video/mp4"&&String.fromCharCode(...bytes.slice(4,8))==="ftyp") || (file.type==="video/webm"&&bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163);
    if(!valid) throw new Error("This file does not match its media type. Please choose a valid image or video.");
    await bucket().put(id,file.stream(),{httpMetadata:{contentType:file.type}});
    media="/api/media/"+id; name=file.name.slice(0,200); mediaType=file.type;
  } else { const data=await req.json() as any; media=mediaUrl(data.url); name=data.name?.slice(0,200)||new URL(media).pathname.split("/").pop()||"Linked media"; mediaType=/\.(mp4|webm)(\?|$)/i.test(media)?"video/mp4":"image/jpeg"; }
  const check:Check={id,name,media,mediaType,mode:"demo",createdAt:new Date().toISOString(),verdict:"Inconclusive",confidence:null,summary:"Your media is saved. This preview does not run forensic analysis on uploads. Connect a funded wallet and check a public media URL when a Telegraph provider is available.",findings:["No forensic provider was called", "No payment was made", "Original media saved for this preview"],cost:"0.000000",receipts:[],status:"complete"};
  await insertCheck(req,check); return json({check},201);
}); }
