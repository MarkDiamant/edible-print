import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {isAdminValue} from '../../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../../lib/supabaseAdmin';
import {products} from '../../../../../lib/products';
export const maxDuration=300;
const site={
 hero:'https://cdn.shopify.com/s/files/1/1000/0839/5135/files/cake-with-large-edible-print-on-top-and-small-stickers-on-sides-with-biscuits-and-cupcakes-in-foreground.png?v=1776431154',
 band:'https://cdn.shopify.com/s/files/1/1000/0839/5135/files/Untitled-2_a9647913-81ec-4672-91f5-2944a8986e4a.jpg'
};
async function migrate(db,url){
 if(!url.includes('cdn.shopify.com'))return url;
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Source image unavailable: '+response.status+' '+url);
 const mime=response.headers.get('content-type')?.split(';')[0];
 if(!['image/png','image/jpeg','image/webp'].includes(mime))throw Error('Unsupported image type: '+url);
 const bytes=await response.arrayBuffer();
 if(!bytes.byteLength||bytes.byteLength>10*1024*1024)throw Error('Image too large or empty: '+url);
 const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
 const path='shopify-migration/'+crypto.randomUUID()+'.'+ext;
 const {error}=await db.storage.from('product-images').upload(path,bytes,{contentType:mime,upsert:false});
 if(error)throw error;
 return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
export async function POST(){
 if(!isAdminValue((await cookies()).get('edible_admin')?.value))return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=getSupabaseAdmin(),report={migrated:0,errors:[]};
 const cache=new Map();
 async function copy(url){if(cache.has(url))return cache.get(url);const newUrl=await migrate(db,url);cache.set(url,newUrl);if(newUrl!==url)report.migrated++;return newUrl}
 for(const p of products){
  try{
   const {data:override}=await db.from('product_catalogue').select('*').eq('slug',p.slug).maybeSingle();
   const images=override?.images?.length?override.images:p.images;
   const moved=[];
   for(const url of images){try{moved.push(await copy(url))}catch(e){moved.push(url);report.errors.push(p.slug+': '+e.message)}}
   const {error}=await db.from('product_catalogue').upsert({slug:p.slug,title:override?.title||p.title,extra:override?.extra??p.extra,description_html:override?.description_html||p.descriptionHtml,images:moved,variants:p.variants,published:true,updated_at:new Date().toISOString()});
   if(error)report.errors.push(p.slug+': '+error.message);
  }catch(e){report.errors.push(p.slug+': '+e.message)}
 }
 for(const [key,url] of Object.entries(site)){try{const migrated=await copy(url);const {error}=await db.from('site_assets').upsert({key,url:migrated,updated_at:new Date().toISOString()});if(error)report.errors.push(key+': '+error.message)}catch(e){report.errors.push(key+': '+e.message)}}
 return NextResponse.json({ok:!report.errors.length,...report});
}
