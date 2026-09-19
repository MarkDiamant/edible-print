import {getSupabaseAdmin} from './supabaseAdmin';

export async function loadBasket(db,cartId){
 const {data:items,error:itemError}=await db.from('draft_cart_items').select('*').eq('cart_id',cartId).order('created_at');
 if(itemError||!items?.length)throw itemError||new Error('Basket items missing');
 const {data:artwork,error:artError}=await db.from('artwork').select('*').eq('cart_id',cartId);
 if(artError)throw artError;
 for(const item of items){const count=(artwork||[]).filter(a=>a.draft_item_id===item.id).length;if(count<1||count>item.max_designs)throw new Error('Artwork validation failed for '+item.id)}
 return {items,artwork:artwork||[]};
}
function totals(items,delivery){const subtotal=items.reduce((sum,x)=>sum+x.unit_price_pence*x.quantity,0);const shipping=delivery==='collection'?0:delivery==='express'?(subtotal>=2500?200:495):(subtotal>=2500?0:295);return {subtotal,shipping,total:subtotal+shipping}}
export async function createOrder({db,cartId,items,delivery,email,phone,fullName,address,paymentIntentId,checkoutSessionId,paidAmount,actor,customerMessage=''}){
 if(paymentIntentId){const {data:existing}=await db.from('orders').select('id').eq('stripe_payment_intent_id',paymentIntentId).maybeSingle();if(existing)return existing.id}
 if(checkoutSessionId){const {data:existing}=await db.from('orders').select('id').eq('stripe_checkout_session_id',checkoutSessionId).maybeSingle();if(existing)return existing.id}
 const {subtotal,shipping,total}=totals(items,delivery);if(Number(paidAmount)!==total)throw new Error('Stripe total does not match basket total');
 const bits=String(fullName||'Customer').trim().split(/\s+/),firstName=bits.shift()||'Customer',lastName=bits.join(' ')||'-';
 const {data:order,error:orderError}=await db.from('orders').insert({cart_id:cartId,status:'paid',payment_status:'paid',fulfilment_status:'unfulfilled',email:email||'unknown@invalid.local',first_name:firstName,last_name:lastName,phone:phone||null,shipping_address:address||{},shipping_method:delivery,subtotal_pence:subtotal,shipping_pence:shipping,total_pence:total,currency:'gbp',stripe_checkout_session_id:checkoutSessionId||null,stripe_payment_intent_id:paymentIntentId||null,paid_at:new Date().toISOString()}).select('id,order_number').single();if(orderError)throw orderError;
 const rows=items.map(x=>({order_id:order.id,source_draft_item_id:x.id,product_slug:x.product_slug,product_title:x.product_title,variant_label:x.variant_label,variant_index:x.variant_index,unit_price_pence:x.unit_price_pence,quantity:x.quantity,max_designs:x.max_designs}));
 const {data:createdItems,error:copyError}=await db.from('order_items').insert(rows).select('id,source_draft_item_id');if(copyError)throw copyError;
 for(const oi of createdItems||[]){const {error}=await db.from('artwork').update({order_id:order.id,order_item_id:oi.id,status:'approved',orphan_expires_at:new Date('2999-01-01').toISOString()}).eq('cart_id',cartId).eq('draft_item_id',oi.source_draft_item_id);if(error)throw error}
 await db.from('draft_carts').update({email:email||null,first_name:firstName,last_name:lastName,phone:phone||null,shipping_address:address||{},shipping_method:delivery,expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()}).eq('id',cartId);
 const {error:payEventError}=await db.from('order_events').insert({order_id:order.id,event_type:'payment_received',actor,details:{checkout_session_id:checkoutSessionId||null,payment_intent_id:paymentIntentId||null}});if(payEventError)throw payEventError;
 for(const item of items){const instructionText=String(item.instructions||item.print_instructions||'').trim();if(instructionText){const {error}=await db.from('order_events').insert({order_id:order.id,event_type:'artwork_instructions',actor:'customer',details:{source_draft_item_id:item.id,product_title:item.product_title,instructions:instructionText.slice(0,4000)}});if(error)throw error}}
 const note=String(customerMessage||'').trim();if(note){const {error}=await db.from('order_events').insert({order_id:order.id,event_type:'customer_message',actor:'customer',details:{message:note.slice(0,450)}});if(error)throw error}
 console.log('Order persisted',{orderId:order.id,cartId,paymentIntentId,items:items.length,note:Boolean(note)});return order.id;
}
export async function persistPaymentIntent(stripe,pi,actor='stripe_payment_intent_webhook'){
 const cartId=pi.metadata?.cart_id;if(!cartId)throw new Error('Stripe payment intent has no cart_id');
 const db=getSupabaseAdmin(),{items}=await loadBasket(db,cartId);try{const saved=JSON.parse(pi.metadata?.artwork_instructions||'[]');const map=new Map(Array.isArray(saved)?saved:[]);for(const item of items){if(map.has(item.id))item.instructions=String(map.get(item.id)||'')}}catch{}const delivery=['collection','express'].includes(pi.metadata?.delivery)?pi.metadata.delivery:'standard';
 let method=null;if(typeof pi.payment_method==='string')method=await stripe.paymentMethods.retrieve(pi.payment_method);else method=pi.payment_method;
 const billing=method?.billing_details||{},shipping=pi.shipping||{};
 return createOrder({db,cartId,items,delivery,email:billing.email||pi.receipt_email,phone:billing.phone||shipping.phone,fullName:shipping.name||billing.name,address:shipping.address||billing.address||{},paymentIntentId:pi.id,checkoutSessionId:null,paidAmount:pi.amount_received||pi.amount,actor,customerMessage:pi.metadata?.customer_message||''});
}
