import Stripe from 'stripe';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function POST(req){
 try{
  if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'Payments unavailable'},{status:503});
  const {clientSecret,address,name,phone}=await req.json();
  const id=typeof clientSecret==='string'?clientSecret.split('_secret_')[0]:'';
  if(!/^pi_[A-Za-z0-9]+$/.test(id)||!clientSecret.startsWith(id+'_secret_'))return NextResponse.json({error:'Invalid payment session'},{status:400});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const pi=await stripe.paymentIntents.retrieve(id);
  if(pi.client_secret!==clientSecret||pi.status!=='requires_payment_method')return NextResponse.json({error:'Payment session is no longer editable'},{status:409});
  if(pi.metadata?.site!=='edible-print')return NextResponse.json({error:'Invalid order'},{status:400});
  if(pi.metadata?.delivery==='collection')return NextResponse.json({ok:true});
  const a=address||{};
  if(!String(a.line1||'').trim()||!String(a.city||'').trim()||!String(a.postal_code||'').trim()||a.country!=='GB')return NextResponse.json({error:'Please enter a full UK delivery address, including street, town and postcode.'},{status:400});
  await stripe.paymentIntents.update(id,{shipping:{name:String(name||'').trim(),phone:String(phone||'').trim()||undefined,address:{line1:String(a.line1).trim(),line2:String(a.line2||'').trim()||undefined,city:String(a.city).trim(),postal_code:String(a.postal_code).trim(),state:String(a.state||'').trim()||undefined,country:'GB'}}});
  return NextResponse.json({ok:true});
 }catch(e){console.error('Shipping address save failed',e);return NextResponse.json({error:'Could not save delivery address. Please try again.'},{status:500})}
}
