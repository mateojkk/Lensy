import { identity, json } from "../../../lib/server";
import {sponsorConfig} from '../../../lib/sponsored';
export async function GET(req:Request) {
  const headers: Record<string,string> = {};
  if(!identity(req)) headers["Set-Cookie"]=`lensy_session=${crypto.randomUUID()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==="https:"?"; Secure":""}`;
  const sponsor=sponsorConfig();
  return json({liveAvailable:null,sponsored:{available:sponsor.available,checksPerDay:sponsor.checks}},200,headers);
}
