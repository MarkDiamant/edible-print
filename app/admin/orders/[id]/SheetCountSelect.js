'use client';
import {useRouter,useSearchParams} from 'next/navigation';
export default function SheetCountSelect({value}){
 const router=useRouter(),searchParams=useSearchParams();
 function change(e){const p=new URLSearchParams(searchParams.toString());p.set('sheets',e.target.value);router.replace('?'+p.toString(),{scroll:false});router.refresh()}
 return <select value={String(value)} onChange={change} style={{minWidth:220,padding:'13px 14px',border:'2px solid #aaa',borderRadius:9,background:'#fff',fontSize:18,fontWeight:800}}>{Array.from({length:23},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?'sheet':'sheets'} · {83+(n-1)*30}g</option>)}</select>
}