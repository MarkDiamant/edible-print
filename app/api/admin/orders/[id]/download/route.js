import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../../../../lib/orderNumber';

export async function GET(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('*').eq('id',id).maybeSingle();
  if(!order)return NextResponse.json({error:'Order not found'},{status:404});
  const {data:items}=await db.from('order_items').select('*').eq('order_id',id).order('created_at');
  const {data:artwork}=await db.from('artwork').select('order_item_id,original_filename').eq('order_id',id).order('created_at');
  const {data:events}=await db.from('order_events').select('event_type,details,created_at').eq('order_id',id).order('created_at');
  const number=formatOrderNumber(order.order_number);
  const name=`${order.first_name||''} ${order.last_name||''}`.trim();
  const a=order.shipping_address||{};
  const lines=[
    `EDIBLE PRINT ORDER #${number}`,
    `Date: ${new Date(order.created_at).toLocaleString('en-GB',{timeZone:'Europe/London'})}`,
    `Payment: ${order.payment_status}`,
    `Fulfilment: ${order.fulfilment_status}`,
    '',
    'CUSTOMER',name,order.email||'',order.phone||'',
    '',
    'DELIVERY',order.shipping_method||'',...[a.line1,a.line2,a.city,a.state,a.postal_code,a.country].filter(Boolean),
    '',
    'ITEMS'
  ];
  for(const item of items||[]){
    lines.push(`${item.product_title} | ${item.variant_label||''} | Qty ${item.quantity}`);
    for(const art of (artwork||[]).filter(x=>x.order_item_id===item.id))lines.push(`  Artwork: ${art.original_filename}`);
    const ins=(events||[]).find(e=>e.event_type==='artwork_instructions'&&e.details?.source_draft_item_id===item.source_draft_item_id)?.details?.instructions;
    if(ins)lines.push(`  Instructions:\n${ins}`);
  }
  const customerMessage=(events||[]).find(e=>e.event_type==='customer_message')?.details?.message;
  if(customerMessage)lines.push('','CUSTOMER MESSAGE',customerMessage);
  lines.push('','TOTALS',`Subtotal: £${(order.subtotal_pence/100).toFixed(2)}`,`Shipping: £${(order.shipping_pence/100).toFixed(2)}`,`Total: £${(order.total_pence/100).toFixed(2)}`);
  return new NextResponse(lines.join('\n'),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="edible-print-order-${number}.txt"`}});
}
