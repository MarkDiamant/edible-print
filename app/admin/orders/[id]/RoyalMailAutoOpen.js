'use client';

import {useState} from 'react';

export default function RoyalMailAutoOpen({action,postageService,sheetCount}){
  const [service,setService]=useState(postageService);
  function submitted(){setTimeout(()=>window.location.reload(),1800)}
  return <form action={action} method="post" target="royalMailPay" onSubmit={submitted} style={{display:'flex',justifyContent:'flex-end',alignItems:'end',gap:12,flexWrap:'wrap'}}>
    <label style={{display:'grid',gap:5,fontSize:13,fontWeight:700}}>Royal Mail service
      <select name="postage_service" value={service} onChange={e=>setService(e.target.value)} style={{minWidth:220,padding:'11px 12px',border:'2px solid #aaa',borderRadius:9,background:'#fff',fontSize:15,fontWeight:700}}>
        <option value="standard">Tracked 48 Large Letter</option>
        <option value="express">Tracked 24 Large Letter</option>
      </select>
    </label>
    <input type="hidden" name="sheet_count" value={String(sheetCount)}/>
    <button className="btn" type="submit" style={{minWidth:220}}>Confirm & pay postage</button>
  </form>;
}
