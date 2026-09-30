'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabaseClient';
import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';
export default function Profile(){
 const [user,setUser]=useState(null),[name,setName]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{supabase.auth.getUser().then(({data})=>{setUser(data.user);setName(data.user?.user_metadata?.first_name||'')})},[]);
 async function save(e){e.preventDefault();const {error}=await supabase.auth.updateUser({data:{first_name:name}});setMessage(error?error.message:'Profile saved.')} async function changePassword(e){e.preventDefault();const {error}=await supabase.auth.updateUser({password});setMessage(error?error.message:'Password changed successfully.');if(!error)setPassword('')} async function signOut(){await supabase.auth.signOut();location.href='/account'}
 return <><SiteHeader/><main className="account-page"><aside><h2>My account</h2><nav><Link href="/account">Orders</Link><strong>Profile</strong></nav></aside><section><h1>Profile</h1>{!user?<p><Link href="/account">Sign in to manage your profile</Link></p>:<form className="profile-form" onSubmit={save}><label>Email<input value={user.email||''} disabled/></label><label>First name<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn">Save profile</button><hr/><h2>Password</h2><label>New password<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password"/></label><button type="button" className="btn" disabled={!password} onClick={changePassword}>Change password</button>{message&&<p>{message}</p>}<button type="button" onClick={signOut} style={{marginTop:24,border:0,background:"none",padding:0,textDecoration:"underline",cursor:"pointer"}}>Log out</button></form>}</section></main><SiteFooter/></>;
}