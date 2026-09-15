import {NextResponse} from 'next/server';

export async function POST(req){
  const res=NextResponse.redirect(new URL('/admin',req.url),303);
  res.cookies.set('edible_admin','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
  return res;
}
