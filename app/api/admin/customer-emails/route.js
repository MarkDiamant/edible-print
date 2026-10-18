import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../lib/adminAuth';
export const dynamic='force-dynamic';
export async function GET(request){
 const jar=await cookies();
 if(!isAdminValue(jar.get('edible_admin')?.value))return NextResponse.json({error:'Unauthorised'},{status:401});
 const key=process.env.RESEND_API_KEY;
 if(!key)return NextResponse.json({error:'Email history is not configured'},{status:503});
 const {searchParams}=new URL(request.url);
 const id=searchParams.get('id');
 if(id&&!/^[a-f0-9-]{20,80}$/i.test(id))return NextResponse.json({error:'Invalid email ID'},{status:400});
 const after=searchParams.get('after');
 if(after&&!/^[a-f0-9-]{20,80}$/i.test(after))return NextResponse.json({error:'Invalid cursor'},{status:400});
 const endpoint=id?'https://api.resend.com/emails/'+encodeURIComponent(id):'https://api.resend.com/emails?limit=100'+(after?'&after='+encodeURIComponent(after):'');
 try{
  const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+key},cache:'no-store'});
  const data=await response.json();
  if(!response.ok)return NextResponse.json({error:response.status===401||response.status===403?'The email service key does not have permission to read sent messages. Please check its Resend permissions.':'Email history is unavailable (provider status '+response.status+').'},{status:502});
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Email provider temporarily unavailable'},{status:502})}
}
