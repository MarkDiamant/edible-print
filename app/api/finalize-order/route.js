import Stripe from 'stripe';
import {NextResponse} from 'next/server';
import {persistPaymentIntent} from '../../../lib/orderPersistence';
import {sendOrderEmail} from '../../../lib/transactionalEmail';
export const runtime='nodejs';
export async function POST(req){
 try{if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'Stripe not configured'},{status:503});const {paymentIntentId}=await req.json();if(!paymentIntentId)return NextResponse.json({error:'Missing payment intent'},{status:400});const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const pi=await stripe.paymentIntents.retrieve(paymentIntentId);if(pi.status!=='succeeded')return NextResponse.json({error:'Payment is not complete'},{status:409});const orderId=await persistPaymentIntent(stripe,pi,'payment_success_recovery');await sendOrderEmail(orderId,'confirmation');return NextResponse.json({ok:true,orderId})}catch(e){console.error('Finalize order error',e);return NextResponse.json({error:'Could not finalise order'},{status:500})}
}