import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../../lib/supabaseAdmin';
import {sendOrderEmail} from '../../../../../../lib/transactionalEmail';

const allowed={processing:{status:'processing',fulfilment_status:'processing',emailType:'processing'},ready:{status:'ready',fulfilment_status:'ready',emailType:'ready'},fulfilled:{status:'fulfilled',fulfilment_status:'fulfilled',emailType:'dispatched'}};

export async function POST(req,{params}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const form=await req.formData();
  const action=String(form.get('action')||'');
  const change=allowed[action];
  if(!change)return NextResponse.json({error:'Invalid status'},{status:400});
  const db=getSupabaseAdmin();
  const {data:order}=await db.from('orders').select('shipping_method').eq('id',id).eq('payment_status','paid').maybeSingle();
  if(!order)return NextResponse.json({error:'Paid order not found'},{status:404});
  const update={status:change.status,fulfilment_status:change.fulfilment_status};
  if(action==='fulfilled')update.fulfilled_at=new Date().toISOString();
  const {error}=await db.from('orders').update(update).eq('id',id).eq('payment_status','paid');
  if(error)return NextResponse.json({error:'Could not update order'},{status:500});
  await db.from('order_events').insert({order_id:id,event_type:`fulfilment_${action}`,actor:'admin',details:{}});
  const emailType=action==='fulfilled'&&order.shipping_method==='collection'?'collected':change.emailType;
  try{
    await sendOrderEmail(id,emailType);
    if(action==='fulfilled'){
      const feedbackAt=new Date(Date.now()+5*24*60*60*1000).toISOString();
      await sendOrderEmail(id,'feedback',{scheduledAt:feedbackAt});
    }
  }catch(emailError){
    console.error('Order status email error',emailError);
    await db.from('order_events').insert({order_id:id,event_type:'email_failed',actor:'system',details:{type:emailType,message:String(emailError?.message||emailError)}});
  }
  return NextResponse.redirect(new URL(`/admin/orders/${id}`,req.url),303);
}
