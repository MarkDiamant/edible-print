import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabaseAdmin';
import {products} from '../../../../lib/products';
export const dynamic='force-dynamic';
async function authorized(){return isAdminValue((await cookies()).get('edible_admin')?.value)}
export async function GET(){
 if(!await authorized())return NextResponse.json({error:'Please sign in again.'},{status:401});
 const {data,error}=await getSupabaseAdmin().from('product_catalogue').select('*');
 if(error)return NextResponse.json({error:error.message},{status:500});
 const overrides=new Map((data||[]).map(p=>[p.slug,p]));
 return NextResponse.json({products:[...products.map(p=>({...p,...(overrides.get(p.slug)||{}),published:true,existing:true})),...(data||[]).filter(p=>!products.some(x=>x.slug===p.slug)).map(p=>({...p,existing:false}))]});
}
export async function POST(req){
 if(!await authorized())return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json(),slug=String(b.slug||'').trim().toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>110)return NextResponse.json({error:'Invalid product URL name.'},{status:400});
 const existing=products.find(p=>p.slug===slug);
 const title=String(b.title||'').trim(),extra=String(b.extra||''),description_html=String(b.description_html||'');
 if(!title||title.length>180)return NextResponse.json({error:'Enter a product title (up to 180 characters).'}, {status:400});
 const images=Array.isArray(b.images)?b.images.filter(u=>typeof u==='string'&&u.startsWith('https://')&&u.length<1000).slice(0,12):[];
 const variants=Array.isArray(b.variants)?b.variants:[];
 if(!Array.isArray(variants)||!variants.length||variants.length>12||variants.some(v=>!Array.isArray(v)||typeof v[0]!=='string'||!Number.isInteger(v[1])||v[1]<1))return NextResponse.json({error:'At least one valid price option is required.'},{status:400});
 // New products stay in draft until the checkout catalogue also supports their SKU.
 const published=Boolean(existing)&&(b.published===undefined?true:Boolean(b.published));
 const {error}=await getSupabaseAdmin().from('product_catalogue').upsert({slug,title,extra,description_html,images,variants,published,updated_at:new Date().toISOString()});
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true,published,notice:published?'Saved and published.':'Saved as draft or hidden. New product checkout support must be verified before publishing.'});
}
export async function DELETE(req){if(!await authorized())return NextResponse.json({error:'Unauthorized'},{status:401});const {slug}=await req.json();if(typeof slug!=='string')return NextResponse.json({error:'Invalid product'},{status:400});const db=getSupabaseAdmin();if(products.some(p=>p.slug===slug)){const p=products.find(p=>p.slug===slug);const {error}=await db.from('product_catalogue').upsert({slug,title:p.title,extra:p.extra,description_html:p.descriptionHtml,images:p.images,variants:p.variants,published:false});return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true,notice:'Product hidden from shop.'})}const {error}=await db.from('product_catalogue').delete().eq('slug',slug);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true,notice:'Product deleted.'})}
