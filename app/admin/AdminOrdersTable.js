'use client';

import {useRouter} from 'next/navigation';

export default function AdminOrdersTable({orders}){
  const router=useRouter();
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Delivery</th></tr></thead><tbody>{orders.map(o=>{
    const href=`/admin/orders/${o.id}`;
    const status=o.fulfilment_status==='fulfilled'?(o.shipping_method==='collection'?'Collected':'Dispatched'):o.fulfilment_status==='ready'?(o.shipping_method==='collection'?'Ready for collection':'Ready'):o.fulfilment_status==='processing'?'Processing':'Order received';
    return <tr key={o.id} tabIndex={0} role="link" aria-label={`Open order ${o.display_order_number}`} onClick={()=>router.push(href)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();router.push(href)}}} style={{cursor:'pointer'}}>
      <td><strong>#{o.display_order_number}</strong></td>
      <td>{new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td><strong>{o.first_name} {o.last_name}</strong><br/><small>{o.email}</small></td>
      <td><strong>£{(o.total_pence/100).toFixed(2)}</strong></td>
      <td><span className={`admin-pill ${o.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{status}</span></td>
      <td style={{textTransform:'capitalize'}}>{o.shipping_method}</td>
    </tr>})}</tbody></table></div>;
}
