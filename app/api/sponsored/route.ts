import {json,route,requireOwner,mediaUrl} from '../../../lib/server';
import {beginSponsored} from '../../../lib/sponsored';
export async function POST(req:Request){return route(req,async()=>{
 const owner=requireOwner(req),value=await req.json() as any;
 if(typeof value.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||typeof value.caption!=='boolean')return json({error:'Invalid check request.'},400);
 const result=await beginSponsored(owner,value.id,mediaUrl(value.url),value.caption);return json(result,result.status);
});}
