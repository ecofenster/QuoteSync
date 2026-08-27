import { useEffect, useState } from "react";
import { QUOTESYNC_TEXT_SIZES, readStoredQuoteSyncTextSize, saveQuoteSyncTextSize, type QuoteSyncTextSize } from "../theme/themes";

export default function TextSizeSelector(){
  const[selected,setSelected]=useState<QuoteSyncTextSize>(readStoredQuoteSyncTextSize);
  useEffect(()=>{const sync=(event:Event)=>setSelected((event as CustomEvent<{textSize:QuoteSyncTextSize}>).detail.textSize);window.addEventListener("quotesync-text-size-change",sync);return()=>window.removeEventListener("quotesync-text-size-change",sync)},[]);
  const current=QUOTESYNC_TEXT_SIZES.find(option=>option.id===selected)??QUOTESYNC_TEXT_SIZES[1];
  return <details className="app-shell__display-menu"><summary className="app-shell__display-summary ui-button" aria-label={`Display settings. Text size ${current.name}`}><span>Display</span><strong>{current.name}</strong></summary><div className="app-shell__display-panel ui-card"><div><strong>Application text size</strong><small>Applies across QuoteSuite on this device.</small></div><div className="app-shell__text-size-options" role="radiogroup" aria-label="Application text size">{QUOTESYNC_TEXT_SIZES.map(option=><button key={option.id} type="button" role="radio" aria-checked={selected===option.id} className="ui-button ui-button--ghost" onClick={()=>{setSelected(option.id);saveQuoteSyncTextSize(option.id)}}><span>{option.name}</span><small>{option.description}</small></button>)}</div></div></details>;
}
