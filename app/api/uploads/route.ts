import {json,route} from '../../../lib/server';
import {uploadImage,finalizeUpload} from '../../../lib/uploads';
export async function POST(req:Request){return route(req,async()=>json(await uploadImage(req),201));}
export async function PATCH(req:Request){return route(req,async()=>json(await finalizeUpload(req)));}
