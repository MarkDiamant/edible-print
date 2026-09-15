import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../lib/orderNumber';

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
  const {data:messages}=await db.from('order_events').select('details,created_at').eq('order_id',id).eq('event_type','customer_message').order('created_at',{ascending:false}).limit(1);
  const customerMessage=messages?.[0]?.details?.message||'';
  const signed=[];
  for(const a of artwork||[]){
    const {data}=await db.storage.from('artwork').createSignedUrl(a.object_path,300,{download:a.original_filename});
    signed.push({...a,url:data?.signedUrl||null});
  }
  const address=order.shipping_address||{};
  const addressLines=[address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean);
  const customerName=`${order.first_name||''} ${order.last_name||''}`.trim();
  const isCollection=order.shipping_method==='collection';
  const fulfilledLabel=isCollection?'Collected':'Dispatched';
  return <main className="admin-shell admin-order-detail"><p><a href="/admin">← Orders</a></p><div className="admin-order-title"><div><h1>Order #{formatOrderNumber(order.order_number)}</h1><span className="admin-pill paid">{order.payment_status}</span> <span className={`admin-pill ${order.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{order.fulfilment_status==='fulfilled'?fulfilledLabel:order.fulfilment_status}</span></div><strong>£{(order.total_pence/100).toFixed(2)}</strong></div><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,margin:'18px 0'}}><div style={{background:'#fff',border:'1px solid #e5e3dd',padding:18,borderRadius:12}}><strong>Customer</strong><div style={{marginTop:8,lineHeight:1.55}}>{customerName}<br/>{order.email}<br/>{order.phone||''}</div></div>{!isCollection&&<div style={{background:'#f7f8f4',border:'1px solid #e2e7de',padding:18,borderRadius:12}}><strong>Delivery address</strong><div style={{marginTop:8,lineHeight:1.55}}><strong>{customerName}</strong>{addressLines.map((line,i)=><div key={i}>{line}</div>)}</div></div>}</section><section style={{background:customerMessage?'#fff8e8':'#f7f7f5',border:'1px solid #e8e3d7',padding:18,borderRadius:12,margin:'14px 0 20px'}}><strong>Customer message</strong><p style={{margin:'8px 0 0',whiteSpace:'pre-wrap',color:customerMessage?'#333':'#777'}}>{customerMessage||'No customer message on this order.'}</p></section><p><strong>{isCollection?'Collection':order.shipping_method}</strong> · £{(order.total_pence/100).toFixed(2)} · {order.payment_status} · <strong>{order.fulfilment_status==='fulfilled'?fulfilledLabel:order.fulfilment_status}</strong></p><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0'}}>{['processing','ready','fulfilled'].map(action=><form key={action} action={`/api/admin/orders/${id}/status`} method="post"><input type="hidden" name="action" value={action}/><button className="btn" type="submit">{action==='processing'?'Mark processing':action==='ready'?(isCollection?'Mark ready for collection':'Mark ready'):(isCollection?'Mark collected':'Mark dispatched')}</button></form>)}</div><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'18px 0'}}>{signed.length>0&&<a className="btn" href={signed[0].url||'#'}>Download first artwork</a>}</div><h2>Items & artwork</h2><p className="admin-help">Artwork links are secure and valid for 5 minutes. If a link expires, reopen or refresh this order and a fresh link is generated automatically.</p>{(items||[]).map(item=><section key={item.id} style={{borderTop:'1px solid #ddd',padding:'18px 0'}}><h3>{item.product_title}</h3><p>{item.variant_label} · Qty {item.quantity}</p>{signed.filter(a=>a.order_item_id===item.id).map(a=><p key={a.id}><a href={a.url||'#'}>{a.original_filename}</a> <small>({Math.round(a.size_bytes/1024)} KB · secure 5-minute link)</small></p>)}</section>)}</main>;
}
