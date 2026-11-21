import {json,route,requireOwner,db,fromRow} from '../../../lib/server';
import {beginSponsored} from '../../../lib/sponsored';
import {resolveMediaInput} from '../../../lib/uploads';
export async function POST(req:Request){return route(req,async()=>{
 const owner=requireOwner(req),value=await req.json() as any;
 if(typeof value.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||typeof value.caption!=='boolean')return json({error:'Invalid check request.'},400);
 // Recover an existing request even after its temporary upload link expires.
 const existing=await db().prepare('SELECT * FROM checks WHERE id = ?').bind(value.id).first();
 if(existing)return existing.owner===owner?json({check:fromRow(existing,owner)}):json({error:'This request ID is already in use.'},409);
 const source=await resolveMediaInput(req,value);
 const result=await beginSponsored(owner,value.id,source.url,value.caption,source.upload);return json(result,result.status);
});}
