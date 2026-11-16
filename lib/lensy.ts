export type Receipt = { intent: string; amount: string; hash?: string; epoch?: number; url?: string; raw?: unknown };
export type Check = {
  id: string; name: string; media: string; mediaType: string; mode: string; createdAt: string;
  verdict: string; confidence: number | null; summary: string; findings: string[];
  receipts: Receipt[]; cost: string; status: string; shared?: boolean; listed?: boolean; caption?: string; warning?: string;
};
export function money(value: string) { return "$" + Number(value).toFixed(6); }
