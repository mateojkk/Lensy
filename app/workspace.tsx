"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ArrowRight,ChevronRight,CircleHelp,Copy,ExternalLink,FileCheck2,FileImage,Globe2,History,Info,Link2,Loader2,LockKeyhole,Menu,Plus,ScanLine,Search,ShieldCheck,Wallet,X,ReceiptText,CircleCheck,Download,Clock3,Columns2,FileText} from 'lucide-react';
import SiteFooter from './components/site-footer';
import BrandLogo from './components/brand-logo';
import {money,type Check as MediaCheck,type QuoteResponse} from '../lib/lensy';
import {fromMicros} from '../lib/money';
import {evidenceHTML,evidenceCSV,MAX_COMPARISON,parseComparisonIds} from '../lib/evidence';
import Comparison from './components/comparison';
import ThemeSwitch from './components/theme';

type View='new'|'history'|'community'|'result'|'compare';
type Ethereum={request(args:{method:string;params?:unknown[]}):Promise<any>;on?(event:string,callback:(value:any)=>void):void;removeListener?(event:string,callback:(value:any)=>void):void};
type Stats={checks:number;receipts:number;knownSpend:string;unconfirmed:number;completed:number};
class ApiError extends Error{constructor(message:string,public status:number){super(message);}}
async function api(path:string,options?:RequestInit){const response=await fetch(path,options);let data:any;try{data=await response.json();}catch{throw new ApiError('The server could not complete this request.',response.status);}if(!response.ok)throw new ApiError(data.error||'Request failed.',response.status);return data;}
const send=(body:unknown)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const ethereum=()=> (window as Window&{ethereum?:Ethereum}).ethereum;
const message=(error:unknown)=> error&&typeof error==='object'&&'code'in error&&error.code===4001?'Wallet request cancelled.':error instanceof Error?error.message:'Request failed. Please try again.';
const label=(intent:string)=>intent==='MEDIA_FORENSIC_VERIFY_GENERAL'?'Media verification':intent==='IMAGE_CAPTIONING_GENERAL'?'Image description':intent.replaceAll('_',' ');
const statusLabel=(status:string)=>({complete:'Completed',partial:'Partial result',running:'In progress',interrupted:'Needs review',failed:'Failed'} as Record<string,string>)[status]||status;
const date=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function Flag({verdict}:{verdict:string}){return <span className={`flag ${/manipulated/i.test(verdict)?'flagged':/authentic/i.test(verdict)?'authentic':'uncertain'}`}><span/>{verdict}</span>;}
function Media({check}:{check:MediaCheck}){const [failed,setFailed]=useState(false);if(failed)return <div className="media-unavailable"><FileImage size={25}/><span>Preview unavailable</span><a href={check.media} target="_blank" rel="noreferrer">Open source<ExternalLink size={12}/></a></div>;return check.mediaType.startsWith('video')?<video src={check.media} controls preload="metadata" onError={()=>setFailed(true)}/>:<img src={check.media} alt={check.name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;}
function download(value:string,name:string,type:string){const url=URL.createObjectURL(new Blob([value],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function saveJSON(value:unknown,name:string){download(JSON.stringify(value,null,2),name,'application/json');}
function saveReport(checks:MediaCheck[]){download(evidenceHTML(checks),'lensy-evidence-report.html','text/html;charset=utf-8');}

export default function LensyApp({shareId,checkId,comparison=false}:{shareId?:string;checkId?:string;comparison?:boolean}){
 const [view,setView]=useState<View>(comparison?'compare':shareId||checkId?'result':'new');
 const [url,setUrl]=useState(''),[caption,setCaption]=useState(false),[quote,setQuote]=useState<QuoteResponse|null>(null),[now,setNow]=useState(Date.now());
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false);
 const [result,setResult]=useState<MediaCheck|null>(null),[history,setHistory]=useState<MediaCheck[]>([]),[community,setCommunity]=useState<MediaCheck[]>([]),[stats,setStats]=useState<Stats|null>(null);
 const [loading,setLoading]=useState(!!(shareId||checkId)),[nextCursor,setNextCursor]=useState<string|null>(null),[query,setQuery]=useState(''),[status,setStatus]=useState('all');
 const [wallet,setWallet]=useState(''),[chain,setChain]=useState(''),[sidebar,setSidebar]=useState(false);
 const [modal,setModal]=useState<'help'|'wallet'|'share'|'receipt'|'response'|null>(null),[receiptIndex,setReceiptIndex]=useState(0),[listed,setListed]=useState(false),[shareUrl,setShareUrl]=useState('');
 const closeRef=useRef<HTMLButtonElement>(null),modalRef=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<string[]>([]),[compared,setCompared]=useState<MediaCheck[]>([]),[searching,setSearching]=useState(false);
 const listRequest=useRef(0);
 const quoteSeconds=quote?Math.max(0,Math.ceil((Date.parse(quote.expiresAt)-now)/1000)):0,expired=!!quote&&quoteSeconds===0;
 useEffect(()=>{const viewport=window.matchMedia('(max-width:700px)');const close=()=>setSidebar(false);viewport.addEventListener('change',close);return()=>viewport.removeEventListener('change',close);},[]);
 useEffect(()=>{api('/api/config').then(()=>setReady(true)).catch(()=>setError('Could not start your session. Refresh to try again.'));},[]);
 useEffect(()=>{
  if(!ready)return;
  try{const saved=JSON.parse(sessionStorage.getItem('lensy.comparison')||'[]');if(Array.isArray(saved))setSelected(saved.filter((v:unknown)=>typeof v==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(v)).slice(0,MAX_COMPARISON));}catch{}
  if(!comparison)return;
  const ids=new URLSearchParams(window.location.search).get('ids');if(!ids)return;
  let active=true;setLoading(true);
  try{parseComparisonIds(ids);}catch(e){setError(message(e));setLoading(false);return;}
  api('/api/compare?ids='+encodeURIComponent(ids)).then(data=>{if(active){setCompared(data.checks);setSelected(data.checks.map((c:MediaCheck)=>c.id));sessionStorage.setItem('lensy.comparison',JSON.stringify(data.checks.map((c:MediaCheck)=>c.id)));}}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[ready,comparison]);
 useEffect(()=>{
  if(!ready||(view!=='history'&&view!=='community'))return;
  const request=++listRequest.current;setSearching(true);setNextCursor(null);
  const timer=setTimeout(()=>{
   api('/api/checks?'+new URLSearchParams({...(view==='community'?{feed:'1'}:{}),q:query,status})).then(data=>{if(request===listRequest.current){view==='history'?setHistory(data.checks):setCommunity(data.checks);setNextCursor(data.nextCursor);}}).catch(e=>{if(request===listRequest.current)setError(message(e));}).finally(()=>{if(request===listRequest.current)setSearching(false);});
  },250);
  return()=>{clearTimeout(timer);if(listRequest.current===request)listRequest.current++;};
 },[ready,view,query,status]);
 useEffect(()=>{if(!quote)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[quote]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{
  const eth=ethereum();if(!eth)return;
  const accounts=(values:string[])=>{if(!sessionStorage.getItem('lensy.walletDisconnected'))setWallet(values[0]||'');};
  const chains=(value:string)=>setChain(value);
  eth.request({method:'eth_accounts'}).then(accounts).catch(()=>{});eth.request({method:'eth_chainId'}).then(chains).catch(()=>{});
  eth.on?.('accountsChanged',accounts);eth.on?.('chainChanged',chains);
  return()=>{eth.removeListener?.('accountsChanged',accounts);eth.removeListener?.('chainChanged',chains);};
 },[]);
 useEffect(()=>{
  const id=checkId||shareId;if(!id)return;let cancelled=false;
  setLoading(true);api((shareId?'/api/shared/':'/api/checks/')+encodeURIComponent(id)).then(data=>{if(!cancelled)setResult(data.check);}).catch(e=>{if(!cancelled)setError(message(e));}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[checkId,shareId]);
 useEffect(()=>{
  if(view!=='result'||!result||result.status!=='running'||!result.viewerIsOwner)return;
  let cancelled=false;const id=result.id;
  const timer=setInterval(()=>{api('/api/checks/'+id).then(data=>{if(!cancelled)setResult(data.check);}).catch(()=>{});},2500);
  return()=>{cancelled=true;clearInterval(timer);};
 },[result?.id,result?.status,result?.viewerIsOwner,view]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!modal){setSidebar(false);if(sidebar)document.querySelector<HTMLButtonElement>('.menu-button')?.focus();}if(event.key.toLowerCase()==='n'&&!event.metaKey&&!event.ctrlKey&&!modal&&!busy&&!['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement).tagName)){void navigate('new');}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[modal,busy,sidebar]);
 useEffect(()=>{
  if(!modal)return;const prior=document.activeElement as HTMLElement;closeRef.current?.focus();const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)setModal(null);if(event.key==='Tab'){const nodes=modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previous;prior?.focus();};
 },[modal,busy]);
 async function navigate(next:View){
  if(busy)return;if(next==='compare'){openComparison();return;}setView(next);setError('');setSidebar(false);setQuery('');setStatus('all');window.history.replaceState(null,'','/app');
  if(next==='new'){setResult(null);setQuote(null);}
  if(next==='history'||next==='community'){
   if(next==='history')try{setStats(await api('/api/stats'));}catch(e){setError(message(e));}
  }
 }
 async function loadMore(){if(!nextCursor||loading||searching)return;const request=listRequest.current;setLoading(true);try{const data=await api('/api/checks?'+new URLSearchParams({...(view==='community'?{feed:'1'}:{}),cursor:nextCursor,q:query,status}));if(request===listRequest.current){view==='history'?setHistory(old=>[...old,...data.checks]):setCommunity(old=>[...old,...data.checks]);setNextCursor(data.nextCursor);}}catch(e){if(request===listRequest.current)setError(message(e));}finally{setLoading(false);}}
 function selection(ids:string[]){setSelected(ids);sessionStorage.setItem('lensy.comparison',JSON.stringify(ids));}
 function toggleComparison(id:string){if(selected.includes(id)){selection(selected.filter(v=>v!==id));return;}if(selected.length>=MAX_COMPARISON){setNotice('Compare up to four checks. Remove one to add another.');return;}selection([...selected,id]);}
 function openComparison(){window.location.assign('/app/compare'+(selected.length?'?ids='+encodeURIComponent(selected.join(',')):''));}
 function removeCompared(id:string){const next=compared.filter(c=>c.id!==id);setCompared(next);selection(next.map(c=>c.id));window.history.replaceState(null,'','/app/compare'+(next.length?'?ids='+encodeURIComponent(next.map(c=>c.id).join(',')):''));}
 function present(check:MediaCheck){setResult(check);setView('result');setError('');setLoading(false);window.history.replaceState(null,'','/app/checks/'+check.id);sessionStorage.removeItem('lensy.pendingCheckId');window.scrollTo({top:0,behavior:'smooth'});}
 function openResult(check:MediaCheck){window.location.assign(check.viewerIsOwner?'/app/checks/'+check.id:check.shareUrl||'/app/checks/'+check.id);}
 async function submit(){if(busy||!ready)return;setBusy(true);setError('');try{setProgress('Getting quote…');setQuote(await api('/api/quote',send({url,caption})));}catch(e){setError(message(e));}finally{setBusy(false);setProgress('');}}
 async function connectWallet(){setError('');try{const eth=ethereum();if(!eth)throw new Error('Install an Ethereum wallet extension to approve checks.');const accounts=await eth.request({method:'eth_requestAccounts'});if(!accounts[0])throw new Error('No wallet account selected.');sessionStorage.removeItem('lensy.walletDisconnected');setWallet(accounts[0]);setChain(await eth.request({method:'eth_chainId'}));setModal(null);setNotice('Wallet connected');}catch(e){setError(message(e));}}
 async function switchChain(){const eth=ethereum();if(!eth)throw new Error('Connect your wallet first.');await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});setChain('0xaa36a7');}
 async function purchase(){
  if(!quote||busy)return;if(expired){await submit();return;}const selected=quote;let submitted=false;
  setError('');setBusy(true);
  try{
   const eth=ethereum();if(!eth)throw new Error('Connect an Ethereum wallet first.');const accounts=await eth.request({method:'eth_requestAccounts'});if(!accounts[0])throw new Error('Select a wallet account.');const address=accounts[0].toLowerCase();sessionStorage.removeItem('lensy.walletDisconnected');setWallet(address);
   if(await eth.request({method:'eth_chainId'})!=='0xaa36a7')await switchChain();
   const payments:string[]=[];
   for(const item of selected.quotes){
    if(Date.now()>=Date.parse(selected.expiresAt))throw new Error('Quote expired before payment. Get a fresh quote.');
    setProgress('Approve '+label(item.intent).toLowerCase()+'…');const seconds=Math.floor(Date.now()/1000);
    const authorization={from:address,to:item.escrow.payTo,value:item.amount,validAfter:String(seconds-5),validBefore:String(seconds+100),nonce:crypto.randomUUID()};
    const text=item.escrow.extra.message.replaceAll('{from}',address).replaceAll('{nonce}',authorization.nonce).replaceAll('{validAfter}',authorization.validAfter).replaceAll('{validBefore}',authorization.validBefore);
    const hex='0x'+Array.from(new TextEncoder().encode(text),b=>b.toString(16).padStart(2,'0')).join('');
    const signature=await eth.request({method:'personal_sign',params:[hex,address]});payments.push(btoa(JSON.stringify({x402Version:2,scheme:'escrow',network:item.escrow.network,payload:{signature,authorization}})));
   }
   if(Date.now()>=Date.parse(selected.expiresAt))throw new Error('Quote expired before submission. Get a fresh quote.');
   submitted=true;sessionStorage.setItem('lensy.pendingCheckId',selected.id);window.history.replaceState(null,'','/app/checks/'+selected.id);setProgress('Checking media…');
   const data=await api('/api/verify',send({id:selected.id,payments}));setQuote(null);present(data.check);
  }catch(e){
   if(submitted){try{const recovered=await api('/api/checks/'+selected.id);setQuote(null);present(recovered.check);setNotice('Recovered the saved request. It was not purchased again.');}catch{setError(message(e)+' Check My checks before submitting another purchase.');}}
   else setError(message(e));
  }finally{setBusy(false);setProgress('');}
 }
 function sharing(){if(!result)return;setListed(!!result.listed);setShareUrl(result.shareUrl?window.location.origin+result.shareUrl:'');setModal('share');}
 async function share(enabled=true){if(!result)return;setBusy(true);setError('');try{const data=await api('/api/checks/'+result.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({shared:enabled,listed:enabled&&listed})});setResult(data.check);setShareUrl(data.url?window.location.origin+data.url:'');if(!enabled){setListed(false);setNotice('Sharing revoked. The old link no longer works.');}else setNotice(result.shared?'Sharing settings saved':'Share link created');}catch(e){setError(message(e));}finally{setBusy(false);}}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('Link copied');}catch{setNotice('Select and copy the link.');}}
 async function exportHistory(){setBusy(true);try{saveJSON(await api('/api/checks/export'),'lensy-history.json');}catch(e){setError(message(e));}finally{setBusy(false);}}
 const filtered=view==='history'?history:community;
 const owned=!!result?.viewerIsOwner;
 return <div className="app-shell">
  <aside id="app-sidebar" aria-label="Workspace sidebar" className={`sidebar ${sidebar?'open':''}`}><BrandLogo className="workspace-brand"/><div className="workspace-label">YOUR WORKSPACE</div><nav aria-label="Main navigation"><button aria-label="New check" title="New check" className={view==='new'?'active':''} disabled={busy} onClick={()=>navigate('new')}><Plus size={19}/><span className="nav-label">New check</span><span className="key-hint">N</span></button><button aria-label="My checks" title="My checks" className={view==='history'?'active':''} disabled={busy} onClick={()=>navigate('history')}><History size={19}/><span className="nav-label">My checks</span></button><button aria-label="Compare checks" title="Compare checks" className={view==='compare'?'active':''} disabled={busy||!ready} onClick={()=>navigate('compare')}><Columns2 size={19}/><span className="nav-label">Compare checks</span>{selected.length>0&&<span className="key-hint">{selected.length}</span>}</button><button aria-label="Community feed" title="Community feed" className={view==='community'?'active':''} disabled={busy} onClick={()=>navigate('community')}><Globe2 size={19}/><span className="nav-label">Community feed</span></button></nav><div className="sidebar-bottom"><button aria-label="Help" title="Help" className="help-button" onClick={()=>setModal('help')}><CircleHelp size={18}/><span className="nav-label">Help</span></button></div></aside>
  {sidebar&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setSidebar(false)}/>}
  <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="menu-button icon-button" aria-label="Open navigation" aria-expanded={sidebar} aria-controls="app-sidebar" disabled={!ready} onClick={()=>setSidebar(!sidebar)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{view==='new'?'New check':view==='history'?'My checks':view==='community'?'Community feed':view==='compare'?'Compare checks':shareId?'Shared result':'Result'}</strong></div><div className="topbar-actions"><ThemeSwitch/><span className="network"><span className="status-dot neutral"/>Telegraph · Sepolia</span><button className="wallet-button" disabled={!ready||busy} onClick={()=>setModal('wallet')}><Wallet size={15}/><span>{wallet?wallet.slice(0,6)+'…'+wallet.slice(-4):'Connect wallet'}</span></button></div></header>
  <main className="workspace-main">
   {error&&<div className="alert" role="alert"><Info size={17}/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
   {view==='new'&&<><div className="intro"><h1>New check</h1></div><div className="check-form-layout"><section className="upload-card"><div className="card-heading"><div className="section-title"><span className="small-icon"><ScanLine size={18}/></span><h2>Media verification</h2></div><span className="private-pill"><LockKeyhole size={12}/>Private by default</span></div><label className="live-input-label" htmlFor="media-url">Media URL</label><div className="url-input"><Link2 size={17}/><input id="media-url" type="url" placeholder="https://example.com/image.jpg" value={url} disabled={busy} onChange={e=>{setUrl(e.target.value);setQuote(null);}}/></div><p className="input-note">Public HTTPS image or video URL.</p><div className="upload-options"><label className="checkbox-label"><input type="checkbox" disabled={busy} checked={caption} onChange={e=>{setCaption(e.target.checked);setQuote(null);}}/><span>Image description</span><span className="optional">optional</span></label><button className="icon-button" aria-label="About image descriptions" onClick={()=>setNotice('Captioning has its own quoted price and runs in parallel.')}><Info size={14}/></button></div>
    {quote&&<div className={`quote-panel ${expired?'is-expired':''}`}><div><strong>Quote</strong><b>{money(quote.total)} USDC</b></div><ul className="quote-lines">{quote.quotes.map(q=><li key={q.intent}><span>{label(q.intent)}</span><span>{money(fromMicros(q.amount))}</span></li>)}</ul><div className="quote-expiry" role="status"><span><Clock3 size={13}/>{expired?'Quote expired':`Expires in ${Math.floor(quoteSeconds/60)}:${String(quoteSeconds%60).padStart(2,'0')}`}</span><button className="text-button brown" disabled={busy} onClick={submit}>Refresh quote</button></div></div>}
    <div className="upload-footer"><span><Wallet size={15}/>Sepolia test USDC</span><button className="primary-button" disabled={busy||!ready||!url} onClick={quote&&!expired?purchase:submit}>{busy?<Loader2 className="spin" size={16}/>:<ScanLine size={16}/>}<span>{busy?progress:quote&&!expired?'Approve '+money(quote.total):expired?'Refresh quote':'Get quote'}</span>{!busy&&<ArrowRight size={15}/>}</button></div>
   </section></div></>}
   {view==='compare'&&<Comparison checks={compared} loading={loading} media={check=><Media key={check.id} check={check}/>} onRemove={removeCompared} onOpen={openResult} onReport={()=>saveReport(compared)} onCSV={()=>download(evidenceCSV(compared),'lensy-comparison.csv','text/csv;charset=utf-8')} onChoose={()=>navigate('history')}/>}
   {(view==='history'||view==='community')&&<><div className="intro"><h1>{view==='history'?'My checks':'Community feed'}</h1><div className="result-actions">{view==='history'&&<button className="secondary-button" disabled={busy} onClick={exportHistory}><Download size={15}/>Export history</button>}<button className="primary-button" onClick={()=>navigate('new')}><Plus size={16}/>New check</button></div></div>
    {view==='history'&&stats&&<div className="history-stats"><div><span>Checks</span><strong>{stats.checks}</strong><small>{stats.completed} completed</small></div><div><span>Reported spend</span><strong>{money(stats.knownSpend)}</strong><small>{stats.unconfirmed?stats.unconfirmed+' charges unconfirmed':'Sepolia test USDC'}</small></div><div><span>Payment receipts</span><strong>{stats.receipts}</strong><small>Original network receipts</small></div></div>}
    <div className="list-toolbar"><h2>{view==='history'?'Saved checks':'Shared checks'} <span>{filtered.length}</span></h2><div className="history-filters"><select aria-label="Filter check status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{['complete','partial','running','interrupted','failed'].map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><div className="search-input"><Search size={16}/><input aria-label="Search checks" maxLength={200} placeholder="Name, source, or verdict…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div></div>
    {(loading||searching)&&!filtered.length?<div className="empty-state"><Loader2 className="spin"/><h3>Loading checks…</h3></div>:filtered.length?<div className="check-grid saved-grid" aria-busy={searching}>{filtered.map(check=><div className={`saved-check ${selected.includes(check.id)?'is-selected':''}`} key={check.id}>{view==='history'&&<label className="comparison-select"><input type="checkbox" checked={selected.includes(check.id)} onChange={()=>toggleComparison(check.id)} aria-label={'Compare '+check.name}/><span>Select to compare</span></label>}<button className="check-card" key={check.id} onClick={()=>openResult(check)}><div className="check-image"><Media check={check}/><span className="check-tag">{statusLabel(check.status)}</span></div><div className="check-info"><h3>{check.name}</h3><div><Flag verdict={check.verdict}/><span className="check-label">{money(check.cost)}</span></div><time className="check-date" dateTime={check.createdAt}>{date(check.createdAt)}</time></div></button></div>)}</div>:<div className="empty-state"><div className="empty-icon">{view==='history'?<History size={30}/>:<Globe2 size={30}/>}</div><h3>{query||status!=='all'?'No matching checks':view==='history'?'No checks yet':'No shared checks'}</h3><button className="primary-button" onClick={()=>navigate('new')}>New check<Plus size={16}/></button></div>}
    {view==='history'&&selected.length>0&&<div className="comparison-tray" role="region" aria-label="Comparison selection"><span><Columns2 size={17}/>{selected.length} of 4 selected</span><div><button className="text-button brown" onClick={()=>selection([])}>Clear</button><button className="primary-button" onClick={openComparison}>Compare selected<ArrowRight size={14}/></button></div></div>}
    {searching&&filtered.length>0&&<p className="search-status" role="status">Searching saved checks…</p>}
    {nextCursor&&<div className="load-more"><button className="secondary-button" disabled={loading||searching} onClick={loadMore}>{loading?<Loader2 className="spin" size={15}/>:<Plus size={15}/>}Load more</button></div>}
   </>}
   {view==='result'&&(loading?<div className="empty-state"><Loader2 className="spin"/><h3>Loading result…</h3></div>:result?<><a className="back-link" href="/app">← Workspace</a><div className="result-heading"><div><h1>{shareId?'Shared result':'Result'}</h1><p>{result.name}</p><span className="result-meta">{date(result.createdAt)} · {statusLabel(result.status)}</span></div><div className="result-actions">{owned&&<button className="secondary-button" onClick={()=>toggleComparison(result.id)}><Columns2 size={15}/>{selected.includes(result.id)?'Remove from comparison':'Add to comparison'}</button>}<button className="secondary-button" onClick={()=>saveReport([result])}><FileText size={15}/>Download report</button><button className="secondary-button" onClick={()=>saveJSON(result,'lensy-'+result.id+'.json')}><Download size={16}/>Export JSON</button>{owned&&<button className="primary-button" disabled={!result.canShare||busy||result.persistenceWarning} onClick={sharing}><Link2 size={16}/>{result.shared?'Manage sharing':'Share result'}</button>}</div></div>
    {result.status==='running'&&<div className="running-notice" role="status"><Loader2 className="spin" size={17}/><span>Check in progress. You can return to this URL without paying again.</span></div>}
    {result.warning&&<div className="alert" role="status"><Info size={17}/><span>{result.warning}</span></div>}
    <div className="result-grid"><div className="result-media"><Media check={result}/><span className="media-mode">TELEGRAPH CHECK</span></div><section className="verdict-card"><div className="card-heading"><h2>Verdict</h2><ShieldCheck size={20}/></div><h2 className="verdict-title">{result.verdict}</h2><p>{result.summary}</p><div className="confidence-line"><span>Confidence</span><strong>{result.confidence===null?'Not reported':Math.round(result.confidence*100)+'%'}</strong></div><div className="confidence-track"><div style={{width:result.confidence===null?'0%':result.confidence*100+'%'}}/></div><span className="subtle-note">Provider-reported assessment.</span><div className="verdict-cost"><span><ReceiptText size={16}/>Reported total</span><strong>{money(result.cost)}{result.cost!==null&&<small> USDC</small>}</strong></div>{result.cost===null&&result.knownCost&&<span className="subtle-note">Known charges: {money(result.knownCost)} USDC. Remaining charges unconfirmed.</span>}</section></div>
    {result.providers?.length?<section className="provider-panel"><h2>Requests</h2>{result.providers.map((p,i)=><div className="provider-row" key={p.intent}><span className={`provider-state state-${p.status}`}>{p.status==='pending'?<Loader2 className="spin" size={15}/>:p.status==='succeeded'?<CircleCheck size={15}/>:<Info size={15}/>}</span><div><strong>{label(p.intent)}</strong><span>{p.status==='pending'?'In progress':p.status==='unknown'?'Billing unconfirmed':p.status==='failed'?'Failed':'Response received'}</span></div><span>{money(p.cost)}</span>{p.response!==undefined&&<button className="text-button brown" onClick={()=>{setReceiptIndex(i);setModal('response');}}>Raw response<ArrowUpRight size={14}/></button>}</div>)}</section>:null}
    <div className="evidence-grid"><section className="evidence-card"><div className="card-heading"><h2><ScanLine size={18}/>Findings</h2></div><ul>{result.findings.length?result.findings.map((f,i)=><li key={i}><CircleCheck size={16}/>{f}</li>):<li><Info size={16}/>No structured findings returned.</li>}</ul>{result.caption&&<div className="caption-block"><h3>Image description</h3><p>{result.caption}</p></div>}</section><section className="evidence-card"><div className="card-heading"><h2><ReceiptText size={18}/>Payment receipts</h2><span className="optional">{result.receipts.length}</span></div>{result.receipts.length?result.receipts.map((r,i)=><button className="receipt-row" key={r.hash||i} onClick={()=>{setReceiptIndex(i);setModal('receipt');}}><ReceiptText size={19}/><div><strong>{label(r.intent)}</strong><span>{r.hash?.slice(0,18)}…</span></div><b>{money(r.amount)}</b><ArrowUpRight size={15}/></button>):<div className="no-receipt"><FileCheck2 size={24}/><p>No payment receipt returned.</p></div>}</section></div>
   </>:<div className="empty-state"><Search size={28}/><h3>Result unavailable</h3><p>Open your own check from My checks, or ask for a current share link.</p><a className="primary-button" href="/app">Workspace</a></div>)}
   <SiteFooter compact/>
  </main></div>
  {notice&&<div className="toast" role="status"><CircleCheck size={17}/>{notice}</div>}
  {modal&&<div className="modal-overlay" onClick={event=>{if(event.target===event.currentTarget&&!busy)setModal(null);}}><div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" ref={closeRef} disabled={busy} aria-label="Close dialog" onClick={()=>setModal(null)}><X size={20}/></button>
   {modal==='wallet'&&<><div className="modal-icon"><Wallet size={25}/></div><h2 id="modal-title">Wallet</h2>{wallet?<><p className="wallet-address">{wallet}</p><div className="wallet-info"><Info size={17}/><p>{chain==='0xaa36a7'?'Connected to Ethereum Sepolia.':'Switch your wallet to Ethereum Sepolia before approving a check.'}</p></div>{chain!=='0xaa36a7'&&<button className="primary-button full-width" onClick={()=>switchChain().catch(e=>setError(message(e)))}>Switch to Sepolia</button>}<button className="secondary-button full-width" onClick={()=>{sessionStorage.setItem('lensy.walletDisconnected','1');setWallet('');setModal(null);}}>Disconnect</button></>:<><p>Approve checks with your Ethereum wallet.</p><button className="primary-button full-width" onClick={connectWallet}><Wallet size={16}/>{'Connect Ethereum wallet'}</button></>}<a className="inline-link wallet-setup-link" href="https://anjoman.ai/docs/using/escrow-inference" target="_blank" rel="noreferrer">Fund Telegraph escrow<ArrowUpRight size={15}/></a>{error&&<p className="modal-error" role="alert">{error}</p>}</>}
   {modal==='help'&&<><div className="modal-icon"><CircleHelp size={25}/></div><h2 id="modal-title">Help</h2><div className="help-content"><h3>Media</h3><p>Use a public HTTPS image or video URL.</p><h3>Payment</h3><p>Fund your Telegraph escrow with Sepolia test USDC. Review the quote and sign each request.</p><h3>Interrupted check</h3><p>Open the saved check from My checks. The same quote cannot be purchased twice. Unconfirmed charges need review before a new purchase.</p><h3>Sharing</h3><p>Share completed results by link. Revoke sharing to disable the old link; sharing again creates a new one.</p></div><a className="inline-link" href="https://anjoman.ai/docs/using/escrow-inference" target="_blank" rel="noreferrer">Wallet setup<ArrowUpRight size={15}/></a></>}
   {modal==='share'&&result&&<><div className="modal-icon"><Link2 size={25}/></div><h2 id="modal-title">{owned?'Manage sharing':'Share result'}</h2>{owned&&<label className="feed-option"><input type="checkbox" checked={listed} onChange={e=>setListed(e.target.checked)}/><div><strong>Show in community feed</strong><span>Include the media and its saved result.</span></div></label>}{shareUrl&&<div className="share-link"><input readOnly aria-label="Shareable result link" value={shareUrl}/><button aria-label="Copy share link" onClick={()=>copy(shareUrl)}><Copy size={18}/></button></div>}{owned&&<><button className="primary-button full-width" disabled={busy} onClick={()=>share(true)}>{busy?<Loader2 className="spin" size={16}/>:<Link2 size={16}/>} {result.shared?'Save sharing settings':'Create share link'}</button>{result.shared&&<button className="secondary-button full-width revoke-button" disabled={busy} onClick={()=>share(false)}><LockKeyhole size={15}/>Revoke sharing</button>}</>}<p className="subtle-note">Site access settings still apply to the link.</p>{error&&<p className="modal-error" role="alert">{error}</p>}</>}
   {modal==='receipt'&&result&&<><div className="modal-icon"><ReceiptText size={25}/></div><h2 id="modal-title">Payment receipt</h2><pre className="receipt-json">{JSON.stringify(result.receipts[receiptIndex]?.raw,null,2)}</pre>{result.receipts[receiptIndex]?.url&&<a className="primary-button full-width" href={result.receipts[receiptIndex].url} target="_blank" rel="noreferrer">Open epoch proof<ExternalLink size={16}/></a>}<p className="subtle-note">Epoch proof may take about an hour on testnet.</p></>}
   {modal==='response'&&result&&<><div className="modal-icon"><ScanLine size={25}/></div><h2 id="modal-title">Provider response</h2><pre className="receipt-json">{JSON.stringify(result.providers?.[receiptIndex]?.response,null,2)}</pre><p className="subtle-note">Original response. Payment receipts are listed separately.</p></>}
  </div></div>}
 </div>;
}
