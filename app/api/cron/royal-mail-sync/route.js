import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';
import {sendOrderEmail} from '../../../../../lib/transactionalEmail';

const CLICK_DROP_ORDERS='https://api.parcel.royalmail.com/api/v1/Orders';
const clean=v=>String(v||'').trim();

function extractRemote(result,reference){
  const rows=Array.isArray(result)?result:Array.isArray(result?.orders)?result.orders:Array.isArray(result?.createdOrders)?result.createdOrders:[result];
  return rows.filter(Boolean).find(x=>clean(x.orderReference)===reference)||rows.filter(Boolean)[0]||null;
}
function trackingOf(remote,details={}){
  const p=remote?.packages?.[0]||{};
  return clean(remote?.trackingNumber||p.trackingNumber||details.tracking_number);
}
function statusOf(remote){
  const p=remote?.packages?.[0]||{};
  return clean(remote?.trackingStatus||remote?.status||p.trackingStatus||p.status);
}
function labelReady(remote,tracking){
  if(!tracking)return false;
  const s=statusOf(remote).toLowerCase();
  if(!s)return Boolean(remote?.labelCreated||remote?.labelGenerated||remote?.postageApplied||remote?.manifested);
  return !['created','new','draft','order created','awaiting payment','payment required','pending'].includes(s);
}

export async function GET(req){
  const secret=process.env.CRON_SECRET;
  const auth=req.headers.get('authorization')||'';
  if(secret&&auth!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  const apiKey=process.env.ROYAL_MAIL_CLICK_DROP_API_KEY;
  if(!apiKey)return NextResponse.json({error:'Click & Drop is not configured'},{status:503});
  const db=getSupabaseAdmin();
  const {data:events,error}=await db.from('order_events').select('order_id,details,created_at').eq('event_type','royal_mail_order_created').order('created_at',{ascending:false}).limit(250);
  if(error)return NextResponse.json({error:'Could not load Royal Mail orders'},{status:500});
  const latest=new Map();
  for(const e of events||[])if(!latest.has(e.order_id))latest.set(e.order_id,e);
  let checked=0,dispatched=0,updated=0;
  for(const [orderId,e] of latest){
    const {data:order}=await db.from('orders').select('id,fulfilment_status,shipping_method,payment_status').eq('id',orderId).maybeSingle();
    if(!order||order.shipping_method==='collection'||order.payment_status!=='paid')continue;
    const reference=clean(e.details?.order_reference),identifier=clean(e.details?.order_identifier);
    if(!reference&&!identifier)continue;
    checked++;
    const token=encodeURIComponent(identifier||reference);
    let response;try{response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{headers:{Authorization:apiKey},cache:'no-store'})}catch{continue}
    if(!response.ok)continue;
    const result=await response.json().catch(()=>null);
    const remote=extractRemote(result,reference);
    if(!remote)continue;
    const tracking=trackingOf(remote,e.details||{});
    const trackingStatus=statusOf(remote);
    if(tracking&&(tracking!==clean(e.details?.tracking_number)||trackingStatus!==clean(e.details?.tracking_status))){
      await db.from('order_events').insert({order_id:orderId,event_type:'royal_mail_tracking_updated',actor:'sync',details:{...e.details,tracking_number:tracking,tracking_status:trackingStatus,order_reference:reference,order_identifier:identifier}});
      updated++;
    }
    if(order.fulfilment_status!=='fulfilled'&&labelReady(remote,tracking)){
      await db.from('orders').update({status:'fulfilled',fulfilment_status:'fulfilled',fulfilled_at:new Date().toISOString(),tracking_number:tracking||null}).eq('id',orderId).eq('payment_status','paid');
      await db.from('order_events').insert({order_id:orderId,event_type:'fulfilment_fulfilled',actor:'sync',details:{source:'royal_mail',tracking_number:tracking,tracking_status:trackingStatus}});
      try{await sendOrderEmail(orderId,'dispatched');const feedbackAt=new Date(Date.now()+5*24*60*60*1000).toISOString();await sendOrderEmail(orderId,'feedback',{scheduledAt:feedbackAt})}catch(err){await db.from('order_events').insert({order_id:orderId,event_type:'email_failed',actor:'system',details:{type:'dispatched',message:String(err?.message||err)}})}
      dispatched++;
    }
  }
  return NextResponse.json({ok:true,checked,updated,dispatched});
}
