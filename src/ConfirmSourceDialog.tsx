import {useEffect,useRef} from 'react';
export function ConfirmSourceDialog({target,onCancel,onConfirm}:{target:'sample'|'gemini';onCancel:()=>void;onConfirm:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const sample=target==='sample';
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close()},[]);
 return <dialog ref={ref} className="source-dialog" aria-labelledby="source-dialog-title" aria-describedby="source-dialog-description" onCancel={event=>{event.preventDefault();onCancel()}}>
  <h2 id="source-dialog-title">{sample?'Switch to assessment sample?':'Analyze with Gemini?'}</h2>
  <p id="source-dialog-description">{sample?'Return to the 24 original assessment findings? This clears the current findings, decisions, comments, and applied edits.':'Send the original agreement to Google Gemini to generate fresh findings? After successful analysis, these replace your current findings, decisions, comments, and applied edits.'}</p>
  <p className="dialog-hint">Export your review first if you want to keep it.</p>
  <div className="dialog-actions"><button autoFocus onClick={onCancel}>Cancel</button><button className="dialog-confirm" onClick={onConfirm}>{sample?'Use assessment sample':'Analyze with Gemini'}</button></div>
 </dialog>
}
