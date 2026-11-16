import { ArrowUpRight } from 'lucide-react';
import BrandLogo from './brand-logo';
export default function SiteFooter({compact=false}:{compact?:boolean}) {
 return <footer className={`site-footer ${compact?'is-compact':''}`}>
  {!compact&&<div className="footer-main"><div className="footer-about"><BrandLogo/><p>A little more clarity.<br/>A little less guesswork.</p></div><div className="footer-column"><h3>EXPLORE</h3><a href="/#product">The product</a><a href="/#how-it-works">How it works</a><a href="/app">Open the workspace<ArrowUpRight size={13}/></a></div><div className="footer-column"><h3>BUILDING IN THE OPEN</h3><a href="https://github.com/mateojkk/Lensy" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={13}/></a><a href="https://anjoman.ai/docs/introduction" target="_blank" rel="noreferrer">Telegraph protocol<ArrowUpRight size={13}/></a><a href="https://github.com/mateojkk/Lensy/blob/main/docs/mission-07.md" target="_blank" rel="noreferrer">The mission<ArrowUpRight size={13}/></a></div></div>}
  <div className="footer-bottom"><span>© {new Date().getFullYear()} Lensy</span>{compact&&<nav aria-label="Footer navigation"><a href="/">Home</a><a href="https://github.com/mateojkk/Lensy" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={11}/></a><a href="https://anjoman.ai/docs/using/escrow-inference" target="_blank" rel="noreferrer">Telegraph docs<ArrowUpRight size={11}/></a></nav>}<span className="footer-network"><span/>Telegraph testnet · Ethereum Sepolia</span></div>
 </footer>;
}
