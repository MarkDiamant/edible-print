import Stripe from 'stripe';
import {NextResponse} from 'next/server';

const COMMERCE_URL='https://diiqajrvlalkggjlutyn.supabase.co/functions/v1/commerce';

export async function POST(req){
  try{
    if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'Stripe is not configured yet.'},{status:503});
    const {cartId,accessToken,delivery}=await req.json();
    if(!cartId||!accessToken)return NextResponse.json({error:'Basket is invalid'},{status:400});

    const snapshotRes=await fetch(COMMERCE_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'checkout_snapshot',cartId,accessToken,delivery}),cache:'no-store'});
    const snapshot=await snapshotRes.json();
    if(!snapshotRes.ok)return NextResponse.json({error:snapshot.error||'Basket could not be verified'},{status:snapshotRes.status});

    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(req.url).origin;
    const lineItems=snapshot.items.map(item=>({
      quantity:item.quantity,
      price_data:{currency:'gbp',unit_amount:item.unit_price_pence,product_data:{name:item.product_title,description:item.variant_label}}
    }));
    if(snapshot.shipping>0)lineItems.push({quantity:1,price_data:{currency:'gbp',unit_amount:snapshot.shipping,product_data:{name:snapshot.delivery==='express'?'Express delivery':'Standard delivery'}}});

    const session=await stripe.checkout.sessions.create({
      mode:'payment',
      customer_creation:'always',
      billing_address_collection:'auto',
      shipping_address_collection:{allowed_countries:['GB']},
      phone_number_collection:{enabled:true},
      line_items:lineItems,
      metadata:{site:'edible-print',cart_id:cartId,delivery:snapshot.delivery},
      payment_intent_data:{metadata:{site:'edible-print',cart_id:cartId}},
      success_url:origin+'/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:origin+'/cart'
    });
    return NextResponse.json({url:session.url});
  }catch(e){
    console.error(e);
    return NextResponse.json({error:'Could not start checkout'},{status:500});
  }
}
