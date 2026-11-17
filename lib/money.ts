// USDC amounts are integers in millionths. Never add money as binary floats.
export function toMicros(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const match=String(value).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if(!match || String(value).length>80) return null;
  const exponent=Number(match[3]||0);if(Math.abs(exponent)>30)return null;
  const fraction=match[2]||'';let digits=match[1]+fraction;
  const shift=6+exponent-fraction.length;
  if(shift<0){const removed=digits.slice(shift);if(/[1-9]/.test(removed))return null;digits=digits.slice(0,shift)||'0';}
  else digits+='0'.repeat(shift);
  return BigInt(digits);
}
export function fromMicros(value: bigint | string): string {
  const n=BigInt(value);if(n<0n)throw new Error('Negative USDC amount');
  return `${n/1000000n}.${String(n%1000000n).padStart(6,'0')}`;
}
export function totalCosts(values:Array<string|null|undefined>):{cost:string|null;knownCost:string} {
  let sum=0n,complete=true;
  for(const value of values){const n=toMicros(value);if(n===null)complete=false;else sum+=n;}
  const knownCost=fromMicros(sum);return {cost:complete?knownCost:null,knownCost};
}
export function formatMoney(value: string | null | undefined): string {
  const n=toMicros(value);return n===null?'Not reported':'$'+fromMicros(n);
}
