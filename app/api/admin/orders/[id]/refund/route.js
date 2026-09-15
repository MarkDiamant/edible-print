import Stripe from 'stripe';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)return NextResponse.json({error:'Order not found'},{status:404});
  if(order.payment_status==='refunded')return NextResponse.redirect(new URL(`/admin/orders/${id}?refund=exists`,req.url),303);
  if(!order.stripe_payment_intent_id||!process.env.STRIPE_SECRET_KEY)return NextResponse.redirect(new URL(`/admin/orders/${id}?refund=failed`,req.url),303);
  try{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const refund=await stripe.refunds.create({payment_intent:order.stripe_payment_intent_id,reason:'requested_by_customer'});
    await db.from('orders').update({payment_status:'refunded',status:'refunded'}).eq('id',id);
    await db.from('order_events').insert({order_id:id,event_type:'refund_issued',actor:'admin',details:{refund_id:refund.id,amount:refund.amount,currency:refund.currency,status:refund.status}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?refund=done`,req.url),303);
  }catch(error){
    console.error('Refund failed',error);
    await db.from('order_events').insert({order_id:id,event_type:'refund_failed',actor:'admin',details:{message:String(error?.message||error).slice(0,500)}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?refund=failed`,req.url),303);
  }
}
