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
async function remoteOrderExists(apiKey,details={}){
  const identifier=details.order_identifier||details.order_reference;
  if(!identifier)return false;
  const token=details.order_identifier?String(identifier):`"${encodeURIComponent(String(identifier))}"`;
  try{
    const response=await fetch(`${CLICK_DROP_ORDERS}/${token}`,{headers:{Authorization:apiKey},cache:'no-store'});
    if(response.status===404)return false;
    if(!response.ok)return true;
    const result=await response.json().catch(()=>null);
    if(Array.isArray(result))return result.length>0;
    if(Array.isArray(result?.orders))return result.orders.length>0;
    return true;
  }catch{return true}
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

  const {data:existing}=await db.from('order_events').select('details,created_at').eq('order_id',id).eq('event_type','royal_mail_order_created').order('created_at',{ascending:false}).limit(1);
  if(existing?.length){
    const stillThere=await remoteOrderExists(apiKey,existing[0].details||{});
    if(stillThere)return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=exists`,req.url),303);
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_deleted',actor:'sync',details:{...(existing[0].details||{}),message:'Order no longer exists in Click & Drop'}});
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
  const orderRef=`EP-${formatOrderNumber(order.order_number)}`;
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
    const created=result?.createdOrders?.[0];
    if(!response.ok||!created||result?.errorsCount>0){
      const message=result?.failedOrders?.[0]?.errors?.[0]?.message||result?.message||`Royal Mail returned ${response.status}`;
      console.error('Click & Drop order export failed',response.status,message);
      await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(message).slice(0,500),sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code}});
      return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
    }
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_created',actor:'admin',details:{order_identifier:created.orderIdentifier||null,order_reference:created.orderReference||orderRef,tracking_number:created.trackingNumber||null,sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=created`,req.url),303);
  }catch(error){
    console.error('Click & Drop order export error',error);
    await db.from('order_events').insert({order_id:id,event_type:'royal_mail_order_failed',actor:'admin',details:{message:String(error?.message||error).slice(0,500),sheet_count:sheetCount,weight_grams:weightInGrams,shipping_method:order.shipping_method,postage_choice:postageChoice,service_code:code}});
    return NextResponse.redirect(new URL(`/admin/orders/${id}?rm=failed`,req.url),303);
  }
}
