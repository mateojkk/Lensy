import { db, fromRow, identity, json, requireOwner, route } from '../../../lib/server';
export async function GET(req:Request){return route(req,async()=>{
 const url=new URL(req.url),feed=url.searchParams.get('feed')==='1',owner=feed?identity(req):requireOwner(req);
 let cursor:{created:string;id:string}|null=null;
 if(url.searchParams.has('cursor')){try{cursor=JSON.parse(atob(url.searchParams.get('cursor')!));}catch{throw new Error('Invalid history cursor.');}if(!cursor||typeof cursor.created!=='string'||typeof cursor.id!=='string')throw new Error('Invalid history cursor.');}
 const limit=feed?30:50,values:unknown[]=[];
 let where=feed?"mode = 'live' AND status IN ('complete','partial') AND listed = 1 AND shared = 1":"owner = ? AND mode = 'live' AND status != 'quoted'";
 if(!feed)values.push(owner);
 const query=(url.searchParams.get('q')||'').trim(),status=url.searchParams.get('status')||'all';
 if(query.length>200)throw new Error('Search must be under 200 characters.');
 if(!['all','complete','partial','running','interrupted','failed'].includes(status))throw new Error('Invalid check status.');
 if(query){where+=" AND (name LIKE ? ESCAPE '\\' OR media LIKE ? ESCAPE '\\' OR json_extract(result,'$.verdict') LIKE ? ESCAPE '\\')";const pattern='%'+query.replace(/[\\%_]/g,c=>'\\'+c)+'%';values.push(pattern,pattern,pattern);}
 if(status!=='all'){
  // Match the recovery status rendered by fromRow for stale in-flight requests.
  const cutoff=new Date(Date.now()-120000).toISOString();
  const stale="(status = 'running' AND json_type(result,'$.providers') = 'array' AND COALESCE(json_extract(result,'$.startedAt'),created_at) < ?)";
  if(status==='interrupted'){where+=` AND (status = 'interrupted' OR ${stale})`;values.push(cutoff);}
  else if(status==='running'){where+=` AND status = 'running' AND NOT COALESCE(${stale},0)`;values.push(cutoff);}
  else{where+=' AND status = ?';values.push(status);}
 }
 if(cursor){where+=' AND (created_at < ? OR (created_at = ? AND id < ?))';values.push(cursor.created,cursor.created,cursor.id);}
 const rows=await db().prepare(`SELECT * FROM checks WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`).bind(...values,limit+1).all();
 const visible=rows.results.slice(0,limit),last=visible.at(-1),nextCursor=rows.results.length>limit&&last?btoa(JSON.stringify({created:last.created_at,id:last.id})):null;
 return json({checks:visible.map(row=>fromRow(row,owner)),nextCursor});
});}
export async function POST(req:Request){return route(req,async()=>json({error:'Checks require a live quote and wallet approval.'},405,{Allow:'GET'}));}
