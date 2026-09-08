import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';

const allowed={processing:{status:'processing',fulfilment_status:'processing'},ready:{status:'ready',fulfilment_status:'ready'},fulfilled:{status:'fulfilled',fulfilment_status:'fulfilled'}};

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const form=await req.formData();
  const action=String(form.get('action')||'');
  const change=allowed[action];
  if(!change)return NextResponse.json({error:'Invalid status'},{status:400});
  const db=getSupabaseAdmin();
  const update={...change};
  if(action==='fulfilled')update.fulfilled_at=new Date().toISOString();
  const {error}=await db.from('orders').update(update).eq('id',id).eq('payment_status','paid');
  if(error)return NextResponse.json({error:'Could not update order'},{status:500});
  await db.from('order_events').insert({order_id:id,event_type:`fulfilment_${action}`,actor:'admin',details:{}});
  return NextResponse.redirect(new URL(`/admin/orders/${id}`,req.url),303);
}
