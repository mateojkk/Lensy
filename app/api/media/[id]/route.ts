import { bucket, db, identity, json, route } from "../../../../lib/server";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) { return route(req,async()=>{
  const {id}=await params;
  const row=await db().prepare("SELECT * FROM checks WHERE id = ? AND mode = 'live' AND (owner = ? OR (shared = 1 AND status IN ('complete','partial')))").bind(id,identity(req)||'').first();
  if(!row)return json({error:'Media not found.'},404);
  const result=JSON.parse(String(row.result)),file=await bucket().get(result.uploadId||id); if(!file) return json({error:"Media not found."},404);
  return new Response(file.body,{headers:{"Content-Type":file.httpMetadata?.contentType||"application/octet-stream","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}); }
