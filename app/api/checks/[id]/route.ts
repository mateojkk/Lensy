import { db, identity, fromRow, json, requireOwner, route } from '../../../../lib/server';
import {refreshSponsored} from '../../../../lib/sponsored';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return route(req,async()=>{const {id}=await params,owner=identity(req);const check=owner?await refreshSponsored(id,owner):null;return check?json({check}):json({error:'Result not found in your workspace.'},404);});}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){return route(req,async()=>{
  const {id}=await params,owner=requireOwner(req),data=await req.json() as {shared?:boolean;listed?:boolean};
  const database=db(),row=await database.prepare("SELECT * FROM checks WHERE id = ? AND owner = ? AND mode = 'live'").bind(id,owner).first();
  if(!row)return json({error:'You can only change sharing for your own checks.'},403);
  const shared=data.shared!==false;
  if(shared&&!['complete','partial'].includes(String(row.status)))return json({error:'Only completed checks can be shared.'},403);
  const token=shared?(row.shared&&row.share_token?String(row.share_token):crypto.randomUUID()):null;
  const listed=shared&&data.listed===true;
  const updated=await database.prepare('UPDATE checks SET share_token = CASE WHEN ? = 0 THEN NULL WHEN shared = 1 AND share_token IS NOT NULL THEN share_token ELSE ? END, shared = ?, listed = ? WHERE id = ? AND owner = ? RETURNING *').bind(shared?1:0,token,shared?1:0,listed?1:0,id,owner).first();
  if(!updated)return json({error:'Check not found.'},404);
  const check=fromRow(updated,owner);
  return json({check,url:check.shareUrl});
});}
