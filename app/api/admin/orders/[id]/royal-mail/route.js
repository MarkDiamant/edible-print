import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../../../lib/orderNumber';

const CLICK_DROP_ORDERS='https://api.parcel.royalmail.com/api/v1/Orders';

function clean(v){return String(v||'').trim()}
function serviceCode(choice){
  if(choice==='express')return clean(process.env.ROYAL_MAIL_EXPRESS_SERVICE_CODE)||'TPN24';
  return clean(process.env.ROYAL_MAIL_STANDARD_SERVICE_CODE)||'TPS48';
}
function normaliseCreated(result,orderRef){
  const candidates=[];
  if(Array.isArray(result?.createdOrders))candidates.push(...result.createdOrders);
  if(Array.isArray(result?.orders))candidates.push(...result.orders);
  if(Array.isArray(result))candidates.push(...result);
  if(result&&typeof result==='object'&&!Array.isArray(result)&&!result.createdOrders&&!result.orders)candidates.push(result);
  return candidates.find(x=>clean(x?.orderReference)===orderRef)||candidates[0]||null;
}
async function fetchByReference(apiKey,orderRef){
  const token=`%22${encodeURIComponent(orderRef)}%22`;
  for(let attempt=0;attempt<3;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,450));
    try{
      const response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{headers:{Authorization:apiKey},cache:'no-store'});
      if(response.status===404)continue;
      if(!response.ok)continue;
      const result=await response.json().catch(()=>null);
      const created=normaliseCreated(result,orderRef);
      if(created)return created;
    }catch{}
  }
  return null;
}

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();

  const {data:order}=await db.from('orders').select('*').eq('id',id).eq('payment_status','paid').maybeSingle();
  if(!order)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=missing`,req.url),303);
  if(order.shipping_method==='collection')return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=collection`,req.url),303);

  const form=await req.formData().catch(()=>null);
  const requested=clean(form?.get('postage_service')).toLowerCase();
  const postageChoice=['standard','express'].includes(requested)?requested:(order.shipping_method==='express'?'express':'standard');

  const apiKey=process.env.ROYAL_MAIL_CLICK_DROP_API_KEY;
  if(!apiKey)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=config`,req.url),303);

  const {data:rmStateEvents}=await db.from('order_events')
    .select('event_type,details,created_at')
    .eq('order_id',id)
    .in('event_type',['royal_mail_order_created','royal_mail_order_deleted'])
    .order('created_at',{ascending:false})
    .limit(100);

  const createdEvents=(rmStateEvents||[]).filter(e=>e.event_type==='royal_mail_order_created');
  const latestState=rmStateEvents?.[0]||null;

  // Prevent only a true rapid double-submit. Historical/deleted Click & Drop records must not
  // block a replacement order because Royal Mail may continue surfacing them for a short time.
  if(latestState?.event_type==='royal_mail_order_created'){
    const ageMs=Date.now()-new Date(latestState.created_at).getTime();
    if(Number.isFinite(ageMs)&&ageMs>=0&&ageMs<15000){
      return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=exists`,req.url),303);
    }
  }

  const {data:items,error:itemError}=await db.from('order_items').select('quantity').eq('order_id',id);
  if(itemError)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
  const sheetCount=Math.max(1,(items||[]).reduce((n,x)=>n+(Number(x.quantity)||0),0));
  const weightInGrams=83+Math.max(0,sheetCount-1)*30;
  if(weightInGrams>750){
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:'Calculated Large Letter weight exceeds 750g',sheet_count:sheetCount,weight_grams:weightInGrams,postage_choice:postageChoice}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=weight`,req.url),303);
  }

  const a=order.shipping_address||{};
  const customerName=`${clean(order.first_name)} ${clean(order.last_name)}`.trim()||'Customer';
  const baseRef=`EP-${formatOrderNumber(order.order_number)}`;
  const replacementNumber=createdEvents.length+1;
  const nonce=Date.now().toString().slice(-6);
  const orderRef=createdEvents.length?`${baseRef}-R${replacementNumber}-${nonce}`:baseRef;
  const code=serviceCode(postageChoice);
  const payload={items:[{
    orderReference:orderRef,
    orderDate:order.created_at||new Date().toISOString(),
    recipient:{
      address:{
        fullName:customerName,
        addressLine1:clean(a.line1),
        addressLine2:clean(a.line2),
        addressLine3:'',
        city:clean(a.city),
        county:clean(a.state),
        postcode:clean(a.postal_code).toUpperCase(),
        countryCode:clean(a.country)||'GB'
      },
      phoneNumber:clean(order.phone),
      emailAddress:clean(order.email)
    },
    packages:[{
      weightInGrams,
      packageFormatIdentifier:'largeLetter',
      dimensions:{heightInMms:230,widthInMms:320,depthInMms:19}
    }],
    postageDetails:{serviceCode:code},
    shippingCostCharged:Number(order.shipping_pence||0)/100,
    subtotal:Number(order.subtotal_pence||0)/100,
    total:Number(order.total_pence||0)/100,
    currencyCode:'GBP'
  }]};

  try{
    const response=await fetch(CLICK_DROP_ORDERS,{method:'POST',headers:{Authorization:apiKey,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
    const result=await response.json().catch(()=>({}));
    let created=normaliseCreated(result,orderRef);

    // Click & Drop sometimes returns HTTP 200 without the older createdOrders envelope.
    // A 200 is not an error by itself: verify the fresh unique reference before failing.
    if(response.ok&&!created)created=await fetchByReference(apiKey,orderRef);

    if(!response.ok||!created||Number(result?.errorsCount||0)>0){
      const message=result?.failedOrders?.[0]?.errors?.[0]?.message||result?.errors?.[0]?.message||result?.message||`Royal Mail returned ${response.status} but the new order could not be verified`;
      console.error('Click & Drop order export failed',response.status,message);
      await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(message).slice(0,500),sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code,order_reference:orderRef}});
      return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
    }

    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_created',actor:'admin',details:{order_identifier:created.orderIdentifier||created.orderId||created.id||null,order_reference:created.orderReference||orderRef,tracking_number:created.trackingNumber||null,sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code,replacement_number:createdEvents.length?replacementNumber:null}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=created`,req.url),303);
  }catch(error){
    console.error('Click & Drop order export error',error);
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(error?.message||error).slice(0,500),sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code,order_reference:orderRef}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
  }
}
