import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';

async function authorised(){const jar=await cookies();return isAdminValue(jar.get('edible_admin')?.value)}

export async function GET(){
  if(!await authorised())return NextResponse.json({error:'Unauthorized'},{status:401});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('order_events').select('order_id').eq('event_type','admin_order_seen').limit(1000);
  if(error)return NextResponse.json({error:'Could not load seen orders'},{status:500});
  return NextResponse.json({seen:[...new Set((data||[]).map(x=>x.order_id).filter(Boolean))]});
}

export async function POST(req){
  if(!await authorised())return NextResponse.json({error:'Unauthorized'},{status:401});
  const {order_id}=await req.json().catch(()=>({}));
  if(!order_id)return NextResponse.json({error:'Missing order'},{status:400});
  const db=getSupabaseAdmin();
  const {data:existing}=await db.from('order_events').select('order_id').eq('order_id',order_id).eq('event_type','admin_order_seen').limit(1);
  if(!existing?.length){const {error}=await db.from('order_events').insert({order_id,event_type:'admin_order_seen',actor:'admin',details:{}});if(error)return NextResponse.json({error:'Could not mark order seen'},{status:500});}
  return NextResponse.json({ok:true});
}
