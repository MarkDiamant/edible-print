import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';

const CLICK_DROP_ORDERS='https://api.parcel.royalmail.com/api/v1/orders';

function refToken(reference){return encodeURIComponent(`"${String(reference||'').trim()}"`)}

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:events}=await db.from('order_events').select('event_type,details,created_at').eq('order_id',id).in('event_type',['royal_mail_order_created','royal_mail_order_deleted']).order('created_at',{ascending:false}).limit(20);
  const latest=(events||[]).find(e=>['royal_mail_order_created','royal_mail_order_deleted'].includes(e.event_type));
  if(!latest||latest.event_type==='royal_mail_order_deleted')return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=deleted`,req.url),303);
  const apiKey=process.env.ROYAL_MAIL_CLICK_DROP_API_KEY;
  if(!apiKey)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=config`,req.url),303);
  const reference=latest.details?.order_reference;
  const identifier=latest.details?.order_identifier;
  const token=reference?refToken(reference):String(identifier||'');
  if(!token)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
  try{
    const response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{method:'DELETE',headers:{Authorization:apiKey},cache:'no-store'});
    const result=await response.json().catch(()=>({}));
    if(response.status===404){
      await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_deleted',actor:'admin',details:{...(latest.details||{}),message:'Order was already deleted in Click & Drop'}});
      return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=deleted`,req.url),303);
    }
    const deleted=(result.deletedOrders||[]).find(x=>String(x.orderReference||'')===String(reference||'')||String(x.orderIdentifier||'')===String(identifier||''));
    if(!response.ok||!deleted){
      const message=result?.errors?.[0]?.message||result?.message||`Royal Mail returned ${response.status}`;
      await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(message).slice(0,500),action:'delete',order_reference:reference||null,order_identifier:identifier||null}});
      return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=delete-failed`,req.url),303);
    }
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_deleted',actor:'admin',details:{...(latest.details||{}),message:'Cancelled from Edible Print admin'}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=deleted`,req.url),303);
  }catch(error){
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(error?.message||error).slice(0,500),action:'delete',order_reference:reference||null,order_identifier:identifier||null}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=delete-failed`,req.url),303);
  }
}
