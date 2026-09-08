import Stripe from 'stripe';
import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';

export const runtime='nodejs';

async function persistPaidOrder(session){
  const cartId=session.metadata?.cart_id;
  if(!cartId)throw new Error('Stripe session has no cart_id');
  const db=getSupabaseAdmin();

  const {data:existing}=await db.from('orders').select('id').eq('stripe_checkout_session_id',session.id).maybeSingle();
  if(existing)return existing.id;

  const {data:items,error:itemError}=await db.from('draft_cart_items').select('*').eq('cart_id',cartId).order('created_at');
  if(itemError||!items?.length)throw itemError||new Error('Basket items missing');
  const {data:artwork,error:artError}=await db.from('artwork').select('*').eq('cart_id',cartId).eq('status','attached');
  if(artError)throw artError;
  for(const item of items){
    const count=(artwork||[]).filter(a=>a.draft_item_id===item.id).length;
    if(count<1||count>item.max_designs)throw new Error(`Artwork validation failed for ${item.id}`);
  }

  const subtotal=items.reduce((sum,x)=>sum+x.unit_price_pence*x.quantity,0);
  const delivery=session.metadata?.delivery==='express'?'express':'standard';
  const shipping=delivery==='express'?(subtotal>=2500?200:495):(subtotal>=2500?0:295);
  const total=subtotal+shipping;
  if(session.amount_total!==total)throw new Error('Stripe total does not match basket total');

  const shippingDetails=session.collected_information?.shipping_details||session.shipping_details||null;
  const customer=session.customer_details||{};
  const fullName=shippingDetails?.name||customer.name||'Customer';
  const bits=String(fullName).trim().split(/\s+/);
  const firstName=bits.shift()||'Customer',lastName=bits.join(' ')||'-';
  const address=shippingDetails?.address||customer.address||{};

  const {data:order,error:orderError}=await db.from('orders').insert({
    cart_id:cartId,status:'paid',payment_status:'paid',fulfilment_status:'unfulfilled',
    email:customer.email||session.customer_email||'unknown@invalid.local',first_name:firstName,last_name:lastName,
    phone:customer.phone||null,shipping_address:address,shipping_method:delivery,
    subtotal_pence:subtotal,shipping_pence:shipping,total_pence:total,currency:'gbp',
    stripe_checkout_session_id:session.id,
    stripe_payment_intent_id:typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null,
    paid_at:new Date().toISOString()
  }).select('id,order_number').single();
  if(orderError)throw orderError;

  const orderRows=items.map(x=>({order_id:order.id,source_draft_item_id:x.id,product_slug:x.product_slug,product_title:x.product_title,variant_label:x.variant_label,variant_index:x.variant_index,unit_price_pence:x.unit_price_pence,quantity:x.quantity,max_designs:x.max_designs}));
  const {data:createdItems,error:copyError}=await db.from('order_items').insert(orderRows).select('id,source_draft_item_id');
  if(copyError)throw copyError;

  for(const oi of createdItems||[]){
    const {error}=await db.from('artwork').update({order_id:order.id,order_item_id:oi.id,status:'approved',orphan_expires_at:new Date('2999-01-01').toISOString()}).eq('cart_id',cartId).eq('draft_item_id',oi.source_draft_item_id);
    if(error)throw error;
  }
  await db.from('draft_carts').update({email:customer.email||session.customer_email||null,first_name:firstName,last_name:lastName,phone:customer.phone||null,shipping_address:address,shipping_method:delivery,expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()}).eq('id',cartId);
  await db.from('order_events').insert({order_id:order.id,event_type:'payment_received',actor:'stripe_webhook',details:{checkout_session_id:session.id,payment_intent_id:session.payment_intent}});
  return order.id;
}

export async function POST(req){
  try{
    if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return NextResponse.json({error:'Webhook not configured'},{status:503});
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const signature=req.headers.get('stripe-signature');
    if(!signature)return NextResponse.json({error:'Missing Stripe signature'},{status:400});
    const raw=await req.text();
    const event=stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
      const session=event.data.object;
      if(session.payment_status==='paid'||event.type==='checkout.session.async_payment_succeeded')await persistPaidOrder(session);
    }
    return NextResponse.json({received:true});
  }catch(e){
    console.error('Stripe webhook error',e);
    return NextResponse.json({error:'Webhook processing failed'},{status:400});
  }
}
