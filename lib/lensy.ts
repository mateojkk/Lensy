export type Receipt = { intent: string; amount: string; hash?: string; epoch?: number; url?: string; raw?: unknown };
export type Check = {
  id: string; name: string; media: string; mediaType: string; mode: string; createdAt: string;
  verdict: string; confidence: number | null; summary: string; findings: string[];
  receipts: Receipt[]; cost: string; status: string; shared?: boolean; listed?: boolean; caption?: string; warning?: string;
};
export const samples = [
  { id: "sample-coast", name: "A moment on the coast", tag: "Landscape", image: "/images/coast.jpg", verdict: "Likely authentic", confidence: 0.96, summary: "This example shows how a result with no strong manipulation signals would appear.", findings: ["Example: consistent natural lighting", "Example: coherent textures and fine detail", "Example: no obvious splicing artifacts"] },
  { id: "sample-portrait", name: "More than meets the eye", tag: "Portrait", image: "/images/portrait.jpg", verdict: "Likely manipulated", confidence: 0.91, summary: "This example illustrates a flagged verdict. The photo is illustrative and has not been analyzed.", findings: ["Example: unusual texture transitions", "Example: inconsistent edge detail", "Example: further source checks recommended"] },
  { id: "sample-city", name: "The city after hours", tag: "Architecture", image: "/images/city.jpg", verdict: "Inconclusive", confidence: null, summary: "This example shows an uncertain result. Compression or limited evidence can prevent a reliable verdict.", findings: ["Example: insufficient provenance", "Example: compression obscures fine detail", "Example: original media recommended"] },
];
export function sampleCheck(id: string): Check | null {
  const s = samples.find(s => s.id === id); if (!s) return null;
  return { ...s, media: s.image, mediaType: "image/jpeg", mode: "demo", createdAt: "", status: "complete", cost: "0.000000", receipts: [], shared: true };
}
export function money(value: string) { return "$" + Number(value).toFixed(6); }
