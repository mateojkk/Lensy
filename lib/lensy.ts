export type Receipt = { intent: string; amount: string | null; hash?: string; epoch?: number; url?: string; raw?: unknown };
export type ProviderResult = {
  intent:string; status:'pending'|'succeeded'|'failed'|'unknown'; cost:string|null;
  response?:unknown; receipt?:Receipt; error?:string; warning?:string; completedAt?:string;
  channel?:'anjoman'; jobId?:string;
};
export type QuoteItem = { intent:string; amount:string; requestBody?:unknown; escrow:{scheme:string;network:string;payTo:string;extra:{message:string}} };
export type QuoteResponse = { id:string; quotes:QuoteItem[]; total:string; expiresAt:string };
export type Check = {
  id: string; name: string; media: string; mediaType: string; mode: string; createdAt: string;
  verdict: string; confidence: number | null; summary: string; findings: string[];
  receipts: Receipt[]; cost: string | null; status: string; shared?: boolean; listed?: boolean; caption?: string; warning?: string;
  knownCost?:string; providers?:ProviderResult[]; startedAt?:string; updatedAt?:string;
  shareUrl?:string|null; viewerIsOwner?:boolean; canShare?:boolean; persistenceWarning?:boolean;
  paymentSource?:'lensy'|'wallet';
};
export { formatMoney as money } from './money';
