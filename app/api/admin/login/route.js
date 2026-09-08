import {NextResponse} from 'next/server';
import {adminToken} from '../../../../lib/adminAuth';

export async function POST(req){
  const form=await req.formData();
  const password=String(form.get('password')||'');
  if(!process.env.ADMIN_PASSWORD||password!==process.env.ADMIN_PASSWORD)return NextResponse.redirect(new URL('/admin?error=1',req.url),303);
  const res=NextResponse.redirect(new URL('/admin',req.url),303);
  res.cookies.set('edible_admin',adminToken(),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:60*60*8});
  return res;
}
