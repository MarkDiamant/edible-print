import {cookies} from 'next/headers';
import {isAdminValue} from '../../lib/adminAuth';
import {getSupabaseAdmin} from '../../lib/supabaseAdmin';

export const dynamic='force-dynamic';

export default async function Admin({searchParams}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value)){
    const params=await searchParams;
    return <main style={{maxWidth:480,margin:'60px auto',padding:24}}><h1>Edible Print admin</h1>{params?.error&&<p style={{color:'crimson'}}>Incorrect password.</p>}<form action="/api/admin/login" method="post"><label>Password<br/><input name="password" type="password" required style={{width:'100%',padding:12,margin:'8px 0 16px'}}/></label><button className="btn" type="submit">Log in</button></form></main>;
  }
  let orders=[];
  let configError='';
  try{
    const db=getSupabaseAdmin();
    const {data,error}=await db.from('admin_order_summary').select('*').order('created_at',{ascending:false}).limit(100);
    if(error)throw error;
    orders=data||[];
  }catch(e){configError=e.message||'Admin database connection is not configured.'}
  const paid=orders.filter(o=>o.payment_status==='paid').length,open=orders.filter(o=>o.fulfilment_status!=='fulfilled').length,total=orders.reduce((s,o)=>s+(o.total_pence||0),0);return <main className="admin-shell"><header className="admin-top"><div><h1>Edible Print</h1><p>Orders</p></div><a href="/" className="admin-store-link">View shop</a></header><section className="admin-stats"><div><span>Orders</span><strong>{orders.length}</strong></div><div><span>Paid</span><strong>{paid}</strong></div><div><span>To fulfil</span><strong>{open}</strong></div><div><span>Sales</span><strong>£{(total/100).toFixed(2)}</strong></div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Orders</h2><span>{orders.length} orders</span></div>{configError?<p>{configError}</p>:!orders.length?<p>No paid orders yet.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Artwork</th><th>Delivery</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><a className="admin-order-link" href={`/admin/orders/${o.id}`}>#{o.order_number}</a></td><td>{new Date(o.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td><strong>{o.first_name} {o.last_name}</strong><br/><small>{o.email}</small></td><td>£{(o.total_pence/100).toFixed(2)}</td><td><span className="admin-pill paid">{o.payment_status}</span></td><td><span className={`admin-pill ${o.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{o.fulfilment_status}</span></td><td>{o.artwork_count||0}</td><td>{o.shipping_method}</td></tr>)}</tbody></table></div>}</section></main>;
}
const th={textAlign:'left',padding:'10px 8px',borderBottom:'2px solid #ddd'};
const td={padding:'12px 8px',borderBottom:'1px solid #eee',verticalAlign:'top'};
