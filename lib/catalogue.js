import {products} from './products';
import {getSupabaseAdmin} from './supabaseAdmin';
export async function getCatalogue(){
 try{
  const {data,error}=await getSupabaseAdmin().from('product_catalogue').select('*').eq('published',true);
  if(error)throw error;
  const overrides=new Map((data||[]).map(x=>[x.slug,x]));
  return products.map(p=>{
   const o=overrides.get(p.slug);
   return o?{...p,title:o.title,extra:o.extra,descriptionHtml:o.description_html||p.descriptionHtml,image:o.images?.[0]||p.image,images:o.images?.length?o.images:p.images,variants:p.variants}:p;
  });
 }catch(e){console.error('Catalogue fallback',e);return products}
}
