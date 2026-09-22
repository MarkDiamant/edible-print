import {cookies} from 'next/headers';
import RoyalMailAutoOpen from './RoyalMailAutoOpen';
import {notFound,redirect} from 'next/navigation';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../lib/orderNumber';
import SheetCountSelect from './SheetCountSelect';

export const dynamic='force-dynamic';
const CLICK_DROP_ORDERS='https://api.parcel.royalmail.com/api/v1/orders';

function parseArtworkInstructions(text=''){
  const chunks=String(text).split(/\n\n(?=IMAGE \d+: )/i);
  return chunks.map(chunk=>{
    const m=chunk.match(/^IMAGE\s+\d+:\s*(.+?)\n([\s\S]*)$/i);
    return m?{filename:m[1].trim(),instruction:m[2].trim()}:null;
  }).filter(Boolean);
}

function eventLabel(event){
  const t=event.event_type,d=event.details||{};
  if(t==='payment_received')return 'Payment received and order created.';
  if(t==='email_confirmation')return 'Order confirmation email was sent to the customer.';
  if(t==='fulfilment_processing')return 'Order was marked as processing.';
  if(t==='email_processing')return 'Processing update email was sent to the customer.';
  if(t==='fulfilment_ready')return 'Order was marked ready.';
  if(t==='email_ready')return 'Ready update email was sent to the customer.';
  if(t==='fulfilment_fulfilled')return 'Order was marked as dispatched / fulfilled.';
  if(t==='email_dispatched')return 'Dispatch email was sent — the customer was told the order is on its way.';
  if(t==='email_collected')return 'Collection confirmation email was sent to the customer.';
  if(t==='email_feedback')return d.scheduled_at?'Feedback email was scheduled for the customer.':'Feedback email was sent to the customer.';
  if(t==='email_failed')return `Customer email failed${d.type?` (${d.type})`:''}.`;
  if(t==='royal_mail_order_created')return `Royal Mail order created${d.order_reference?` (${d.order_reference})`:''}.`;
  if(t==='royal_mail_order_deleted')return 'Royal Mail order was deleted / cancelled in Click & Drop.';
  if(t==='royal_mail_order_failed')return d.action==='delete'?'Royal Mail cancellation failed.':'Royal Mail order creation failed.';
  if(t==='refund_issued')return `Full refund issued${d.amount?` — £${(Number(d.amount)/100).toFixed(2)}`:''}.`;
  if(t==='refund_failed')return 'Refund attempt failed.';
  if(t==='return_recorded')return 'Order was marked as returned.';
  if(t==='customer_message')return 'Customer left an order note.';
  return null;
}

function eventTime(value){
  try{return new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return ''}
}

async function fetchRemoteOrder(details={}){
  const apiKey=process.env.ROYAL_MAIL_CLICK_DROP_API_KEY;
  const reference=String(details.order_reference||'').trim();
  const identifier=String(details.order_identifier||'').trim();
  if(!apiKey||(!reference&&!identifier))return null;
  const token=identifier||encodeURIComponent(reference);
  try{const response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{headers:{Authorization:apiKey},cache:'no-store'});if(!response.ok)return null;const result=await response.json().catch(()=>null);if(Array.isArray(result))return result[0]||null;if(Array.isArray(result?.orders))return result.orders[0]||null;return result&&typeof result==='object'?result:null}catch{return null}
}

async function remoteOrderExists(details={}){
  const apiKey=process.env.ROYAL_MAIL_CLICK_DROP_API_KEY;
  const reference=String(details.order_reference||'').trim();
  const identifier=String(details.order_identifier||'').trim();
  if(!apiKey||(!reference&&!identifier))return true;
  const token=identifier||encodeURIComponent(reference);
  try{
    const response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{headers:{Authorization:apiKey},cache:'no-store'});
    if(response.status===404)return false;
    if(!response.ok)return true;
    const result=await response.json().catch(()=>null);
    console.log('Click & Drop existing order details',{reference,identifier,result:JSON.stringify(result)});
    if(Array.isArray(result))return result.length>0;
    if(Array.isArray(result?.orders))return result.orders.length>0;
    return Boolean(result);
  }catch{return true}
}

const card={background:'#fff',border:'1px solid #e4e4df',borderRadius:14,padding:20,boxShadow:'0 1px 2px rgba(0,0,0,.04)'};

