import { db, fromRow, identity, json, route } from '../../../../lib/server';
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}){return route(req,async()=>{
 const {token}=await params;
 const row=await db().prepare("SELECT * FROM checks WHERE shared = 1 AND mode = 'live' AND status IN ('complete','partial') AND (share_token = ? OR (share_token IS NULL AND id = ?))").bind(token,token).first();
 return row?json({check:fromRow(row,identity(req))}):json({error:'This link is unavailable or sharing has been revoked.'},404);
});}
