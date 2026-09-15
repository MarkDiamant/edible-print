import {NextResponse} from 'next/server';
import {adminToken} from '../../../../../lib/adminAuth';
import {verifyAdminMagicToken} from '../../../../../lib/adminMagicLink';

export async function GET(req){
  const token=req.nextUrl.searchParams.get('token');
  const data=verifyAdminMagicToken(token);
  if(!data)return NextResponse.redirect(new URL('/admin?link=invalid',req.url),303);
  const value=adminToken();
  if(!value)return NextResponse.redirect(new URL('/admin?link=invalid',req.url),303);
  const res=NextResponse.redirect(new URL('/admin',req.url),303);
  res.cookies.set('edible_admin',value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*12});
  return res;
}
