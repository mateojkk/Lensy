import { identity, json } from "../../../lib/server";
export async function GET(req:Request) {
  const headers: Record<string,string> = {};
  if(!identity(req)) headers["Set-Cookie"]=`lensy_session=${crypto.randomUUID()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==="https:"?"; Secure":""}`;
  return json({liveAvailable:null},200,headers);
}
