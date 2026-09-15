import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../../lib/orderNumber';

const CLICK_DROP_ORDERS='https://api.parcel.royalmail.com/api/v1/Orders';
const CLICK_DROP_URL='https://business.parcel.royalmail.com/orders';

function clean(v){return String(v||'').trim()}
function serviceCode(choice){
  if(choice==='express')return clean(process.env.ROYAL_MAIL_EXPRESS_SERVICE_CODE);
  return clean(process.env.ROYAL_MAIL_STANDARD_SERVICE_CODE);
}

export async function POST(req){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!process.env.ROYAL_MAIL_CLICK_DROP_API_KEY)return NextResponse.json({error:'Click & Drop is not configured'},{status:503});

  const body=await req.json().catch(()=>({}));
  const requested=Array.isArray(body.orders)?body.orders.slice(0,100):[];
  if(!requested.length)return NextResponse.json({error:'Select at least one order'},{status:400});

  const ids=[...new Set(requested.map(x=>clean(x.id)).filter(Boolean))];
  const choiceById=new Map(requested.map(x=>[clean(x.id),x.postage_service==='express'?'express':'standard']));
  const db=getSupabaseAdmin();
  const {data:orders,error:ordersError}=await db.from('orders').select('*').in('id',ids).eq('payment_status','paid');
  if(ordersError)return NextResponse.json({error:'Could not load selected orders'},{status:500});

  const prepared=[];
  const skipped=[];
  for(const order of orders||[]){
    if(order.shipping_method==='collection'||order.fulfilment_status==='fulfilled'){skipped.push(order.id);continue}
    const {data:existing}=await db.from('order_events').select('id').eq('order_id',order.id).eq('event_type','royal_mail_order_created').limit(1);
    if(existing?.length){skipped.push(order.id);continue}
    const {data:items,error:itemError}=await db.from('order_items').select('quantity').eq('order_id',order.id);
    if(itemError){skipped.push(order.id);continue}
    const sheetCount=Math.max(1,(items||[]).reduce((n,x)=>n+(Number(x.quantity)||0),0));
    const weightInGrams=83+Math.max(0,sheetCount-1)*30;
    if(weightInGrams>750){
      await db.from('order_events').insert({order_id:order.id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:'Calculated Large Letter weight exceeds 750g',sheet_count:sheetCount,weight_grams:weightInGrams}});
      skipped.push(order.id);continue;
    }
    const a=order.shipping_address||{};
    const choice=choiceById.get(order.id)|| (order.shipping_method==='express'?'express':'standard');
    const code=serviceCode(choice);
    const entry={
      orderReference:`EP-${formatOrderNumber(order.order_number)}`,
      orderDate:order.created_at||new Date().toISOString(),
      recipient:{address:{fullName:`${clean(order.first_name)} ${clean(order.last_name)}`.trim()||'Customer',addressLine1:clean(a.line1),addressLine2:clean(a.line2),addressLine3:'',city:clean(a.city),county:clean(a.state),postcode:clean(a.postal_code).toUpperCase(),countryCode:clean(a.country)||'GB'},phoneNumber:clean(order.phone),emailAddress:clean(order.email)},
      packages:[{weightInGrams,packageFormatIdentifier:'largeLetter',dimensions:{heightInMms:230,widthInMms:320,depthInMms:19}}],
      shippingCostCharged:Number(order.shipping_pence||0)/100,
      subtotal:Number(order.subtotal_pence||0)/100,
      total:Number(order.total_pence||0)/100,
      currencyCode:'GBP'
    };
    if(code)entry.postageDetails={serviceCode:code};
    prepared.push({order,choice,code,sheetCount,weightInGrams,entry});
  }

  if(!prepared.length)return NextResponse.json({ok:true,created:0,skipped:skipped.length,clickDropUrl:CLICK_DROP_URL});

  const response=await fetch(CLICK_DROP_ORDERS,{method:'POST',headers:{Authorization:process.env.ROYAL_MAIL_CLICK_DROP_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({items:prepared.map(x=>x.entry)}),cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return NextResponse.json({error:result?.message||`Royal Mail returned ${response.status}`},{status:502});

  const createdByRef=new Map((result.createdOrders||[]).map(x=>[x.orderReference,x]));
  let createdCount=0;
  for(const p of prepared){
    const created=createdByRef.get(p.entry.orderReference);
    if(created){
      createdCount++;
      await db.from('order_events').insert({order_id:p.order.id,event_type:'royal_mail_order_created',actor:'admin',details:{order_identifier:created.orderIdentifier||null,order_reference:created.orderReference||p.entry.orderReference,tracking_number:created.trackingNumber||null,sheet_count:p.sheetCount,weight_grams:p.weightInGrams,shipping_method:p.order.shipping_method,postage_choice:p.choice,service_code:p.code||null,bulk:true}});
    }else{
      const failed=(result.failedOrders||[]).find(x=>x.orderReference===p.entry.orderReference);
      await db.from('order_events').insert({order_id:p.order.id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:failed?.errors?.[0]?.message||'Royal Mail did not create this order',sheet_count:p.sheetCount,weight_grams:p.weightInGrams,postage_choice:p.choice,bulk:true}});
    }
  }

  return NextResponse.json({ok:true,created:createdCount,skipped:skipped.length,postageApplied:prepared.every(x=>Boolean(x.code)),clickDropUrl:CLICK_DROP_URL});
}
