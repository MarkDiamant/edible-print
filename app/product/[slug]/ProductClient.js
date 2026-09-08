'use client';
import {useState} from 'react';
import Link from 'next/link';
import {money} from '../../../lib/products';
import {commerce,ensureCart,supabase} from '../../../lib/supabaseClient';

const maxDesignsFor=(p,index)=>p.slug==='a4-edible-print-sheet'?[1,4,10][index]:[1,4,10,30][index];

export default function ProductClient({p}){
  const [variant,setVariant]=useState(0),[qty,setQty]=useState(1),[files,setFiles]=useState([]),[main,setMain]=useState(p.image),[added,setAdded]=useState(false),[busy,setBusy]=useState(false);
  async function add(){
    if(busy)return;
    const selected=[...files];
    const max=maxDesignsFor(p,variant);
    if(!selected.length)return alert('Please upload your image(s) before adding to basket.');
    if(selected.length>max)return alert(`This option allows up to ${max} design${max===1?'':'s'}.`);
    for(const f of selected){
      if(!['image/png','image/jpeg','application/pdf'].includes(f.type))return alert('Artwork must be PNG, JPG or PDF.');
      if(f.size>20*1024*1024)return alert(`${f.name} is larger than 20MB.`);
    }
    setBusy(true);setAdded(false);
    let auth,itemId;
    try{
      auth=await ensureCart();
      const prepared=await commerce('add_item',{cartId:auth.id,accessToken:auth.token,slug:p.slug,variant,qty,files:selected.map(f=>({name:f.name,size:f.size,type:f.type}))});
      itemId=prepared.itemId;
      const ids=[];
      for(let i=0;i<prepared.uploads.length;i++){
        const u=prepared.uploads[i],f=selected[i];
        const {error}=await supabase.storage.from('artwork').uploadToSignedUrl(u.path,u.token,f,{contentType:f.type});
        if(error)throw error;
        ids.push(u.artworkId);
      }
      await commerce('confirm_uploads',{cartId:auth.id,accessToken:auth.token,artworkIds:ids});
      setAdded(true);
    }catch(e){
      if(auth&&itemId){try{await commerce('remove_item',{cartId:auth.id,accessToken:auth.token,itemId})}catch{}}
      alert(e.message||'Could not add this item. Please try again.');
    }finally{setBusy(false)}
  }
  return <><header><Link href="/">← Back to shop</Link><strong>Edible Print</strong><Link href="/cart">Basket</Link></header><main className="product"><div><img className="producthero" src={main}/><div className="thumbs">{(p.images||[p.image]).map(x=><button key={x} onClick={()=>setMain(x)}><img src={x}/></button>)}</div></div><div><h1>{p.title}</h1><p>{p.description}</p><h3>How many different designs?</h3><div className="choices">{p.variants.map((v,i)=><button className={variant===i?'selected':''} onClick={()=>setVariant(i)} key={v[0]}><span>{v[0]}</span><strong>{money(v[1])}</strong></button>)}</div><label className="field">Upload your image(s)<input type="file" multiple accept="image/jpeg,image/png,.pdf" onChange={e=>setFiles(e.target.files)}/><small>PNG, JPG or PDF • Maximum 20MB per file • Up to {maxDesignsFor(p,variant)} design{maxDesignsFor(p,variant)===1?'':'s'} for this option.</small></label><label className="field">Quantity<input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,+e.target.value))}/></label><button className="btn wide" onClick={add} disabled={busy}>{busy?'Uploading artwork…':`Add to basket • ${money(p.variants[variant][1]*qty)}`}</button>{added&&<p className="added">✓ Added securely. <Link href="/cart">View basket</Link></p>}<div className="productinfo"><h3>How it works</h3><p>Upload your image before adding to basket. We accept JPG, PNG and PDF files. Every file is reviewed before printing.</p><p>Orders placed before 2pm are printed and dispatched the same day.</p><h3>Edible icing sheet ingredients</h3><p>Water, corn starch, corn syrup, corn syrup solids, cellulose, sorbitol, glycerine, sugar, vegetable oil, gum arabic, polysorbate 80, vanilla flavouring, titanium dioxide (E171), citric acid.</p><p>Fully Kosher Kedassia, Halal and suitable for vegan and vegetarian diets. Printed using food-safe edible ink.</p><h3>Storage</h3><p>Store sealed in original packaging in a cool, dry place. Do not refrigerate. Avoid heat, humidity and direct sunlight. For best quality, use within 2 months of delivery.</p></div></div></main></>;
}
