import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';

export async function GET(){
  const jar=await cookies();
  const authCookie=jar.getAll().find(c=>c.name.startsWith('sb-')&&c.name.endsWith('-auth-token'))?.value;
  let accessToken='';try{const raw=decodeURIComponent(authCookie||'');const parsed=JSON.parse(raw.startsWith('base64-')?Buffer.from(raw.slice(7),'base64').toString():raw);accessToken=Array.isArray(parsed)?parsed[0]:(parsed?.access_token||'')}catch{}
  if(!accessToken)return NextResponse.json({error:'Unauthorized'},{status:401});
  const authResponse=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  const user=authResponse.ok?await authResponse.json():null;
  if(!user?.email)return NextResponse.json({error:'Unauthorized'},{status:401});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('orders').select('id,order_number,status,fulfilment_status,shipping_method,total_pence,currency,created_at,order_items(product_slug,product_title)').ilike('email',user.email.trim()).order('created_at',{ascending:false});
  if(error)return NextResponse.json({error:'Could not load orders'},{status:500});
  return NextResponse.json({orders:data||[]});
}
