import { bucket, findCheck, json, route } from "../../../../lib/server";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) { return route(req,async()=>{
  const {id}=await params; if(!await findCheck(id,req)) return json({error:"Media not found."},404);
  const file=await bucket().get(id); if(!file) return json({error:"Media not found."},404);
  return new Response(file.body,{headers:{"Content-Type":file.httpMetadata?.contentType||"application/octet-stream","Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
}); }
