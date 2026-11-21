import document from './data/sample-contract.json';
import sampleReport from './data/findings.json';
export { document, sampleReport };
export type Finding={id:string;severity:string;category:string;title:string;explanation:string;confidence:number;suggestedEdit:string|null;anchor:{paragraphId:string;start:number;end:number;quote:string;endParagraphId?:string}|null};
export type Report={documentId:string;agent:{name:string;version:string};generatedAt:string;findings:Finding[]};
export const REPORT_KEY=`clause:analysis:v1:${document.id}`;
export function validateReport(data:unknown):Report {
 const r=data as Report;
 if(!r||r.documentId!==document.id||typeof r.agent?.name!=='string'||typeof r.agent?.version!=='string'||typeof r.generatedAt!=='string'||!Array.isArray(r.findings)||!r.findings.length||r.findings.length>40)throw Error('Invalid analysis');
 const ids=new Set<string>();
 for(const f of r.findings){
  if(!f||typeof f.id!=='string'||ids.has(f.id)||!['high','medium','low'].includes(f.severity)||![f.category,f.title,f.explanation].every(v=>typeof v==='string'&&v.length>0&&v.length<=6000)||!Number.isFinite(f.confidence)||f.confidence<0||f.confidence>1||!(f.suggestedEdit===null||typeof f.suggestedEdit==='string'&&f.suggestedEdit.length<=10000))throw Error('Invalid analysis finding');
  if(f.anchor!==null&&(!f.anchor||typeof f.anchor.paragraphId!=='string'||typeof f.anchor.quote!=='string'||!Number.isInteger(f.anchor.start)||!Number.isInteger(f.anchor.end)))throw Error('Invalid analysis reference');
  ids.add(f.id);
 }
 return r;
}
export let report:Report=sampleReport;
try{if(typeof localStorage!=='undefined'){const raw=localStorage.getItem(REPORT_KEY);if(raw)report=validateReport(JSON.parse(raw))}}catch{/* Retain bundled findings if a saved analysis is invalid. */}

export type Decision = 'open' | 'accepted' | 'dismissed';
export type Review = Record<string, {status: Decision; note: string}>;
export const paragraphs = document.sections.flatMap<{id:string;number:string|null;text:string}>(s => s.paragraphs);
export type Span = {paragraphId: string; start: number; end: number};
export type Resolution = {kind: 'exact' | 'recovered' | 'unresolved' | 'document'; spans: Span[]};
// Offsets are advisory: a quote must agree before we claim an exact location.
export function resolveAnchor(f: Finding): Resolution {
 const a = f.anchor;
 if (!a) return {kind:'document',spans:[]};
 const first = paragraphs.findIndex(p=>p.id===a.paragraphId);
 const last = paragraphs.findIndex(p=>p.id===(a.endParagraphId || a.paragraphId));
 if(first<0 || last<first) return {kind:'unresolved',spans:[]};
 const selected = paragraphs.slice(first,last+1);
 const spans = selected.map((p,i)=>({paragraphId:p.id,start:i===0?a.start:0,end:i===selected.length-1?a.end:p.text.length}));
 const valid = spans.every(s=>s.start>=0 && s.end>s.start && s.end<=paragraphs.find(p=>p.id===s.paragraphId)!.text.length);
 const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
 if(valid && normalize(spans.map(s=>paragraphs.find(p=>p.id===s.paragraphId)!.text.slice(s.start,s.end)).join(' '))===normalize(a.quote)) return {kind:'exact',spans};
 // Search only the referenced paragraph range. Never silently attach to similar text elsewhere.
 const joined=selected.map(p=>p.text).join(' ');
 const offset=joined.indexOf(a.quote);
 if(offset>=0 && joined.indexOf(a.quote,offset+1)<0){
 let cursor=0; const recovered:Span[]=[];
 for(const p of selected){const start=Math.max(0,offset-cursor),end=Math.min(p.text.length,offset+a.quote.length-cursor);if(end>start)recovered.push({paragraphId:p.id,start,end});cursor+=p.text.length+1;}
 return {kind:'recovered',spans:recovered};
 }
 return {kind:'unresolved',spans:[]};
}
export const resolutions = Object.fromEntries(report.findings.map(f=>[f.id,resolveAnchor(f)]));
export const STORAGE_KEY=`clause:v1:${document.id}`;
export function parseReview(raw: string | null): Review {
 if(!raw)return {};const data:unknown=JSON.parse(raw);
 if(!data || typeof data!=='object' || Array.isArray(data))throw Error('Invalid saved review');
 const result:Review={};
 for(const f of report.findings){const v=(data as Record<string,unknown>)[f.id];if(v && typeof v==='object' && 'status' in v && 'note' in v && ['open','accepted','dismissed'].includes(String(v.status)) && typeof v.note==='string')result[f.id]={status:v.status as Decision,note:v.note.slice(0,10000)};}
 return result;
}
export function segments(text: string, ranges: (Span & {id: string})[]) {
 const points=[...new Set([0,text.length,...ranges.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
 return points.slice(0,-1).map((start,i)=>({text:text.slice(start,points[i+1]),ids:ranges.filter(r=>r.start<points[i+1]&&r.end>start).map(r=>r.id)}));
}

export const EDITS_KEY = `clause:edits:v1:${document.id}`;
export function editConflict(id: string, applied: string[]): string | null {
 const f = report.findings.find(f=>f.id===id);
 if (!f?.suggestedEdit || !resolutions[id]?.spans.length) return 'The exact passage could not be verified. This suggestion needs manual editing.';
 for (const other of applied.filter(other=>other!==id)) {
  if (resolutions[other]?.spans.some(a=>resolutions[id].spans.some(b=>a.paragraphId===b.paragraphId && a.start<b.end && b.start<a.end)))
   return `This passage overlaps ${other.toUpperCase()}. Undo that edit before applying this one.`;
 }
 return null;
}
export function parseEdits(raw: string | null): string[] {
 const data: unknown = JSON.parse(raw || '[]');
 if (!Array.isArray(data)) return [];
 const applied:string[]=[];
 for(const id of data) if(typeof id==='string' && !applied.includes(id) && !editConflict(id,applied)) applied.push(id);
 return applied;
}
// Render against immutable source coordinates: edits never invalidate other anchors.
export function revisedParts(paragraphId: string, applied: string[]) {
 const p=paragraphs.find(p=>p.id===paragraphId)!;
 const edits=applied.flatMap(id=>(resolutions[id]?.spans||[]).filter(s=>s.paragraphId===paragraphId).map(s=>({...s,id})) ).sort((a,b)=>a.start-b.start);
 const parts:{text:string;editId?:string}[]=[];let cursor=0;
 for(const edit of edits){
  parts.push({text:p.text.slice(cursor,edit.start)});
  const first=resolutions[edit.id].spans[0];
  parts.push({text:first.paragraphId===paragraphId?report.findings.find(f=>f.id===edit.id)!.suggestedEdit!:'',editId:edit.id});
  cursor=edit.end;
 }
 parts.push({text:p.text.slice(cursor)});
 return parts;
}
export function revisedDocument(applied:string[]) {
 return {...document,sections:document.sections.map(s=>({...s,paragraphs:s.paragraphs.map(p=>({...p,text:revisedParts(p.id,applied).map(part=>part.text).join('')}))}))};
}

export function installReport(data:unknown){
 const next=validateReport(data);
 report=next;
 for(const key of Object.keys(resolutions))delete resolutions[key];
 Object.assign(resolutions,Object.fromEntries(report.findings.map(f=>[f.id,resolveAnchor(f)])));
}

