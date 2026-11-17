import { db, fromRow, json, requireOwner, route } from '../../../../lib/server';
export async function GET(req:Request){return route(req,async()=>{
 const owner=requireOwner(req),rows=await db().prepare("SELECT * FROM checks WHERE owner = ? AND mode = 'live' AND status != 'quoted' ORDER BY created_at DESC, id DESC").bind(owner).all();
 return json({version:1,exportedAt:new Date().toISOString(),network:'Ethereum Sepolia',currency:'USDC',checks:rows.results.map(r=>fromRow(r,owner))},200,{'Content-Disposition':'attachment; filename="lensy-history.json"'});
});}
