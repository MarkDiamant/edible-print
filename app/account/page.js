'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabaseClient';
import {SiteHeader,SiteFooter} from '../../components/SiteChrome';

export default function Account(){
 const [user,setUser]=useState(null),[orders,setOrders]=useState([]),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[messageType,setMessageType]=useState('success');
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();setUser(user);if(user?.email){const {data}=await supabase.from('orders').select('id,order_number,status,fulfilment_status,total_pence,currency,created_at,order_items(product_slug,product_title)').eq('email',user.email).order('created_at',{ascending:false});setOrders(data||[])}setLoading(false)})()},[]);
 async function signIn(e){e.preventDefault();setMessage('');const email=new FormData(e.currentTarget).get('email');const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/account'}});if(error){setMessageType('error');setMessage(error.message)}else{setMessageType('success');setMessage('Check your email for your secure sign-in link.')}}
 if(loading)return <><SiteHeader/><main className="account-page"><p>Loading…</p></main><SiteFooter/></>;
 if(!user)return <><SiteHeader/><main className="account-login"><h1>Your account</h1><p>Sign in to see your orders and buy again.</p><form onSubmit={signIn}><input name="email" type="email" placeholder="Email address" required/><button className="btn">Email me a sign-in link</button>{message&&<p role="status" className={messageType==='error'?'checkout-error':'account-message'}>{message}</p>}</form></main><SiteFooter/></>;
 return <><SiteHeader/><main className="account-page"><aside><h2>Hi{user.user_metadata?.first_name?', '+user.user_metadata.first_name:''}</h2><p>{user.email}</p><nav><strong>Orders</strong><Link href="/account/profile">Profile</Link></nav></aside><section><h1>Orders</h1>{!orders.length?<p>No orders yet.</p>:orders.map(o=>{const item=o.order_items?.[0];const label=o.fulfilment_status==='fulfilled'?'Dispatched':o.status==='paid'?'Order received':o.fulfilment_status||'Processing';return <article className="order-card" key={o.id}><div><strong>{label}</strong><p>#{o.order_number} · £{(o.total_pence/100).toFixed(2)} GBP</p>{item&&<small>{item.product_title}</small>}</div>{item&&<Link className="buy-again" href={'/product/'+item.product_slug}>Buy again</Link>}</article>})}</section></main><SiteFooter/></>;
}