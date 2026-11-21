import {describe,it,expect} from 'vitest';
import {report,paragraphs,resolveAnchor,segments,parseReview,type Finding, editConflict, revisedDocument, parseEdits} from './model';
const base=report.findings[0];
describe('anchor safety',()=>{
 it('handles document-wide findings',()=>expect(resolveAnchor(report.findings[8]).kind).toBe('document'));
 it('recovers drifted offsets using an exact quote',()=>{const p=paragraphs[0];const f={...base,anchor:{paragraphId:p.id,start:1,end:2,quote:p.text.slice(15,70)}} as Finding;expect(resolveAnchor(f)).toEqual({kind:'recovered',spans:[{paragraphId:p.id,start:15,end:70}]})});
 it('does not guess unmatched text',()=>expect(resolveAnchor({...base,anchor:{...base.anchor!,quote:'not in this agreement'}} as Finding).kind).toBe('unresolved'));
 it('validates every returned span against its paragraph',()=>{for(const f of report.findings)for(const s of resolveAnchor(f).spans){const p=paragraphs.find(p=>p.id===s.paragraphId)!;expect(s.start).toBeGreaterThanOrEqual(0);expect(s.end).toBeLessThanOrEqual(p.text.length);expect(s.end).toBeGreaterThan(s.start)}});
 it('splits overlaps without duplicating or losing text',()=>{const parts=segments('abcdefgh',[{paragraphId:'p',start:1,end:5,id:'a'},{paragraphId:'p',start:3,end:7,id:'b'}]);expect(parts.map(p=>p.text).join('')).toBe('abcdefgh');expect(parts.find(p=>p.text==='de')?.ids).toEqual(['a','b'])});
 it('handles spans across paragraphs',()=>{const p=paragraphs.slice(0,2);const f={...base,anchor:{paragraphId:p[0].id,endParagraphId:p[1].id,start:p[0].text.length-10,end:10,quote:p[0].text.slice(-10)+' '+p[1].text.slice(0,10)}} as Finding;expect(resolveAnchor(f).spans).toHaveLength(2)});
});
describe('saved reviews',()=>{
 it('ignores unknown findings and invalid decisions',()=>expect(parseReview('{"f-01":{"status":"bad","note":"x"},"unknown":{"status":"accepted","note":"x"}}')).toEqual({}));
 it('restores valid decisions and notes',()=>expect(parseReview('{"f-01":{"status":"accepted","note":"Review with counsel"}}')['f-01'].status).toBe('accepted'));
});

describe('suggested edits',()=>{
 it('changes the working document and preserves source text',()=>{const f=report.findings.find(f=>f.id==='f-01')!;const output=revisedDocument([f.id]);const revised=output.sections.flatMap(s=>s.paragraphs as {id:string;text:string}[]).find(p=>p.id===f.anchor!.paragraphId)!;expect(revised.text).toContain(f.suggestedEdit);expect(paragraphs.find(p=>p.id===f.anchor!.paragraphId)!.text).toContain(f.anchor!.quote);expect(revisedDocument([])).toEqual(revisedDocument([]));});
 it('blocks overlapping replacements and unsafe anchors',()=>{expect(editConflict('f-05',['f-04'])).toContain('overlaps');expect(editConflict('f-09',[])).toBeTruthy();});
 it('restores only safe unique edits',()=>{expect(parseEdits('["unknown","f-01","f-01"]')).toEqual(['f-01']);});
});
