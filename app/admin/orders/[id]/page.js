import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../lib/orderNumber';

export const dynamic='force-dynamic';

function parseArtworkInstructions(text=''){
  const chunks=String(text).split(/\n\n(?=IMAGE \d+: )/i);
  return chunks.map(chunk=>{
    const m=chunk.match(/^IMAGE\s+\d+:\s*(.+?)\n([\s\S]*)$/i);
    return m?{filename:m[1].trim(),instruction:m[2].trim()}:null;
  }).filter(Boolean);
}

export default async function OrderDetail({params,searchParams}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))redirect('/admin');
  const {id}=await params;
  const query=await searchParams;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)notFound();
  const {data:items}=await db.from('order_items').select('*').eq('order_id',id).order('created_at');
  const {data:artwork}=await db.from('artwork').select('id,order_item_id,object_path,original_filename,mime_type,size_bytes').eq('order_id',id).order('created_at');
  const {data:messages}=await db.from('order_events').select('details,created_at').eq('order_id',id).eq('event_type','customer_message').order('created_at',{ascending:false}).limit(1);
  const {data:instructionEvents}=await db.from('order_events').select('details,created_at').eq('order_id',id).eq('event_type','artwork_instructions').order('created_at');
  const {data:rmEvents}=await db.from('order_events').select('event_type,details,created_at').eq('order_id',id).in('event_type',['royal_mail_order_created','royal_mail_order_failed']).order('created_at',{ascending:false}).limit(5);
  const royalMail=(rmEvents||[]).find(x=>x.event_type==='royal_mail_order_created')||null;
  const customerMessage=messages?.[0]?.details?.message||'';
  const instructionMap=new Map((instructionEvents||[]).map(e=>[e.details?.source_draft_item_id,parseArtworkInstructions(e.details?.instructions||'')]));
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
  const sheetCount=Math.max(1,(items||[]).reduce((n,x)=>n+(Number(x.quantity)||0),0));
  const mailWeight=83+Math.max(0,sheetCount-1)*30;
  const rmNotice=query?.rm==='created'?'Sent to Royal Mail Click & Drop successfully.':query?.rm==='exists'?'This order has already been sent to Click & Drop.':query?.rm==='failed'?'Royal Mail could not accept the order. Check the latest error below and try again.':query?.rm==='config'?'Click & Drop is connected in the admin but the secure API key still needs to be added to the production environment.':query?.rm==='weight'?'This order is over the 750g Large Letter limit and needs manual postage setup.':query?.rm==='collection'?'Collection orders do not need Royal Mail postage.':'';
  return <main className="admin-shell admin-order-detail"><p><a href="/admin">← Orders</a></p><div className="admin-order-title"><div><h1>Order #{formatOrderNumber(order.order_number)}</h1><span className="admin-pill paid">{order.payment_status}</span> <span className={`admin-pill ${order.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{order.fulfilment_status==='fulfilled'?fulfilledLabel:order.fulfilment_status}</span></div><strong>£{(order.total_pence/100).toFixed(2)}</strong></div><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,margin:'18px 0'}}><div style={{background:'#fff',border:'1px solid #e5e3dd',padding:18,borderRadius:12}}><strong>Customer</strong><div style={{marginTop:8,lineHeight:1.55}}>{customerName}<br/>{order.email}<br/>{order.phone||''}</div></div>{!isCollection&&<div style={{background:'#f7f8f4',border:'1px solid #e2e7de',padding:18,borderRadius:12}}><strong>Delivery address</strong><div style={{marginTop:8,lineHeight:1.55}}><strong>{customerName}</strong>{addressLines.map((line,i)=><div key={i}>{line}</div>)}</div></div>}</section><section style={{background:customerMessage?'#fff8e8':'#f7f7f5',border:'1px solid #e8e3d7',padding:18,borderRadius:12,margin:'14px 0 20px'}}><strong>Customer message</strong><p style={{margin:'8px 0 0',whiteSpace:'pre-wrap',color:customerMessage?'#333':'#777'}}>{customerMessage||'No customer message on this order.'}</p></section><p><strong>{isCollection?'Collection':order.shipping_method}</strong> · £{(order.total_pence/100).toFixed(2)} · {order.payment_status} · <strong>{order.fulfilment_status==='fulfilled'?fulfilledLabel:order.fulfilment_status}</strong></p>{!isCollection&&<section style={{background:'#f7f8fb',border:'1px solid #dfe4ec',padding:18,borderRadius:12,margin:'18px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}><div><strong>Royal Mail Click & Drop</strong><p style={{margin:'7px 0 0',color:'#60656b'}}>{order.shipping_method==='express'?'Customer selected Express delivery.':'Customer selected Standard delivery.'} Large Letter · {sheetCount} {sheetCount===1?'sheet':'sheets'} · estimated {mailWeight}g.</p>{royalMail?<p style={{margin:'8px 0 0'}}><strong>Sent:</strong> {royalMail.details?.order_reference||`EP-${formatOrderNumber(order.order_number)}`}{royalMail.details?.order_identifier?` · Royal Mail order ${royalMail.details.order_identifier}`:''}{royalMail.details?.tracking_number?` · ${royalMail.details.tracking_number}`:''}</p>:null}{rmNotice&&<p style={{margin:'9px 0 0',fontWeight:600}}>{rmNotice}</p>}{query?.rm==='failed'&&rmEvents?.[0]?.event_type==='royal_mail_order_failed'&&<p style={{margin:'6px 0 0',color:'#8a2d2d'}}>{rmEvents[0].details?.message||'Royal Mail returned an error.'}</p>}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!royalMail&&<form action={`/api/admin/orders/${id}/royal-mail`} method="post"><button className="btn" type="submit">Send to Click & Drop</button></form>}<a className="btn" href="https://business.parcel.royalmail.com/orders" target="_blank" rel="noopener noreferrer">Open Click & Drop</a></div></div><p className="admin-help" style={{marginBottom:0}}>Postage and label payment stays in Click & Drop for this personal Royal Mail account. The Royal Mail order reference is saved here so the shipment can always be found again.</p></section>}<div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0'}}>{['processing','ready','fulfilled'].map(action=><form key={action} action={`/api/admin/orders/${id}/status`} method="post"><input type="hidden" name="action" value={action}/><button className="btn" type="submit">{action==='processing'?'Mark processing':action==='ready'?(isCollection?'Mark ready for collection':'Mark ready'):(isCollection?'Mark collected':'Mark dispatched')}</button></form>)}</div><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'18px 0'}}>{signed.length>0&&<a className="btn" href={signed[0].url||'#'}>Download first artwork</a>}</div><h2>Items & artwork</h2><p className="admin-help">Each artwork has its own customer instruction below it. Artwork links are secure for 5 minutes; refresh this order for a fresh link.</p>{(items||[]).map(item=>{const itemInstructions=instructionMap.get(item.source_draft_item_id)||[];return <section key={item.id} style={{borderTop:'1px solid #ddd',padding:'18px 0'}}><h3>{item.product_title}</h3><p>{item.variant_label} · Qty {item.quantity}</p>{signed.filter(a=>a.order_item_id===item.id).map((a,index)=>{const matched=itemInstructions.find(x=>x.filename===a.original_filename)||itemInstructions[index];return <div key={a.id} style={{border:'1px solid #e2e4dd',borderRadius:10,padding:12,margin:'10px 0',background:'#fff'}}><p style={{margin:'0 0 8px'}}><strong>Image {index+1}:</strong> <a href={a.url||'#'}>{a.original_filename}</a> <small>({Math.round(a.size_bytes/1024)} KB · secure 5-minute link)</small></p><div style={{background:'#fff8e8',border:'1px solid #eadfbd',borderRadius:8,padding:'10px 12px'}}><strong>Instructions for this image</strong><p style={{margin:'5px 0 0',whiteSpace:'pre-wrap'}}>{matched?.instruction||'No specific instructions'}</p></div></div>})}</section>})}</main>;
}
