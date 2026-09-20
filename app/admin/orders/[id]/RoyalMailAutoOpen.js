'use client';

export default function RoyalMailAutoOpen({action,postageService,sheetCount}){
  function submitted(){
    setTimeout(()=>window.location.reload(),1800);
  }
  return <form action={action} method="post" target="royalMailPay" onSubmit={submitted} style={{display:'flex',justifyContent:'flex-end',alignItems:'end',gap:12,flexWrap:'wrap'}}>
    <input type="hidden" name="postage_service" value={postageService}/>
    <input type="hidden" name="sheet_count" value={String(sheetCount)}/>
    <button className="btn" type="submit" style={{minWidth:220}}>Confirm & pay postage</button>
  </form>;
}
