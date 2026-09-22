'use client';
import {useMemo,useState} from 'react';

const DAY=86400000;
const money=p=>'£'+(p/100).toFixed(2);
const dayKey=d=>{const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toISOString().slice(0,10)};
function Spark({values}){
 const max=Math.max(1,...values),w=150,h=34;
 const pts=values.map((v,i)=>`${values.length===1?w/2:(i/(values.length-1))*w},${h-3-(v/max)*(h-7)}`).join(' ');
 return <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sales trend" style={{width:150,height:34,overflow:'visible'}}><line x1="0" y1={h-3} x2={w} y2={h-3} stroke="#d8ded7"/><polyline points={pts} fill="none" stroke="#71916c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
export default function AdminSalesOverview({orders=[]}){
 const [range,setRange]=useState('daily');
 const data=useMemo(()=>{
  const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const paid=(orders||[]).map(o=>({...o,t:new Date(o.date).getTime()})).filter(o=>Number.isFinite(o.t));
  const build=(days)=>Array.from({length:days},(_,i)=>{const t=today-(days-1-i)*DAY,k=new Date(t).toISOString().slice(0,10),rows=paid.filter(o=>dayKey(o.date)===k);return {k,count:rows.length,sales:rows.reduce((s,o)=>s+o.total_pence,0)}})
  return {today:build(1),week:build(7),month:build(30)};
 },[orders]);
 const sets={daily:data.today,weekly:data.week,monthly:data.month};
 const selected=sets[range],sales=selected.reduce((s,x)=>s+x.sales,0),count=selected.reduce((s,x)=>s+x.count,0);
 const values=selected.map(x=>x.sales);
 return <section style={{margin:'0 0 22px',background:'#fff',border:'1px solid #e2e5e1',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 10px rgba(35,45,34,.04)'}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'16px 18px 10px',flexWrap:'wrap'}}>
    <div><strong style={{fontSize:17}}>Sales flow</strong><div style={{fontSize:13,color:'#737873',marginTop:3}}>Paid orders by day</div></div>
    <div style={{display:'flex',gap:6,background:'#f2f4f1',padding:4,borderRadius:10}}>
     {['daily','weekly','monthly'].map(x=><button key={x} onClick={()=>setRange(x)} style={{border:0,borderRadius:7,padding:'7px 12px',cursor:'pointer',background:range===x?'#fff':'transparent',fontWeight:range===x?700:500,boxShadow:range===x?'0 1px 4px rgba(0,0,0,.08)':'none',textTransform:'capitalize'}}>{x}</button>)}
    </div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',borderTop:'1px solid #eceeeb'}}>
    <div style={{padding:'16px 18px',borderRight:'1px solid #eceeeb'}}><span style={{fontSize:13,color:'#6c716b'}}>Period sales</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{money(sales)}</strong></div>
    <div style={{padding:'16px 18px',borderRight:'1px solid #eceeeb'}}><span style={{fontSize:13,color:'#6c716b'}}>Orders</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{count}</strong></div>
    <div style={{padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><span style={{fontSize:13,color:'#6c716b'}}>Trend</span><strong style={{display:'block',fontSize:14,marginTop:4}}>{range==='daily'?'Today':range==='weekly'?'Last 7 days':'Last 30 days'}</strong></div><Spark values={values}/></div>
   </div>
  </section>
}