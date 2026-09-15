import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
import {adminToken} from '../../../../lib/adminAuth';

const DEFAULT_ADMIN_EMAILS=['hello@edibleprint.uk'];

function allowedEmails(){
  const configured=String(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS,...configured]);
}

export async function POST(req){
  const auth=req.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)return NextResponse.json({error:'Missing session'},{status:401});

  const db=getSupabaseAdmin();
  const {data,error}=await db.auth.getUser(token);
  const email=data?.user?.email?.toLowerCase();
  if(error||!email)return NextResponse.json({error:'Invalid session'},{status:401});
  if(!allowedEmails().has(email))return NextResponse.json({error:'Not authorised'},{status:403});

  const value=adminToken();
  if(!value)return NextResponse.json({error:'Admin access is not configured'},{status:500});

  const res=NextResponse.json({ok:true});
  res.cookies.set('edible_admin',value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*12});
  return res;
}
