'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {money,products} from '../../lib/products';
import {commerce,getCartAuth} from '../../lib/supabaseClient';

export default function Cart(){
  const [items,setItems]=useState([]),[delivery,setDelivery]=useState('standard'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  async function load(){
    const auth=getCartAuth();
    if(!auth){setItems([]);setLoading(false);return}
    try{const data=await commerce('get_cart',{cartId:auth.id,accessToken:auth.token});setItems(data.items||[])}catch{setItems([])}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  async function quantity(item,qty){
    const auth=getCartAuth();if(!auth)return;
    const next=Math.max(1,+qty||1);setItems(xs=>xs.map(x=>x.id===item.id?{...x,quantity:next}:x));
    try{await commerce('update_quantity',{cartId:auth.id,accessToken:auth.token,itemId:item.id,qty:next})}catch(e){alert(e.message);load()}
  }
  async function remove(item){const auth=getCartAuth();if(!auth)return;setBusy(true);try{await commerce('remove_item',{cartId:auth.id,accessToken:auth.token,itemId:item.id});await load()}catch(e){alert(e.message)}finally{setBusy(false)}}
  async function checkout(){
    const auth=getCartAuth();if(!auth)return;setBusy(true);
    try{const r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cartId:auth.id,accessToken:auth.token,delivery})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not start checkout');window.location.href=data.url}catch(e){alert(e.message)}finally{setBusy(false)}
  }
  const subtotal=items.reduce((s,x)=>s+x.unit_price_pence*x.quantity,0),standard=subtotal>=2500?0:295,express=subtotal>=2500?200:495,shipping=delivery==='express'?express:standard;
  return <><header><Link href="/">← Continue shopping</Link><strong>Edible Print</strong></header><main className="cart"><h1>Your basket</h1>{loading?<p>Loading basket…</p>:!items.length?<><p>Your basket is empty.</p><Link className="btn" href="/#shop">Shop edible prints</Link></>:<><div className="cartitems">{items.map(x=>{const p=products.find(p=>p.slug===x.product_slug);return <div className="cartrow" key={x.id}>{p&&<img src={p.image}/>}<div><strong>{x.product_title}</strong><p>{x.variant_label}</p><label>Quantity <input type="number" min="1" value={x.quantity} onChange={e=>quantity(x,e.target.value)}/></label></div><strong>{money(x.unit_price_pence*x.quantity)}</strong><button disabled={busy} onClick={()=>remove(x)}>Remove</button></div>})}</div><div className="summary"><h3>Delivery</h3><label className="delivery"><input type="radio" name="delivery" checked={delivery==='standard'} onChange={()=>setDelivery('standard')}/><span><strong>Standard</strong>{subtotal>=2500?'Free on orders £25+':'Royal Mail delivery'}</span><strong>{standard?money(standard):'FREE'}</strong></label><label className="delivery"><input type="radio" name="delivery" checked={delivery==='express'} onChange={()=>setDelivery('express')}/><span><strong>Express</strong>Express delivery</span><strong>{money(express)}</strong></label><p>Subtotal <strong>{money(subtotal)}</strong></p><p>Delivery <strong>{shipping?money(shipping):'FREE'}</strong></p><p className="total">Total <strong>{money(subtotal+shipping)}</strong></p><button className="btn wide" onClick={checkout} disabled={busy}>{busy?'Please wait…':'Secure checkout'}</button></div></>}</main></>;
}
