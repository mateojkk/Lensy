import { db, findCheck, json, requireOwner, route } from "../../../../lib/server";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) { return route(req,async()=>{ const {id}=await params; const check=await findCheck(id,req); return check?json({check}):json({error:"This result isn't available or hasn't been shared."},404); }); }
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}) { return route(req,async()=>{
  const {id}=await params; const data=await req.json() as any;
  const changed=await db().prepare("UPDATE checks SET shared = 1, listed = ? WHERE id = ? AND owner = ? AND mode = 'live' AND status = 'complete' RETURNING id").bind(data.listed===true?1:0,id,requireOwner(req)).first();
  if(!changed) return json({error:"Only your completed live checks can be shared."},403);
  return json({check:await findCheck(id,req),url:"/s/"+id});
}); }
