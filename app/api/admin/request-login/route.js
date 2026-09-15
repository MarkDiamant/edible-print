import {NextResponse} from 'next/server';
import {createAdminMagicToken,isAllowedAdminEmail} from '../../../../../lib/adminMagicLink';

export async function POST(req){
  try{
    const {email}=await req.json();
    if(!isAllowedAdminEmail(email))return NextResponse.json({error:'This email address is not authorised for the Edible Print admin.'},{status:403});
    if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'Email delivery is not configured.'},{status:500});
    const token=createAdminMagicToken(email);
    const link=`${req.nextUrl.origin}/api/admin/email-login?token=${encodeURIComponent(token)}`;
    const r=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'Edible Print <noreply@edibleprint.uk>',
        to:['hello@edibleprint.uk'],
        subject:'Your Edible Print admin sign-in link',
        html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#2a2a2a"><h2 style="margin:0 0 12px">Edible Print admin</h2><p>Use the secure button below to sign in to your admin area.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#7f9777;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">Sign in to admin</a></p><p style="font-size:13px;color:#666">This link expires in 15 minutes. If you did not request it, you can ignore this email.</p></div>`,
        text:`Edible Print admin sign-in\n\nOpen this secure link to sign in: ${link}\n\nThis link expires in 15 minutes.`
      })
    });
    if(!r.ok){const body=await r.text();console.error('admin_login_email_failed',r.status,body);return NextResponse.json({error:'Could not send the sign-in email.'},{status:500});}
    return NextResponse.json({ok:true});
  }catch(e){console.error('admin_login_request_failed',e);return NextResponse.json({error:'Could not send the sign-in email.'},{status:500});}
}
