import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
export const dynamic='force-dynamic';
export async function GET(request){
 const jar=await cookies();
 if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorised'},{status:401});
 const key=process.env.RESEND_API_KEY;

 const {searchParams}=new URL(request.url);
 const id=searchParams.get('id');
 if(id&&!/^[a-f0-9-]{20,80}$/i.test(id))return NextResponse.json({error:'Invalid email ID'},{status:400});
 const after=searchParams.get('after');
 if(after&&!/^[a-f0-9-]{20,80}$/i.test(after))return NextResponse.json({error:'Invalid cursor'},{status:400});
 const endpoint=id?'https://api.resend.com/emails/'+encodeURIComponent(id):'https://api.resend.com/emails?limit=100'+(after?'&after='+encodeURIComponent(after):'');
 try{
  if(!key)return await localHistory(id);
  const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+key},cache:'no-store'});
  const data=await response.json();
  if(!response.ok)return await localHistory(id);
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return await localHistory(id)}
}

async function localHistory(id){
 const db=getSupabaseAdmin();
 const {data,error}=await db.from('order_events').select('details,created_at').like('event_type','email_%').order('created_at',{ascending:false}).limit(500);
 if(error)return NextResponse.json({error:'Email history unavailable'},{status:502});
 const items=(data||[]).filter(e=>e.details?.resend_id&&e.details?.email_subject).map(e=>({id:e.details.resend_id,subject:e.details.email_subject,to:[e.details.to||''],from:'Edible Print',created_at:e.created_at,last_event:e.details.scheduled_at&&new Date(e.details.scheduled_at)>new Date()?'scheduled':'sent (delivery unverified)',text:e.details.email_text||''}));
 return NextResponse.json(id?items.find(e=>e.id===id)||{error:'Message not found'}:{data:items.slice(0,100)});
}
