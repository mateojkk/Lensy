import {json,route} from '../../../lib/server';
import {uploadImage} from '../../../lib/uploads';
export async function POST(req:Request){return route(req,async()=>json(await uploadImage(req),201));}
