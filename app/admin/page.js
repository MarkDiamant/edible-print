import {cookies} from 'next/headers';
import {isAdminValue} from '../../lib/adminAuth';
import {getSupabaseAdmin} from '../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../lib/orderNumber';
import AdminLogin from './AdminLogin';
import AdminOrdersTable from './AdminOrdersTable';

export const dynamic='force-dynamic';

export default async function Admin({searchParams}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value)){
    const params=await searchParams;
    return <AdminLogin passwordError={Boolean(params?.error)} linkInvalid={params?.link==='invalid'}/>;
  }
  let orders=[];
  let configError='';
  try{
    const db=getSupabaseAdmin();
    const {data,error}=await db.from('admin_order_summary').select('*').order('created_at',{ascending:false}).limit(100);
    if(error)throw error;
    orders=(data||[]).map(o=>({...o,display_order_number:formatOrderNumber(o.order_number)}));
  }catch(e){configError=e.message||'Admin database connection is not configured.'}
  const paid=orders.filter(o=>o.payment_status==='paid').length,open=orders.filter(o=>o.fulfilment_status!=='fulfilled').length,total=orders.reduce((s,o)=>s+(o.total_pence||0),0);
  return <main className="admin-shell"><header className="admin-top"><div><h1>Edible Print</h1><p>Orders</p></div><div className="admin-top-actions"><a href="/" className="admin-store-link">View shop</a><form action="/api/admin/logout" method="post"><button className="admin-store-link admin-logout" type="submit">Log out</button></form></div></header><section className="admin-stats"><div><span>Orders</span><strong>{orders.length}</strong></div><div><span>Paid</span><strong>{paid}</strong></div><div><span>To fulfil</span><strong>{open}</strong></div><div><span>Sales</span><strong>£{(total/100).toFixed(2)}</strong></div></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Orders</h2><p style={{margin:'4px 0 0',color:'#6c716b',fontSize:14}}>Click anywhere on an order to open it.</p></div><span>{orders.length} orders</span></div>{configError?<p>{configError}</p>:!orders.length?<p>No paid orders yet.</p>:<AdminOrdersTable orders={orders}/>}</section></main>;
}
