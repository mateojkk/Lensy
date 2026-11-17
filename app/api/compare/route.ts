import { db, fromRow, json, requireOwner, route } from '../../../lib/server';
import { comparisonSummary, parseComparisonIds } from '../../../lib/evidence';
export async function GET(req:Request){return route(req,async()=>{
 const owner=requireOwner(req),ids=parseComparisonIds(new URL(req.url).searchParams.get('ids'));
 const rows=await db().prepare(`SELECT * FROM checks WHERE owner = ? AND mode = 'live' AND status != 'quoted' AND id IN (${ids.map(()=>'?').join(',')})`).bind(owner,...ids).all();
 // Fail the entire comparison rather than reveal which IDs belong to another user.
 if(rows.results.length!==ids.length)return json({error:'One or more saved checks are unavailable in your workspace.'},404);
 const checks=ids.map(id=>fromRow(rows.results.find(row=>row.id===id)!,owner));
 return json({checks,summary:comparisonSummary(checks)});
});}
