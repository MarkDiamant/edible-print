import Stripe from 'stripe';
import {NextResponse} from 'next/server';
import {sendOrderEmail} from '../../../../lib/transactionalEmail';
import {persistPaymentIntent} from '../../../../lib/orderPersistence';
export const runtime='nodejs';
export async function POST(req){
 try{
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return NextResponse.json({error:'Webhook not configured'},{status:503});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY),signature=req.headers.get('stripe-signature');if(!signature)return NextResponse.json({error:'Missing Stripe signature'},{status:400});
  const event=stripe.webhooks.constructEvent(await req.text(),signature,process.env.STRIPE_WEBHOOK_SECRET);console.log('Stripe webhook',event.type,event.data?.object?.id||'');
  let orderId=null;if(event.type==='payment_intent.succeeded')orderId=await persistPaymentIntent(stripe,event.data.object);
  if(orderId)await sendOrderEmail(orderId,'confirmation');
  return NextResponse.json({received:true,orderId});
 }catch(e){console.error('Stripe webhook error',e);return NextResponse.json({error:'Webhook processing failed'},{status:400})}
}