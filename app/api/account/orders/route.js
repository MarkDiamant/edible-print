import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';

export async function GET(){
  const jar=await cookies();
  const token=jar.getAll().find(c=>c.name.startsWith('sb-')&&c.name.endsWith('-auth-token'))?.value;
  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{global:{headers:token?{Authorization:`Bearer ${JSON.parse(decodeURIComponent(token))[0]}`}:{}}});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user?.email)return NextResponse.json({error:'Unauthorized'},{status:401});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('orders').select('id,order_number,status,fulfilment_status,shipping_method,total_pence,currency,created_at,order_items(product_slug,product_title)').ilike('email',user.email.trim()).order('created_at',{ascending:false});
  if(error)return NextResponse.json({error:'Could not load orders'},{status:500});
  return NextResponse.json({orders:data||[]});
}
