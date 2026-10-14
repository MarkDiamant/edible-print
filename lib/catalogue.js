import {products} from './products';
import {getSupabaseAdmin} from './supabaseAdmin';
export async function getCatalogue(){
 try{
  const {data,error}=await getSupabaseAdmin().from('product_catalogue').select('*');
  if(error)throw error;
  const overrides=new Map((data||[]).map(x=>[x.slug,x]));
  const existing=products.filter(p=>overrides.get(p.slug)?.published!==false).map(p=>{
   const o=overrides.get(p.slug);
   return o?{...p,title:o.title,extra:o.extra,descriptionHtml:o.description_html||p.descriptionHtml,image:o.images?.[0]||p.image,images:o.images?.length?o.images:p.images,variants:o.variants?.length?o.variants:p.variants}:p;
  });
  const extra=(data||[]).filter(x=>x.published&&!products.some(p=>p.slug===x.slug)).map(x=>({slug:x.slug,title:x.title,extra:x.extra,descriptionHtml:x.description_html,image:x.images?.[0],images:x.images,variants:x.variants}));
  return [...existing,...extra];
 }catch(e){console.error('Catalogue fallback',e);return products}
}
