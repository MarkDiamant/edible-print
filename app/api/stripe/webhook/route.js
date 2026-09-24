import Stripe from 'stripe';
import {NextResponse} from 'next/server';
import {sendOrderEmail,sendNewOrderAdminEmail} from '../../../../lib/transactionalEmail';
import {persistPaymentIntent} from '../../../../lib/orderPersistence';
export const runtime='nodejs';
const ORDER_PUSH_TOPIC='edibleprint-orders-7f2b9c41-6d83-4a51-b2e7-91c4d8a6035f';
async function sendOrderPush(orderId){
 try{
  const res=await fetch('https://ntfy.sh/'+ORDER_PUSH_TOPIC,{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8','Title':'Edible Print - New order','Priority':'high','Tags':'moneybag'},body:'Cha-ching! A new paid Edible Print order has arrived. Open admin to view it.'});
  if(!res.ok)console.error('Order push failed',res.status,await res.text());
 }catch(e){console.error('Order push failed',e)}
}
export async function POST(req){
 try{
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return NextResponse.json({error:'Webhook not configured'},{status:503});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY),signature=req.headers.get('stripe-signature');if(!signature)return NextResponse.json({error:'Missing Stripe signature'},{status:400});
  const event=stripe.webhooks.constructEvent(await req.text(),signature,process.env.STRIPE_WEBHOOK_SECRET);console.log('Stripe webhook',event.type,event.data?.object?.id||'');
  let orderId=null;if(event.type==='payment_intent.succeeded')orderId=await persistPaymentIntent(stripe,event.data.object);
  if(orderId){
    await sendOrderEmail(orderId,'confirmation');
    await sendNewOrderAdminEmail(orderId);
    await sendOrderPush(orderId);
  }
  return NextResponse.json({received:true,orderId});
 }catch(e){console.error('Stripe webhook error',e);return NextResponse.json({error:'Webhook processing failed'},{status:400})}
}