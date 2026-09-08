import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL='https://diiqajrvlalkggjlutyn.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_I3i7l5-uwhJvx2HfAkNzzA_EkyiSniy';
export const COMMERCE_URL=`${SUPABASE_URL}/functions/v1/commerce`;

export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});

export async function commerce(action,payload={}){
  const res=await fetch(COMMERCE_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Could not process basket');
  return data;
}

export async function ensureCart(){
  const raw=localStorage.getItem('edible-cart-auth');
  if(raw){
    try{
      const auth=JSON.parse(raw);
      if(auth?.id&&auth?.token)return auth;
    }catch{}
  }
  const {cart}=await commerce('create_cart');
  const auth={id:cart.id,token:cart.access_token};
  localStorage.setItem('edible-cart-auth',JSON.stringify(auth));
  return auth;
}

export function getCartAuth(){
  try{return JSON.parse(localStorage.getItem('edible-cart-auth')||'null')}catch{return null}
}
