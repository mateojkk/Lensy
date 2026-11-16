import { db, fromRow, json, requireOwner, route } from "../../../lib/server";
export async function GET(req:Request) { return route(req,async()=>{
  const feed=new URL(req.url).searchParams.get("feed")==="1";
  const rows=feed
    ? await db().prepare("SELECT * FROM checks WHERE mode = 'live' AND status = 'complete' AND listed = 1 AND shared = 1 ORDER BY created_at DESC LIMIT 30").all()
    : await db().prepare("SELECT * FROM checks WHERE owner = ? AND mode = 'live' AND status != 'quoted' ORDER BY created_at DESC LIMIT 50").bind(requireOwner(req)).all();
  return json({checks:rows.results.map(fromRow)});
}); }
export async function POST(req:Request) { return route(req,async()=>json({error:"Checks require a live Telegraph quote and wallet approval. Use a public media URL to request a quote."},405,{Allow:"GET"})); }
