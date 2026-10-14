import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';
export async function POST(req){
 if(!isAdminValue((await cookies()).get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
 const form=await req.formData(),file=form.get('file');
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||file.size===0)return NextResponse.json({error:'Choose a JPG, PNG or WebP image under 10 MB.'},{status:400});
 const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path='catalogue/'+crypto.randomUUID()+'.'+extension,db=getSupabaseAdmin();
 const {error}=await db.storage.from('product-images').upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({url:db.storage.from('product-images').getPublicUrl(path).data.publicUrl});
}