export default async function OrderDetail({params,searchParams}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))redirect('/admin');
  const {id}=await params;
  const query=await searchParams;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)notFound();
  const {data:items}=await db.from('order_items').select('*').eq('order_id',id).order('created_at');
  console.log('Admin order detail',{id,cart_id:order.cart_id,items:(items||[]).map(x=>({id:x.id,source_draft_item_id:x.source_draft_item_id,product_title:x.product_title}))});
  const sourceIds=(items||[]).map(x=>x.source_draft_item_id).filter(Boolean);let draftInstructions=[];if(sourceIds.length){const {data}=await db.from('draft_cart_items').select('*').in('id',sourceIds);draftInstructions=data||[];console.log('Admin source draft instructions',draftInstructions.map(x=>({id:x.id,instructions:x.instructions,print_instructions:x.print_instructions}))) }
  const {data:orderArtwork}=await db.from('artwork').select('id,order_item_id,draft_item_id,object_path,original_filename,mime_type,size_bytes,created_at').eq('order_id',id).order('created_at');
  let artwork=orderArtwork||[];
  if(order.cart_id){
    const {data:cartArtwork}=await db.from('artwork').select('id,order_item_id,draft_item_id,object_path,original_filename,mime_type,size_bytes,created_at').eq('cart_id',order.cart_id).order('created_at');
    const seen=new Set(artwork.map(a=>a.id));
    artwork=[...artwork,...(cartArtwork||[]).filter(a=>!seen.has(a.id))];
  }
  const {data:events}=await db.from('order_events').select('event_type,details,created_at').eq('order_id',id).order('created_at',{ascending:false});
  const messages=(events||[]).filter(e=>e.event_type==='customer_message');
  const instructionEvents=(events||[]).filter(e=>e.event_type==='artwork_instructions');
  const rmEvents=(events||[]).filter(e=>['royal_mail_order_created','royal_mail_order_deleted','royal_mail_order_failed'].includes(e.event_type));
  const latestRmState=(events||[]).find(e=>['royal_mail_order_created','royal_mail_order_deleted'].includes(e.event_type));
  let royalMail=latestRmState?.event_type==='royal_mail_order_created'?latestRmState:null;
  let syncedDeletedEvent=null;
  const royalMailAge=royalMail?.created_at?Date.now()-new Date(royalMail.created_at).getTime():Infinity;
  if(royalMail){const exists=await remoteOrderExists(royalMail.details||{});if(!exists){
    syncedDeletedEvent={event_type:'royal_mail_order_deleted',actor:'sync',created_at:new Date().toISOString(),details:{...(royalMail.details||{}),message:'Order no longer exists in Click & Drop'}};
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_deleted',actor:'sync',details:syncedDeletedEvent.details});
    royalMail=null;
  }}
  const remoteRoyalMail=royalMail?await fetchRemoteOrder(royalMail.details||{}):null;
  const remotePackage=remoteRoyalMail?.packages?.[0]||{};
  const trackingNumber=remoteRoyalMail?.trackingNumber||remotePackage?.trackingNumber||royalMail?.details?.tracking_number||'';
  const trackingStatus=remoteRoyalMail?.trackingStatus||remoteRoyalMail?.status||remotePackage?.trackingStatus||remotePackage?.status||'';
  const customerMessage=messages?.[0]?.details?.message||'';
  console.log('Admin order linked data',{id,artwork:(artwork||[]).map(a=>({id:a.id,order_item_id:a.order_item_id,draft_item_id:a.draft_item_id,filename:a.original_filename})),customerMessage,instructionEvents:(instructionEvents||[]).map(e=>e.details)});
  const instructionMap=new Map(instructionEvents.map(e=>[e.details?.source_draft_item_id,parseArtworkInstructions(e.details?.instructions||'')]));
  const signed=[];
  for(const a of artwork||[]){
    const {data}=await db.storage.from('artwork').createSignedUrl(a.object_path,300,{download:a.original_filename});
    signed.push({...a,url:data?.signedUrl||null});
  }
  const address=order.shipping_address||{};
  const addressLines=[address.line1||address.address1,address.line2||address.address2,address.city,address.state||address.province,address.postal_code||address.zip,address.country].filter(Boolean);
  const customerName=`${order.first_name||''} ${order.last_name||''}`.trim();
  const isCollection=order.shipping_method==='collection';
  const fulfilledLabel=isCollection?'Collected':'Dispatched';
  const sheetCount=Math.max(1,(items||[]).reduce((n,x)=>n+(Number(x.quantity)||0),0));
  const requestedSheets=Number(query?.sheets);
  const packageSheets=Number.isInteger(requestedSheets)&&requestedSheets>=1&&requestedSheets<=23?requestedSheets:sheetCount;
  const mailWeight=83+Math.max(0,packageSheets-1)*30;
  const defaultPostage=order.shipping_method==='express'?'express':'standard';
  const postageName=defaultPostage==='express'?'Tracked 24 Large Letter':'Tracked 48 Large Letter';
  const postagePrice=defaultPostage==='express'?3.80:2.85;
  const number=order.source_order_name?String(order.source_order_name).replace(/^#/,''):formatOrderNumber(order.order_number);
  const timeline=[...(syncedDeletedEvent?[syncedDeletedEvent]:[]),...(events||[])].map(e=>({...e,label:eventLabel(e)})).filter(e=>e.label);
  const rmNotice=query?.rm==='created'?'Royal Mail order created successfully.':query?.rm==='exists'?'This order already exists in Click & Drop.':query?.rm==='deleted'?'Royal Mail order cancelled/deleted successfully.':query?.rm==='delete-failed'?'Royal Mail could not cancel this stored link. If you already deleted the order in Click & Drop, use “Clear from admin” below.':query?.rm==='failed'?'Royal Mail could not accept the order. Check the latest error below and try again.':query?.rm==='config'?'Click & Drop API key is not configured.':query?.rm==='weight'?'This order is over the 750g Large Letter limit and needs manual postage setup.':'';
  const notice=query?.refund==='done'?'Refund completed successfully.':query?.refund==='failed'?'Refund failed — check the timeline/error logs.':query?.refund==='exists'?'This order has already been refunded.':query?.return==='done'?'Return recorded successfully.':query?.return==='exists'?'This order is already marked returned.':'';
  return <main className="admin-shell" style={{maxWidth:1220,margin:'0 auto',padding:'24px 20px 50px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap',marginBottom:18}}>
      <div><p style={{margin:'0 0 8px'}}><a href="/admin">← Orders</a></p><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><h1 style={{margin:0,fontSize:28}}>#{number}</h1><span className="admin-pill paid">{order.payment_status}</span><span className={`admin-pill ${order.fulfilment_status==='fulfilled'?'fulfilled':'open'}`}>{order.fulfilment_status==='fulfilled'?fulfilledLabel:order.fulfilment_status}</span></div><p style={{margin:'6px 0 0',color:'#6a6a66',fontSize:14}}>{eventTime(order.created_at)} · {order.source==='shopify'?'Imported from Shopify':'Online Store'}</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {order.source!=='shopify'&&order.payment_status!=='refunded'&&<a className="btn" href={`/admin/orders/${id}?confirm=refund`}>Refund</a>}
        {order.fulfilment_status!=='returned'&&<a className="btn" href={`/admin/orders/${id}?confirm=return`}>Return</a>}
        <details style={{position:'relative'}}><summary className="btn" style={{listStyle:'none',cursor:'pointer'}}>More actions ▾</summary><div style={{position:'absolute',right:0,top:'calc(100% + 6px)',zIndex:10,minWidth:210,background:'#fff',border:'1px solid #ddd',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,.12)',padding:6}}><a href={`/api/admin/orders/${id}/download`} style={{display:'block',padding:'10px 12px',textDecoration:'none'}}>Download order</a>{!isCollection&&<a href="https://business.parcel.royalmail.com/orders/" target="royalMailPay" style={{display:'block',padding:'10px 12px',textDecoration:'none'}} >Royal Mail order history</a>}</div></details>
      </div>
    </div>
    {notice&&<div style={{background:'#eef8ef',border:'1px solid #cfe5d2',padding:'12px 14px',borderRadius:10,marginBottom:16,fontWeight:600}}>{notice}</div>}
    {query?.confirm==='refund'&&<div style={{background:'#fff4e5',border:'1px solid #edcf99',padding:16,borderRadius:12,marginBottom:16}}><strong>Refund this order in full?</strong><p style={{margin:'6px 0 12px'}}>This will send a full £{(order.total_pence/100).toFixed(2)} refund through Stripe. This cannot be undone here.</p><div style={{display:'flex',gap:8}}><form action={`/api/admin/orders/${id}/refund`} method="post"><button className="btn" type="submit">Confirm full refund</button></form><a className="btn" href={`/admin/orders/${id}`}>Cancel</a></div></div>}
    {query?.confirm==='return'&&<div style={{background:'#fff4e5',border:'1px solid #edcf99',padding:16,borderRadius:12,marginBottom:16}}><strong>Mark this order as returned?</strong><p style={{margin:'6px 0 12px'}}>This records the return in the order timeline. It does not issue a refund.</p><div style={{display:'flex',gap:8}}><form action={`/api/admin/orders/${id}/return`} method="post"><button className="btn" type="submit">Confirm return</button></form><a className="btn" href={`/admin/orders/${id}`}>Cancel</a></div></div>}
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(280px,1fr)',gap:18,alignItems:'start'}}>
      <div style={{display:'grid',gap:18}}>
        <section style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:14}}><h2 style={{margin:0,fontSize:19}}>{order.fulfilment_status==='fulfilled'?fulfilledLabel:'Fulfilment'}</h2><div style={{display:'flex',gap:8,flexWrap:'nowrap',whiteSpace:'nowrap'}}>{['processing','ready','fulfilled'].map(action=><form key={action} action={`/api/admin/orders/${id}/status`} method="post"><input type="hidden" name="action" value={action}/><button className="btn" type="submit">{action==='processing'?'Mark processing':action==='ready'?(isCollection?'Ready for collection':'Mark ready'):(isCollection?'Mark collected':'Mark dispatched')}</button></form>)}</div></div>
          {(items||[]).map(item=>{const itemInstructions=instructionMap.get(item.source_draft_item_id)||[];return <div key={item.id} style={{borderTop:'1px solid #ecece8',padding:'16px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:14}}><div><strong>{item.product_title}</strong><div style={{color:'#666',fontSize:14,marginTop:3}}>{item.variant_label} · Qty {item.quantity}</div></div><strong>£{((item.unit_price_pence*item.quantity)/100).toFixed(2)}</strong></div>{item.source_attributes?.length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:'1px dashed #ddd'}}>{item.source_attributes.map((attr,index)=>{const isImage=/image_upload/i.test(attr.key||'')&&/^https?:\/\//i.test(attr.value||'');return <div key={`${attr.key}-${index}`} style={{fontSize:14,color:'#4e4e4b',marginTop:index?7:0}}><strong>{isImage?`Artwork ${index+1}`:String(attr.key||'').replace(/\d+$/,'')}:</strong> {isImage?<a href={attr.value} target="_blank" rel="noreferrer">Open original artwork ↗</a>:attr.value}</div>})}</div>}{signed.filter(a=>a.order_item_id===item.id||a.draft_item_id===item.source_draft_item_id||(items||[]).length===1).map((a,index)=>{const matched=itemInstructions.find(x=>x.filename===a.original_filename)||itemInstructions[index];return <div key={a.id} style={{marginTop:12,paddingTop:12,borderTop:'1px dashed #ddd'}}><p style={{margin:'0 0 6px'}}><strong>Image {index+1}:</strong> <a href={a.url||'#'}>{a.original_filename}</a> <small>({Math.round(a.size_bytes/1024)} KB)</small></p><div style={{fontSize:14,color:'#4e4e4b'}}><strong>Instructions:</strong> {matched?.instruction||'No specific instructions'}</div></div>})}</div>})}
          <p style={{fontSize:13,color:'#777',margin:'8px 0 0'}}>Artwork download links are secure for 5 minutes. Refresh the page for fresh links.</p>
        </section>
        <section style={card}>
          <h2 style={{margin:'0 0 14px',fontSize:19}}>Paid</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'10px 16px'}}><span>Subtotal</span><strong>£{(order.subtotal_pence/100).toFixed(2)}</strong><span>Shipping · {isCollection?'Collection':order.shipping_method==='express'?'Express':'Standard'}</span><strong>{order.shipping_pence?`£${(order.shipping_pence/100).toFixed(2)}`:'FREE'}</strong><span style={{fontWeight:700,borderTop:'1px solid #eee',paddingTop:10}}>Total</span><strong style={{borderTop:'1px solid #eee',paddingTop:10}}>£{(order.total_pence/100).toFixed(2)}</strong></div>
        </section>
        {!isCollection&&<section style={{...card,padding:0,overflow:'hidden'}}>
          <div style={{padding:'18px 20px',borderBottom:'1px solid #e8e8e3',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h2 style={{margin:0,fontSize:19}}>Create shipping label</h2><p style={{margin:'4px 0 0',fontSize:13,color:'#6a6f68'}}>Everything is filled in from the order. Check it, then continue to Royal Mail.</p></div><span style={{fontSize:13,fontWeight:700,background:'#eef3ec',padding:'6px 9px',borderRadius:999}}>Large Letter</span></div>
          <div style={{padding:20,display:'grid',gap:16}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>
              <div style={{background:'#f7f8f6',border:'1px solid #e3e5e0',borderRadius:11,padding:13}}><small style={{color:'#747972'}}>SHIP TO</small><div style={{marginTop:5,lineHeight:1.45}}><strong>{customerName}</strong>{addressLines.map((line,i)=><div key={i}>{line}</div>)}</div></div>
              <div style={{background:'#f7f8f6',border:'1px solid #e3e5e0',borderRadius:11,padding:13}}><small style={{color:'#747972'}}>PACKAGE</small><div style={{marginTop:5}}><strong>32 × 23 cm Large Letter</strong><div>{packageSheets} {packageSheets===1?'sheet':'sheets'} · {mailWeight}g</div><div style={{fontSize:12,color:'#687068',marginTop:4}}>Choose the actual number of sheets below if the parcel differs from the order quantity.</div></div></div>
              <div style={{background:'#f7f8f6',border:'1px solid #e3e5e0',borderRadius:11,padding:13}}><small style={{color:'#747972'}}>CUSTOMER PAID</small><div style={{marginTop:5}}><strong>{order.shipping_method==='express'?'Express':'Standard'}</strong><div>{order.shipping_pence?`£${(order.shipping_pence/100).toFixed(2)}`:'FREE'}</div></div></div>
            </div>
            <div style={{border:'1px solid #dfe3dc',borderRadius:12,padding:15,display:'flex',justifyContent:'space-between',alignItems:'end',gap:14,flexWrap:'wrap'}}><div><strong>Package weight</strong><div style={{fontSize:13,color:'#687068',marginTop:3}}>Adjust this if the actual parcel has a different number of sheets.</div></div><label style={{display:'grid',gap:5,fontSize:13,fontWeight:700}}>Package sheets<SheetCountSelect value={packageSheets}/></label></div>
            {royalMail?<>
              <div style={{border:'1px solid #cfe5d2',borderRadius:12,overflow:'hidden'}}>
                <div style={{background:'#eef8ef',padding:'13px 15px'}}><strong>Ready in Royal Mail Click & Drop</strong><div style={{fontSize:13,marginTop:3}}>Reference {royalMail.details?.order_reference||`EP-${number}`} · {postageName} · {mailWeight}g</div>{trackingNumber&&<div style={{fontSize:13,marginTop:4,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><span><strong>Tracking:</strong> {trackingNumber}{trackingStatus?` · ${trackingStatus}`:''}</span><a href="https://www.royalmail.com/track-your-item" target="_blank" rel="noreferrer" style={{fontWeight:700}}>Track on Royal Mail ↗</a></div>}</div>
                <div style={{padding:15,display:'grid',gridTemplateColumns:'1fr auto',gap:14,alignItems:'center'}}><div><strong>Postage applied. Next: open Royal Mail to pay and print</strong><div style={{fontSize:13,color:'#687068',marginTop:3}}>The address, parcel and service are already on the Royal Mail order.</div></div><a className="btn" href="https://business.parcel.royalmail.com/orders/" target="royalMailPay">Open Royal Mail orders</a></div>
              </div>
              <details><summary style={{cursor:'pointer',fontSize:13,color:'#666'}}>Royal Mail order options</summary><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><form action={`/api/admin/orders/${id}/cancel-royal-mail`} method="post"><button className="btn" type="submit" style={{borderColor:'#d6a4a4',color:'#8a2d2d',background:'#fff'}}>Cancel Royal Mail order</button></form><form action={`/api/admin/orders/${id}/cancel-royal-mail`} method="post"><input type="hidden" name="force_clear" value="1"/><button className="btn" type="submit" style={{background:'#fff',color:'#555',borderColor:'#ccc'}}>Clear from admin</button></form></div></details>
            </>:<>
              <div style={{border:'1px solid #dfe3dc',borderRadius:12,padding:15,display:'grid',gridTemplateColumns:'1fr auto',gap:14,alignItems:'center'}}>
                <div><small style={{color:'#747972'}}>SHIPPING SERVICE</small><div style={{fontSize:17,fontWeight:700,marginTop:3}}>{postageName}</div><div style={{fontSize:18,fontWeight:800,marginTop:4}}>Royal Mail online price: £{postagePrice.toFixed(2)}</div><div style={{fontSize:13,color:'#687068',marginTop:2}}>Defaults to the customer's checkout choice. You can change it to Tracked 24 or Tracked 48 before confirming postage.</div></div><span style={{fontSize:12,fontWeight:700,background:'#eaf4ff',color:'#376482',padding:'5px 8px',borderRadius:999}}>Selected</span>
              </div>
              <RoyalMailAutoOpen action={`/api/admin/orders/${id}/royal-mail?v=3`} postageService={defaultPostage} sheetCount={packageSheets}/>
            </>}
            {rmNotice&&<p style={{margin:0,fontWeight:600}}>{rmNotice}</p>}
            {query?.rm==='failed'&&rmEvents?.[0]?.event_type==='royal_mail_order_failed'&&<p style={{margin:0,color:'#8a2d2d'}}>{rmEvents[0].details?.message||'Royal Mail returned an error.'}</p>}
          </div>
        </section>}
        <section style={{...card,padding:0,overflow:'hidden'}}>
          <div style={{padding:'18px 20px',borderBottom:'1px solid #eee'}}><h2 style={{margin:0,fontSize:19}}>Timeline</h2></div>
          <div style={{padding:'8px 20px 18px'}}>{timeline.length?timeline.map((e,i)=><div key={`${e.event_type}-${e.created_at}-${i}`} style={{display:'grid',gridTemplateColumns:'14px 1fr auto',gap:12,alignItems:'start',padding:'13px 0',borderBottom:i===timeline.length-1?'none':'1px solid #f0f0ed'}}><span style={{width:9,height:9,borderRadius:'50%',background:'#777',marginTop:6}}/><div><div>{e.label}</div>{e.event_type==='email_failed'&&e.details?.message&&<small style={{color:'#9b1c1c'}}>{e.details.message}</small>}</div><small style={{color:'#777',whiteSpace:'nowrap'}}>{eventTime(e.created_at)}</small></div>):<p style={{color:'#777'}}>No timeline activity yet.</p>}</div>
        </section>
      </div>
      <aside style={{display:'grid',gap:18}}>
        <section style={card}><h2 style={{margin:'0 0 12px',fontSize:18}}>Notes</h2><p style={{margin:0,whiteSpace:'pre-wrap',color:customerMessage?'#333':'#777'}}>{customerMessage||'No notes from customer'}</p></section>
        <section style={card}><h2 style={{margin:'0 0 12px',fontSize:18}}>Customer</h2><strong>{customerName}</strong><div style={{marginTop:14}}><strong>Contact information</strong><p style={{margin:'6px 0 0'}}><a href={`mailto:${order.email}`}>{order.email}</a><br/>{order.phone||''}</p></div>{!isCollection&&<div style={{marginTop:16}}><strong>Shipping address</strong><div style={{marginTop:6,lineHeight:1.5}}><strong>{customerName}</strong>{addressLines.map((line,i)=><div key={i}>{line}</div>)}</div></div>}</section>
        <section style={card}><h2 style={{margin:'0 0 12px',fontSize:18}}>Order summary</h2><p style={{margin:'0 0 6px'}}><strong>{(items||[]).reduce((n,x)=>n+Number(x.quantity||0),0)}</strong> item(s)</p><p style={{margin:'0 0 6px'}}><strong>{signed.length}</strong> artwork file(s)</p><p style={{margin:0}}><strong>£{(order.total_pence/100).toFixed(2)}</strong> total</p></section>
      </aside>
    </div>
  </main>;
}
