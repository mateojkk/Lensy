import {bucket,db,mediaUrl,requireOwner} from './server';

export const MAX_IMAGE_BYTES=5*1024*1024;
export type UploadedMedia={id:string;name:string;contentType:string};

export function imageContentType(bytes:Uint8Array){
 const starts=(values:number[])=>values.every((v,i)=>bytes[i]===v);
 if(bytes.length>=8&&starts([137,80,78,71,13,10,26,10]))return 'image/png';
 if(bytes.length>=3&&starts([255,216,255]))return 'image/jpeg';
 const text=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 if(bytes.length>=12&&text(0,4)==='RIFF'&&text(8,12)==='WEBP')return 'image/webp';
 if(bytes.length>=6&&['GIF87a','GIF89a'].includes(text(0,6)))return 'image/gif';
 throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
}

async function readImage(req:Pick<Request,'headers'|'body'>){
 const declared=req.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>MAX_IMAGE_BYTES))throw new Error('Images must be 5 MB or smaller.');
 const reader=req.body?.getReader();if(!reader)throw new Error('Choose an image to upload.');
 const chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_IMAGE_BYTES)throw new Error('Images must be 5 MB or smaller.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 if(!length)throw new Error('The image is empty.');
 const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 return {bytes,contentType:imageContentType(bytes)};
}

export async function uploadImage(req:Request){
 const owner=requireOwner(req),{bytes,contentType}=await readImage(req);
 let name='image';try{name=decodeURIComponent(req.headers.get('x-file-name')||'image').split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180)||'image';}catch{throw new Error('The filename is invalid.');}
 const id=crypto.randomUUID(),createdAt=Date.now(),expiresAt=createdAt+3600000,day=Math.floor(createdAt/86400000)*86400000;
 // Count attempts too: an unavailable relay cannot bypass the storage allowance.
 const claim=await db().prepare(`INSERT INTO uploads (id,owner,created_at,expires_at,name,content_type,size)
 SELECT ?,?,?,?,?,?,? WHERE
 (SELECT COUNT(*) FROM uploads WHERE owner = ? AND created_at >= ?) < 10 AND
 (SELECT COUNT(*) FROM uploads WHERE created_at >= ?) < 100 RETURNING id`)
 .bind(id,owner,createdAt,expiresAt,name,contentType,bytes.length,owner,day,day).first();
 if(!claim)throw new Error('The image upload allowance is used for today. You can still use a public image link.');
 const storage=bucket();
 let stage='cleanup';
 try{
  const abandoned=await db().prepare("SELECT id FROM uploads WHERE expires_at < ? AND (public_url IS NULL OR public_url != '') AND NOT EXISTS (SELECT 1 FROM checks WHERE json_extract(checks.result, '$.uploadId') = uploads.id AND checks.status != 'quoted') LIMIT 10").bind(createdAt).all();
  for(const row of abandoned.results){await storage.delete(String(row.id));await db().prepare("UPDATE uploads SET public_url = '' WHERE id = ?").bind(row.id).run();}
  stage='storage';await storage.put(id,bytes,{httpMetadata:{contentType}});
  const form=new FormData();form.set('reqtype','fileupload');form.set('time','1h');form.set('fileToUpload',new Blob([bytes],{type:contentType}),'image.'+({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[contentType]));
  stage='relay';const response=await fetch('https://litterbox.catbox.moe/resources/internals/api.php',{method:'POST',body:form,redirect:'manual',signal:AbortSignal.timeout(45000)});
  stage='relay-response-'+response.status;
  // Some hosts reject datacenter upload requests. The browser can relay the
  // already validated file; finalizeUpload verifies its bytes before use.
  if([403,412].includes(response.status))return {uploadId:id,name,contentType,size:bytes.length,expiresAt:new Date(expiresAt).toISOString(),relayRequired:true};
  if(!response.ok)throw new Error('Relay rejected the upload.');
  const value=(await response.text()).trim();
  if(value.length>250)throw new Error('Invalid relay response.');
  const publicUrl=relayUrl(value);
  stage='metadata';await db().prepare('UPDATE uploads SET public_url = ? WHERE id = ? AND owner = ?').bind(publicUrl.href,id,owner).run();
  return {uploadId:id,name,contentType,size:bytes.length,expiresAt:new Date(expiresAt).toISOString()};
 }catch(error){
  console.error('Lensy upload failed at '+stage+': '+(error instanceof Error?error.message:'Unknown error'));
  await storage.delete(id).catch(()=>{});
  throw new Error('The image could not be uploaded. No check was purchased. Try again or use a public image link.');
 }
}

function relayUrl(value:unknown){
 if(typeof value!=='string'||value.length>250)throw new Error('Invalid image link.');
 const url=new URL(value);
 if(url.origin!=='https://litter.catbox.moe'||url.username||url.password||!/^\/[a-zA-Z0-9]+\.(png|jpg|jpeg|webp|gif)$/.test(url.pathname)||url.search||url.hash)throw new Error('Invalid image link.');
 return url;
}

export async function finalizeUpload(req:Request){
 const owner=requireOwner(req),value=await req.json() as any;
 if(typeof value.uploadId!=='string'||!/^[a-f0-9-]{36}$/.test(value.uploadId))throw new Error('Choose an image again.');
 const row=await db().prepare('SELECT * FROM uploads WHERE id = ? AND owner = ?').bind(value.uploadId,owner).first();
 if(!row||Number(row.expires_at)<=Date.now()+120000)throw new Error('This upload is unavailable. Select the image again.');
 const url=relayUrl(value.url);
 if(row.public_url&&row.public_url!==url.href)throw new Error('This upload already has a different image link.');
 if(!row.public_url){
  const res=await fetch(url.href,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error('Could not read the uploaded image. No check was purchased.');
  const remote=await readImage(res),original=await bucket().get(String(row.id));
  if(!original||remote.bytes.length!==Number(row.size))throw new Error('The image link does not match your upload.');
  const stored=await new Response(original.body).arrayBuffer();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',stored),crypto.subtle.digest('SHA-256',remote.bytes)]);
  if(!new Uint8Array(a).every((v,i)=>v===new Uint8Array(b)[i]))throw new Error('The image link does not match your upload.');
  await db().prepare('UPDATE uploads SET public_url = ? WHERE id = ? AND owner = ? AND public_url IS NULL').bind(url.href,row.id,owner).run();
 }
 return {uploadId:String(row.id),name:String(row.name),contentType:String(row.content_type),expiresAt:new Date(Number(row.expires_at)).toISOString()};
}

export async function resolveMediaInput(req:Request,value:any):Promise<{url:string;upload?:UploadedMedia}>{
 if(value.uploadId===undefined)return {url:mediaUrl(value.url)};
 if(typeof value.uploadId!=='string'||!/^[a-f0-9-]{36}$/.test(value.uploadId))throw new Error('Choose an image again.');
 const row=await db().prepare('SELECT * FROM uploads WHERE id = ? AND owner = ?').bind(value.uploadId,requireOwner(req)).first();
 if(!row?.public_url)throw new Error('This uploaded image is not available in your workspace.');
 if(Number(row.expires_at)<=Date.now()+120000)throw new Error('The image link has expired. Select the image again before starting a check.');
 return {url:String(row.public_url),upload:{id:String(row.id),name:String(row.name),contentType:String(row.content_type)}};
}
