import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../../../lib/orderNumber';

export const runtime='nodejs';

const money=p=>`£${(Number(p||0)/100).toFixed(2)}`;
const clean=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();

export async function GET(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)return NextResponse.json({error:'Order not found'},{status:404});
  const {data:items}=await db.from('order_items').select('*').eq('order_id',id).order('created_at');
  const number=order.source_order_name?String(order.source_order_name).replace(/^#/,''):formatOrderNumber(order.order_number);
  const name=`${order.first_name||''} ${order.last_name||''}`.trim();
  const a=order.shipping_address||{};
  const address=[a.line1||a.address1,a.line2||a.address2,a.city,a.state||a.province,a.postal_code||a.zip,a.country].filter(Boolean).map(clean);
  const isCollection=order.shipping_method==='collection';

  const pdf=await PDFDocument.create();
  const page=pdf.addPage([595.28,841.89]);
  const {width,height}=page.getSize();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const sage=rgb(0.38,0.49,0.35), dark=rgb(0.17,0.19,0.17), muted=rgb(0.42,0.44,0.41), line=rgb(0.88,0.89,0.86), cream=rgb(0.97,0.96,0.92);
  let y=height-52;

  try{
    const logoRes=await fetch(new URL('/logo.png',new URL(req.url).origin),{cache:'no-store'});
    if(logoRes.ok){
      const bytes=await logoRes.arrayBuffer();
      const logo=await pdf.embedPng(bytes);
      const s=logo.scaleToFit(145,58);
      page.drawImage(logo,{x:48,y:y-s.height+12,width:s.width,height:s.height});
    }else throw new Error('logo');
  }catch{
    page.drawText('EDIBLE PRINT',{x:48,y:y-8,size:20,font:bold,color:sage});
  }

  page.drawText('PAID INVOICE',{x:width-190,y,size:11,font:bold,color:sage});
  page.drawText(`Invoice #${number}`,{x:width-190,y:y-24,size:18,font:bold,color:dark});
  page.drawText(new Date(order.created_at).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'long',year:'numeric'}),{x:width-190,y:y-43,size:10,font:regular,color:muted});
  y-=92;
  page.drawLine({start:{x:48,y},end:{x:width-48,y},thickness:1,color:line});

  y-=30;
  page.drawText('BILLED TO',{x:48,y,size:9,font:bold,color:sage});
  page.drawText('ORDER DETAILS',{x:330,y,size:9,font:bold,color:sage});
  y-=20;
  page.drawText(name||'Customer',{x:48,y,size:11,font:bold,color:dark});
  let ay=y-17;
  if(order.email){page.drawText(clean(order.email),{x:48,y:ay,size:9.5,font:regular,color:muted});ay-=15;}
  if(order.phone){page.drawText(clean(order.phone),{x:48,y:ay,size:9.5,font:regular,color:muted});ay-=15;}
  for(const l of address){page.drawText(l,{x:48,y:ay,size:9.5,font:regular,color:muted});ay-=15;}
  page.drawText(`Order #${number}`,{x:330,y,size:10,font:bold,color:dark});
  page.drawText(`Payment: ${clean(order.payment_status).toUpperCase()}`,{x:330,y:y-18,size:9.5,font:regular,color:muted});
  page.drawText(`Delivery: ${isCollection?'Collection':order.shipping_method==='express'?'Express':'Standard'}`,{x:330,y:y-35,size:9.5,font:regular,color:muted});

  y=Math.min(ay,y-58)-22;
  page.drawRectangle({x:48,y:y-28,width:width-96,height:28,color:cream});
  page.drawText('ITEM',{x:58,y:y-18,size:9,font:bold,color:dark});
  page.drawText('QTY',{x:385,y:y-18,size:9,font:bold,color:dark});
  page.drawText('PRICE',{x:435,y:y-18,size:9,font:bold,color:dark});
  page.drawText('TOTAL',{x:500,y:y-18,size:9,font:bold,color:dark});
  y-=44;

  for(const item of items||[]){
    const title=clean(item.product_title);
    const variant=clean(item.variant_label);
    const maxChars=52;
    page.drawText(title.length>maxChars?title.slice(0,maxChars-1)+'…':title,{x:58,y,size:10,font:bold,color:dark});
    if(variant)page.drawText(variant.length>58?variant.slice(0,57)+'…':variant,{x:58,y:y-16,size:8.5,font:regular,color:muted});
    page.drawText(String(item.quantity||1),{x:390,y,size:10,font:regular,color:dark});
    page.drawText(money(item.unit_price_pence),{x:435,y,size:10,font:regular,color:dark});
    page.drawText(money(Number(item.unit_price_pence||0)*Number(item.quantity||1)),{x:500,y,size:10,font:bold,color:dark});
    y-=variant?43:31;
    page.drawLine({start:{x:58,y:y+10},end:{x:width-58,y:y+10},thickness:.6,color:line});
  }

  y-=12;
  const labelX=390,valueX=500;
  page.drawText('Subtotal',{x:labelX,y,size:10,font:regular,color:muted});page.drawText(money(order.subtotal_pence),{x:valueX,y,size:10,font:regular,color:dark});y-=20;
  page.drawText(isCollection?'Collection':'Shipping',{x:labelX,y,size:10,font:regular,color:muted});page.drawText(order.shipping_pence?money(order.shipping_pence):'FREE',{x:valueX,y,size:10,font:regular,color:dark});y-=27;
  page.drawLine({start:{x:labelX,y:y+12},end:{x:width-48,y:y+12},thickness:1,color:line});
  page.drawText('TOTAL PAID',{x:labelX,y,size:11,font:bold,color:dark});page.drawText(money(order.total_pence),{x:valueX,y,size:12,font:bold,color:sage});

  page.drawText('Thank you for your order.',{x:48,y:64,size:11,font:bold,color:dark});
  page.drawText('Edible Print  •  edibleprint.uk  •  hello@edibleprint.uk',{x:48,y:45,size:9,font:regular,color:muted});

  const bytes=await pdf.save();
  return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="edible-print-invoice-${number}.pdf"`,'Cache-Control':'no-store'}});
}
