import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '../../../lib/supabaseAdmin';
import {formatOrderNumber} from '../../../lib/orderNumber';
export const dynamic='force-dynamic';
export async function GET(request){
 const token=new URL(request.url).searchParams.get('token')||'';
 const origin=request.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':['https://www.woulduseagain.com','https://woulduseagain.com'].includes(origin)?origin:'https://www.woulduseagain.com','Vary':'Origin','Cache-Control':'no-store'};
 if(!/^[0-9a-f-]{36}[0-9a-f]{32}$/i.test(token))return NextResponse.json({error:'Invalid invitation'},{status:400,headers});
 const db=getSupabaseAdmin();
 const {data:events,error}=await db.from('order_events').select('order_id,details').eq('event_type','feedback_prefill_token').contains('details',{token}).limit(1);
 if(error||!events?.length)return NextResponse.json({error:'Invitation not found'},{status:404,headers});
 const {data:order}=await db.from('orders').select('id,first_name,last_name,email,phone,order_number,fulfilled_at,completed_at,payment_status').eq('id',events[0].order_id).eq('payment_status','paid').maybeSingle();
 if(!order)return NextResponse.json({error:'Order unavailable'},{status:404,headers});
 const {data:items}=await db.from('order_items').select('product_title,quantity').eq('order_id',order.id);
 return NextResponse.json({customerName:[order.first_name,order.last_name].filter(Boolean).join(' '),customerEmail:order.email||'',customerPhone:order.phone||'',workDescription:'Edible prints, order '+formatOrderNumber(order.order_number||order.id)+(items?.length?' ('+items.map(i=>i.product_title).filter(Boolean).join(', ').slice(0,180)+')':''),approximateCompletionDate:(order.completed_at||order.fulfilled_at||'').slice(0,10)},{headers});
}
