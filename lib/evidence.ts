import type { Check } from './lensy';
import { fromMicros, formatMoney, toMicros, totalCosts } from './money';

export const MAX_COMPARISON = 4;
export function comparisonSummary(checks: Check[]) {
 const totals=totalCosts(checks.map(c=>c.cost));
 const knownCost=fromMicros(checks.reduce((sum,c)=>sum+(toMicros(c.cost??c.knownCost)??0n),0n));
 const receipts=new Set(checks.flatMap(c=>c.receipts.flatMap(r=>r.hash?[r.hash.toLowerCase()]:[])));
 const verdicts=new Set(checks.filter(c=>['complete','partial'].includes(c.status)&&c.verdict!=='No structured verdict').map(c=>c.verdict));
 return {...totals,knownCost,receipts:receipts.size,unconfirmed:checks.filter(c=>c.cost===null).length,differingVerdicts:verdicts.size>1};
}
export function parseComparisonIds(value: string | null): string[] {
 const ids=value?.split(',')||[];
 if(!ids.length||ids.length>MAX_COMPARISON||ids.some(id=>!/^[-a-zA-Z0-9_]{1,100}$/.test(id))||new Set(ids).size!==ids.length)throw new Error('Choose between one and four different saved checks.');
 return ids;
}
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const status=(value:string)=>({complete:'Completed',partial:'Partial result',running:'In progress',interrupted:'Needs review',failed:'Failed'}[value]||value);
const confidence=(c:Check)=>c.confidence===null?'Not reported':Math.round(c.confidence*100)+'%';
function link(value: string, title: string) {
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return `<a href="${escape(url.href)}" rel="noreferrer">${escape(title)}</a>`;}catch{}
 return escape(title);
}
// An inert, self-contained snapshot: no scripts, external assets, or remote requests.
export function evidenceHTML(checks:Check[],generatedAt=new Date().toISOString()) {
 const summary=comparisonSummary(checks);
 const details=checks.map((c,i)=>`<section><p class="eyebrow">CHECK ${i+1} · ${escape(status(c.status))}</p><h2>${escape(c.name)}</h2><p class="source">${link(c.media,c.media)}</p><p class="meta">Check ${escape(c.id)} · Recorded ${escape(c.createdAt)}</p><h3>${escape(c.verdict)}</h3><p>${escape(c.summary)}</p>${c.warning?`<p class="warning">${escape(c.warning)}</p>`:''}<dl><div><dt>Provider confidence</dt><dd>${confidence(c)}</dd></div><div><dt>${c.paymentSource==='lensy'?'Network cost covered by Lensy':'Reported cost'} · test USDC</dt><dd>${formatMoney(c.cost)}</dd></div>${c.cost===null?`<div><dt>Known charges · test USDC</dt><dd>${formatMoney(c.knownCost)}</dd></div>`:''}</dl><h4>Findings</h4><ul>${c.findings.length?c.findings.map(f=>`<li>${escape(f)}</li>`).join(''):'<li>No structured findings returned.</li>'}</ul>${c.caption?`<h4>Image description</h4><p>${escape(c.caption)}</p>`:''}<h4>Payment receipts (${c.receipts.length})</h4>${c.receipts.length?c.receipts.map(r=>`<div class="receipt"><p>${escape(r.intent)} · ${formatMoney(r.amount)} test USDC</p><p>${r.url?link(r.url,r.hash||'Epoch proof'):escape(r.hash||'Hash unavailable')}</p><pre>${escape(JSON.stringify(r.raw??r,null,2))}</pre></div>`).join(''):'<p>No payment receipt returned.</p>'}${c.providers?.length?`<h4>Original provider responses</h4>${c.providers.map(p=>`<details open><summary>${escape(p.intent)} · ${escape(p.status)}</summary>${p.error?`<p>${escape(p.error)}</p>`:''}<pre>${escape(JSON.stringify(p.response??null,null,2))}</pre></details>`).join('')}`:''}</section>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>Lensy — Evidence report</title><style>body{font:15px/1.7 system-ui,sans-serif;font-weight:400;max-width:960px;margin:50px auto;padding:0 28px;color:#211a15;background:#fff}h1,h2,h3,h4{font-weight:500;line-height:1.3}h1{font-size:36px;letter-spacing:-1.5px;margin-bottom:8px}h2{font-size:24px;overflow-wrap:anywhere}h3{font-size:21px;color:#76553c}h4{margin:26px 0 10px}a{color:#76553c;overflow-wrap:anywhere}section{border-top:1px solid #d9cfc6;margin-top:36px;padding-top:26px;break-inside:auto}.eyebrow,.meta,footer{font-size:12px;color:#796b60}.eyebrow{letter-spacing:1.4px}.source{font-size:13px}dl{display:flex;flex-wrap:wrap;gap:30px}dt{font-size:12px;color:#796b60}dd{font-size:19px;margin:2px 0}.warning{border-left:3px solid #967357;padding:12px;background:#f5f0eb}.receipt{border:1px solid #ddd2c8;padding:16px;margin:12px 0;break-inside:avoid}.receipt p{margin:0 0 10px;font-size:12px}pre{font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f4f1;padding:14px}summary{cursor:pointer;font-size:12px}footer{border-top:1px solid #d9cfc6;margin-top:40px;padding-top:20px}@media print{body{margin:0;max-width:none;padding:0;font-size:11px}h1{font-size:27px}h2{font-size:21px}a{color:inherit}details>pre{display:block}pre{font-size:9px}section{margin-top:24px}h2,h3,h4{break-after:avoid}}</style></head><body><header><p class="eyebrow">LENSY / EVIDENCE REPORT</p><h1>${checks.length>1?'Media comparison':'Media check'}</h1><p class="meta">Snapshot generated ${escape(generatedAt)} · Telegraph / Ethereum Sepolia testnet</p><dl><div><dt>Saved checks</dt><dd>${checks.length}</dd></div><div><dt>Reported total · test USDC</dt><dd>${formatMoney(summary.cost)}</dd></div><div><dt>Known charges · test USDC</dt><dd>${formatMoney(summary.knownCost)}</dd></div><div><dt>Unique payment receipts</dt><dd>${summary.receipts}</dd></div></dl>${summary.unconfirmed?`<p class="warning">${summary.unconfirmed} check(s) have unconfirmed charges.</p>`:''}</header>${details}<footer>Provider assessments and confidence are reported as received. A receipt records payment; it does not independently establish media authenticity. This offline snapshot is not a live protocol proof. Downloaded copies remain accessible after share links are revoked. No new verification was purchased to generate this report.</footer></body></html>`;
}
export function evidenceCSV(checks:Check[]) {
 const cell=(value:unknown)=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const rows=[['Check ID','Name','Source URL','Created at','Status','Verdict','Confidence','Reported test USDC','Known test USDC','Receipt count','Receipt hashes'],...checks.map(c=>[c.id,c.name,c.media,c.createdAt,c.status,c.verdict,c.confidence??'',c.cost??'',c.cost??c.knownCost??'',c.receipts.length,c.receipts.map(r=>r.hash).filter(Boolean).join(' ')])];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
