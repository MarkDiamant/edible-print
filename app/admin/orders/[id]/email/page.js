import {cookies} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';

export const dynamic='force-dynamic';

export default async function SentEmail({params,searchParams}){
  const jar=await cookies();
  if(!isAdminValue(jar.get('edible_admin')?.value))redirect('/admin');
  const {id}=await params;
  const q=await searchParams;
  const when=String(q?.event||'');
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('order_events').select('event_type,details,created_at').eq('order_id',id).eq('created_at',when).maybeSingle();
  if(!event?.details?.email_html)notFound();
  const d=event.details||{};
  return <main style={{maxWidth:900,margin:'0 auto',padding:'24px 20px 50px'}}>
    <p><a href={`/admin/orders/${id}`}>← Back to order</a></p>
    <h1 style={{fontSize:26,marginBottom:6}}>Sent email</h1>
    <p style={{color:'#666',marginTop:0}}><strong>To:</strong> {d.to||'Customer'}<br/><strong>Subject:</strong> {d.email_subject||''}<br/><strong>Sent:</strong> {new Date(event.created_at).toLocaleString('en-GB',{timeZone:'Europe/London'})}</p>
    <div style={{marginTop:20,border:'1px solid #ddd',borderRadius:12,overflow:'hidden',background:'#fff'}}>
      <iframe title="Sent customer email" srcDoc={d.email_html} style={{display:'block',width:'100%',height:760,border:0}}/>
    </div>
  </main>;
}
