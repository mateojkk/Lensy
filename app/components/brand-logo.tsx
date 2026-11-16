import { ScanLine } from 'lucide-react';

export default function BrandLogo({className=''}:{className?:string}) {
  return <a href="/" className={`landing-logo ${className}`.trim()} aria-label="Lensy home"><ScanLine size={27} strokeWidth={1.4}/>lensy<span>.</span></a>;
}
