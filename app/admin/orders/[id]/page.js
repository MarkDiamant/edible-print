import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';

export const dynamic='force-dynamic';

export default async function OrderDetail({params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))redirect('/admin');
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)notFound();
  const {data:items}=await db.from('order_items').select('*').eq('order_id',id).order('created_at');
  const {data:artwork}=await db.from('artwork').select('id,order_item_id,object_path,original_filename,mime_type,size_bytes').eq('order_id',id).order('created_at');
  const signed=[];
  for(const a of artwork||[]){
    const {data}=await db.storage.from('artwork').createSignedUrl(a.object_path,300,{download:a.original_filename});
    signed.push({...a,url:data?.signedUrl||null});
  }
  return <main style={{maxWidth:1000,margin:'40px auto',padding:24}}><p><a href="/admin">← Orders</a></p><h1>Order #{order.order_number}</h1><p><strong>{order.first_name} {order.last_name}</strong><br/>{order.email}<br/>{order.phone||''}</p><pre style={{whiteSpace:'pre-wrap',background:'#f7f7f7',padding:16}}>{JSON.stringify(order.shipping_address,null,2)}</pre><p><strong>{order.shipping_method}</strong> · £{(order.total_pence/100).toFixed(2)} · {order.payment_status} · <strong>{order.fulfilment_status}</strong></p><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0'}}>{['processing','ready','fulfilled'].map(action=><form key={action} action={`/api/admin/orders/${id}/status`} method="post"><input type="hidden" name="action" value={action}/><button className="btn" type="submit">{action==='processing'?'Mark processing':action==='ready'?'Mark ready':'Mark fulfilled'}</button></form>)}</div><h2>Items & artwork</h2>{(items||[]).map(item=><section key={item.id} style={{borderTop:'1px solid #ddd',padding:'18px 0'}}><h3>{item.product_title}</h3><p>{item.variant_label} · Qty {item.quantity}</p>{signed.filter(a=>a.order_item_id===item.id).map(a=><p key={a.id}><a href={a.url||'#'}>{a.original_filename}</a> <small>({Math.round(a.size_bytes/1024)} KB · link valid 5 minutes)</small></p>)}</section>)}</main>;
}
