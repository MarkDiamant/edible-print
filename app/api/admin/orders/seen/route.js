import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';

async function authorised(){const jar=await cookies();return isAdminValue(jar.get('edible_admin')?.value)}

export async function GET(){
  if(!await authorised())return NextResponse.json({error:'Unauthorized'},{status:401});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('order_events').select('order_id,event_type,created_at').in('event_type',['admin_order_seen','admin_order_rehighlight']).order('created_at',{ascending:false}).limit(2000);
  if(error)return NextResponse.json({error:'Could not load seen orders'},{status:500});
  const state=new Map();for(const e of data||[])if(!state.has(e.order_id))state.set(e.order_id,e.event_type);
  return NextResponse.json({seen:[...state].filter(([,v])=>v==='admin_order_seen').map(([id])=>id),rehighlighted:[...state].filter(([,v])=>v==='admin_order_rehighlight').map(([id])=>id)});
}

export async function POST(req){
  if(!await authorised())return NextResponse.json({error:'Unauthorized'},{status:401});
  const {order_id,rehighlight=false}=await req.json().catch(()=>({}));
  if(!order_id)return NextResponse.json({error:'Missing order'},{status:400});
  const db=getSupabaseAdmin();
  const event_type=rehighlight?'admin_order_rehighlight':'admin_order_seen';
  const {error}=await db.from('order_events').insert({order_id,event_type,actor:'admin',details:{}});
  if(error)return NextResponse.json({error:'Could not update order highlight'},{status:500});
  return NextResponse.json({ok:true});
}
