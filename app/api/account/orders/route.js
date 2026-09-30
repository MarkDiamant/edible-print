import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';

export async function GET(req){
  const header=req.headers.get('authorization')||'';
  const accessToken=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!accessToken)return NextResponse.json({error:'Unauthorized'},{status:401});

  const db=getSupabaseAdmin();
  const {data:{user},error:authError}=await db.auth.getUser(accessToken);
  if(authError||!user?.email)return NextResponse.json({error:'Unauthorized'},{status:401});

  const {data,error}=await db
    .from('orders')
    .select('id,order_number,status,fulfilment_status,shipping_method,total_pence,currency,created_at,order_items(product_slug,product_title)')
    .ilike('email',user.email.trim())
    .order('created_at',{ascending:false});

  if(error)return NextResponse.json({error:'Could not load orders'},{status:500});
  return NextResponse.json({orders:data||[]});
}
