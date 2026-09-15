import {NextResponse} from 'next/server';

export const runtime='nodejs';

export async function GET(req){
  const token=new URL(req.url).searchParams.get('token');
  if(token!=='ep_test_9a1d6f42b7')return NextResponse.json({error:'Not found'},{status:404});
  if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'RESEND_API_KEY missing'},{status:503});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Edible Print <noreply@edibleprint.uk>',to:['markdiamant@gmail.com'],subject:'Edible Print transactional email test',text:'Edible Print transactional email configuration is working correctly.'})});
  const body=await response.json().catch(()=>({}));
  return NextResponse.json({ok:response.ok,status:response.status,id:body.id||null,error:response.ok?null:(body.message||'Send failed')},{status:response.ok?200:500});
}
