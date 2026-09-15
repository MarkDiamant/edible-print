'use client';

import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function AdminOrdersTable({orders}){
  const router=useRouter();
  const eligible=useMemo(()=>orders.filter(o=>o.payment_status==='paid'&&o.shipping_method!=='collection'&&o.fulfilment_status!=='fulfilled'),[orders]);
  const [selected,setSelected]=useState([]);
  const [busy,setBusy]=useState(false);
  const allSelected=eligible.length>0&&eligible.every(o=>selected.includes(o.id));

  function toggle(id){setSelected(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id])}
  function toggleAll(){setSelected(allSelected?[]:eligible.map(o=>o.id))}
  async function preparePostage(){
    if(!selected.length||busy)return;
    setBusy(true);
    try{
      const payload={orders:selected.map(id=>{const order=orders.find(o=>o.id===id);return {id,postage_service:order?.shipping_method==='express'?'express':'standard'}})};
      const response=await fetch('/api/admin/orders/bulk-royal-mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Could not prepare postage');
      if(result.clickDropUrl)window.location.href=result.clickDropUrl;
      else router.refresh();
    }catch(e){alert(e.message||'Could not prepare postage');setBusy(false)}
  }

  return <div className="admin-orders-modern">
    {eligible.length>0&&<div className="admin-bulk-card">
      <div><strong>Postage</strong><span>Select the orders to send. Standard or Express is taken automatically from what the customer chose at checkout.</span></div>
      <div className="admin-bulk-actions"><button type="button" className="admin-secondary" onClick={toggleAll}>{allSelected?'Clear all':'Select all postage'}</button><button type="button" className="admin-primary" disabled={!selected.length||busy} onClick={preparePostage}>{busy?'Preparing…':selected.length?`Prepare ${selected.length} for postage`:'Prepare postage'}</button></div>
    </div>}
    <div className="admin-table-wrap modern-wrap"><table className="admin-table modern-table"><thead><tr><th className="check-col"><input aria-label="Select all eligible postage" type="checkbox" checked={allSelected} onChange={toggleAll}/></th><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Fulfilment</th><th>Customer postage</th></tr></thead><tbody>{orders.map(o=>{
      const href=`/admin/orders/${o.id}`;
      const isEligible=o.payment_status==='paid'&&o.shipping_method!=='collection'&&o.fulfilment_status!=='fulfilled';
      const status=o.fulfilment_status==='fulfilled'?(o.shipping_method==='collection'?'Collected':'Dispatched'):o.fulfilment_status==='ready'?(o.shipping_method==='collection'?'Ready for collection':'Ready'):o.fulfilment_status==='processing'?'Processing':'Order received';
      const postageLabel=o.shipping_method==='collection'?'Collection':o.shipping_method==='express'?'Express':'Standard';
      return <tr key={o.id} className="modern-row" onClick={e=>{if(e.target.closest('input,button,a,label'))return;router.push(href)}}>
        <td className="check-col" onClick={e=>e.stopPropagation()}>{isEligible?<input aria-label={`Select order ${o.display_order_number}`} type="checkbox" checked={selected.includes(o.id)} onChange={()=>toggle(o.id)}/>:<span className="admin-check-placeholder">—</span>}</td>
        <td><strong className="order-link">#{o.display_order_number}</strong><div className="mobile-order-date">{new Date(o.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div></td>
        <td>{new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
        <td><strong>{o.first_name} {o.last_name}</strong><br/><small>{o.email}</small></td>
        <td><strong>£{(o.total_pence/100).toFixed(2)}</strong></td>
        <td><span className={`admin-pill ${o.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{status}</span></td>
        <td><span className={`delivery-chip ${o.shipping_method==='express'?'express':''}`}><strong>{postageLabel}</strong>{o.shipping_method!=='collection'&&<small> customer selected</small>}</span></td>
      </tr>})}</tbody></table></div>
    <style jsx>{`
      .admin-orders-modern{display:grid;gap:14px}.admin-bulk-card{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px;border:1px solid #e1e4df;border-radius:14px;background:linear-gradient(180deg,#fff,#f8faf7);box-shadow:0 3px 16px rgba(35,50,35,.05)}.admin-bulk-card>div:first-child{display:grid;gap:3px}.admin-bulk-card strong{font-size:16px}.admin-bulk-card span{font-size:13px;color:#687068}.admin-bulk-actions{display:flex;gap:8px;flex-wrap:wrap}.admin-primary,.admin-secondary{border-radius:9px;padding:9px 13px;font-weight:600;cursor:pointer;border:1px solid #cfd5cd}.admin-primary{background:#263126;color:white;border-color:#263126}.admin-primary:disabled{opacity:.45;cursor:not-allowed}.admin-secondary{background:white;color:#303630}.modern-wrap{border:1px solid #e2e5df;border-radius:14px;overflow:auto;background:white;box-shadow:0 7px 24px rgba(33,44,33,.05)}.modern-table{border-collapse:separate;border-spacing:0;width:100%;min-width:880px}.modern-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#717771;background:#f7f8f6;padding:12px 14px;border-bottom:1px solid #e6e8e3;text-align:left;position:sticky;top:0}.modern-table td{padding:14px;border-bottom:1px solid #eceee9;vertical-align:middle}.modern-row{cursor:pointer;transition:background .14s ease}.modern-row:hover{background:#fafbf9}.modern-row:last-child td{border-bottom:0}.check-col{width:42px;text-align:center!important}.check-col input{width:17px;height:17px;accent-color:#6f8768;cursor:pointer}.admin-check-placeholder{color:#bcc1bb}.order-link{font-size:15px}.mobile-order-date{display:none;font-size:12px;color:#777}.delivery-chip{display:inline-grid;gap:1px;border:1px solid #e0e3dd;border-radius:10px;padding:6px 9px;background:#f8f9f7;font-size:13px}.delivery-chip.express{background:#fff7e6;border-color:#ead6a4}.delivery-chip small{font-size:11px;color:#777}.modern-table small{color:#777}.admin-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:600;white-space:nowrap}.admin-pill.open{background:#fff4cf;color:#6e5711}.admin-pill.fulfilled{background:#e9f5e8;color:#315f35}@media(max-width:760px){.admin-bulk-card{align-items:stretch;flex-direction:column}.admin-bulk-actions>*{flex:1}.modern-wrap{border-radius:12px}.modern-table{min-width:740px}.modern-table th,.modern-table td{padding:11px}.mobile-order-date{display:block}}
    `}</style>
  </div>;
}
