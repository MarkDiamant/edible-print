import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('id').eq('id',id).maybeSingle();
  if(!order)return NextResponse.json({error:'Order not found'},{status:404});
  const {data:existing}=await db.from('order_events').select('id').eq('order_id',id).eq('event_type','return_recorded').maybeSingle();
  if(existing)return NextResponse.redirect(new URL(`/admin/orders/${id}?return=exists`,req.url),303);
  await db.from('orders').update({status:'returned',fulfilment_status:'returned'}).eq('id',id);
  await db.from('order_events').insert({order_id:id,event_type:'return_recorded',actor:'admin',details:{}});
  return NextResponse.redirect(new URL(`/admin/orders/${id}?return=done`,req.url),303);
}
