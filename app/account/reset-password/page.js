'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabaseClient';
import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';

export default function ResetPassword(){
 const [message,setMessage]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{
   let mounted=true;
   supabase.auth.getSession().then(({data})=>{if(mounted)setReady(Boolean(data.session))});
   const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
     if(event==='PASSWORD_RECOVERY'||session){setReady(true)}
   });
   return()=>{mounted=false;subscription.unsubscribe()}
 },[]);
 async function submit(e){
   e.preventDefault();setMessage('');
   const fd=new FormData(e.currentTarget),password=String(fd.get('password')||''),confirm=String(fd.get('confirmPassword')||'');
   if(password.length<8){setMessage('Password must be at least 8 characters.');return}
   if(password!==confirm){setMessage('Passwords do not match.');return}
   const {error}=await supabase.auth.updateUser({password});
   if(error)setMessage(error.message);
   else{setMessage('Password updated. You can now sign in with your new password.');setTimeout(async()=>{await supabase.auth.signOut();location.href='/account'},900)}
 }
 return <><SiteHeader/><main className="account-login"><h1>Set a new password</h1>{ready?<form onSubmit={submit}><input name="password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirmPassword" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/><button className="btn">Save password</button>{message&&<p role="status">{message}</p>}</form>:<p>Open this page using the password-reset link sent to your email. If the link has expired, request a new one from the sign-in page.</p>}</main><SiteFooter/></>
}
