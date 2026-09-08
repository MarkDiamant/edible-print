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
  return <main style={{maxWidth:1200,margin:'40px auto',padding:24}}><h1>Edible Print orders</h1>{configError?<p>{configError}</p>:!orders.length?<p>No paid orders yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Delivery</th><th style={th}>Total</th><th style={th}>Payment</th><th style={th}>Fulfilment</th><th style={th}>Artwork</th><th style={th}>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td style={td}><a href={`/admin/orders/${o.id}`}>#{o.order_number}</a></td><td style={td}><strong>{o.first_name} {o.last_name}</strong><br/><small>{o.email}</small></td><td style={td}>{o.shipping_method}</td><td style={td}>£{(o.total_pence/100).toFixed(2)}</td><td style={td}>{o.payment_status}</td><td style={td}>{o.fulfilment_status}</td><td style={td}>{o.artwork_count}</td><td style={td}>{new Date(o.created_at).toLocaleString('en-GB')}</td></tr>)}</tbody></table></div>}</main>;
}
const th={textAlign:'left',padding:'10px 8px',borderBottom:'2px solid #ddd'};
const td={padding:'12px 8px',borderBottom:'1px solid #eee',verticalAlign:'top'};
