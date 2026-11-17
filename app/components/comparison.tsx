"use client";
import type {ReactNode} from 'react';
import {ArrowUpRight,Columns2,Download,FileText,Plus,X} from 'lucide-react';
import type {Check} from '../../lib/lensy';
import {money} from '../../lib/lensy';
import {comparisonSummary} from '../../lib/evidence';

type Props={checks:Check[];loading:boolean;media:(check:Check)=>ReactNode;onRemove:(id:string)=>void;onOpen:(check:Check)=>void;onReport:()=>void;onCSV:()=>void;onChoose:()=>void};
const status=(s:string)=>({complete:'Completed',partial:'Partial result',running:'In progress',interrupted:'Needs review',failed:'Failed'}[s]||s);
export default function Comparison({checks,loading,media,onRemove,onOpen,onReport,onCSV,onChoose}:Props){
 const summary=comparisonSummary(checks);
 return <div className="comparison-workspace">
  <div className="intro"><div><h1>Compare checks</h1><p className="comparison-description">Saved evidence, side by side.</p></div><button className="secondary-button" onClick={onChoose}><Plus size={15}/>Choose checks</button></div>
  {loading?<div className="empty-state" role="status"><Columns2 size={28}/><h3>Loading saved evidence…</h3></div>:checks.length?<>
   <div className="comparison-overview"><div><span>Checks</span><strong>{checks.length}<small> / 4</small></strong></div><div><span>Reported total</span><strong>{money(summary.cost)}</strong><small>Sepolia test USDC</small></div><div><span>Unique receipts</span><strong>{summary.receipts}</strong></div><div className="comparison-exports"><button className="primary-button" onClick={onReport}><FileText size={15}/>Download report</button><button className="text-button brown" onClick={onCSV}><Download size={14}/>Export CSV</button></div></div>
   {summary.unconfirmed>0&&<div className="comparison-note" role="status">{summary.unconfirmed} {summary.unconfirmed===1?'check has':'checks have'} unconfirmed charges. Known charges: {money(summary.knownCost)} USDC.</div>}
   {summary.differingVerdicts&&<div className="comparison-note">Provider assessments differ across these checks. Confidence scores describe each provider’s assessment and do not establish which result is correct.</div>}
   {checks.length===1&&<div className="comparison-note">Choose another check from My checks to compare it with this result.</div>}
   <div className="comparison-grid" style={{gridTemplateColumns:`repeat(${Math.min(checks.length,2)},minmax(0,1fr))`}}>
    {checks.map((check,i)=><article className="comparison-card" key={check.id} aria-label={'Comparison: '+check.name}>
     <header><span>0{i+1} / {status(check.status)}</span><button className="icon-button" aria-label={'Remove '+check.name+' from comparison'} onClick={()=>onRemove(check.id)}><X size={16}/></button></header>
     <div className="comparison-media">{media(check)}</div><div className="comparison-body"><h2>{check.name}</h2><time dateTime={check.createdAt}>{new Date(check.createdAt).toLocaleString()}</time><a className="comparison-source" href={check.media} target="_blank" rel="noreferrer">Source media<ArrowUpRight size={13}/></a><div className="comparison-verdict"><span>Provider assessment</span><h3>{check.verdict}</h3><p>{check.summary}</p></div>
      <dl className="comparison-facts"><div><dt>Confidence</dt><dd>{check.confidence===null?'Not reported':Math.round(check.confidence*100)+'%'}</dd></div><div><dt>Reported cost</dt><dd>{money(check.cost)}</dd></div><div><dt>Payment receipts</dt><dd>{check.receipts.length}</dd></div></dl>
      {check.warning&&<p className="comparison-warning">{check.warning}</p>}
      <div className="comparison-findings"><h4>Findings</h4><ul>{check.findings.length?check.findings.map((finding,index)=><li key={index}>{finding}</li>):<li>No structured findings returned.</li>}</ul></div>
      {check.caption&&<div className="comparison-caption"><h4>Image description</h4><p>{check.caption}</p></div>}
      <button className="text-button brown" onClick={()=>onOpen(check)}>Open result and receipts<ArrowUpRight size={14}/></button>
     </div>
    </article>)}
   </div><p className="comparison-footnote">Reports are offline snapshots and remain accessible after a share link is revoked. Comparing or exporting saved evidence makes no new purchase.</p>
  </>:<div className="empty-state"><div className="empty-icon"><Columns2 size={30}/></div><h3>Choose your checks</h3><p>Select up to four saved checks from My checks.</p><button className="primary-button" onClick={onChoose}>My checks<Plus size={16}/></button></div>}
 </div>;
}
