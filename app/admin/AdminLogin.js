'use client';

import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabaseClient';

export default function AdminLogin({passwordError=false}){
  const [email,setEmail]=useState('hello@edibleprint.uk');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data}=await supabase.auth.getSession();
      const token=data?.session?.access_token;
      if(!token||!active)return;
      const res=await fetch('/api/admin/email-session',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      if(res.ok)location.replace('/admin');
      else if(active)setMessage('This email address is not authorised for the Edible Print admin.');
    })();
    return()=>{active=false};
  },[]);

  async function sendLink(e){
    e.preventDefault();
    setBusy(true);setMessage('');
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+'/admin'}});
    setBusy(false);
    setMessage(error?error.message:'Check your email for your secure admin sign-in link.');
  }

  return <main className="admin-login-shell">
    <section className="admin-login-card">
      <div className="admin-login-brand">Edible Print</div>
      <h1>Admin sign in</h1>
      <p className="admin-login-intro">Sign in to view orders, customer details and artwork, and update order progress.</p>
      <form onSubmit={sendLink} className="admin-login-form">
        <label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>
        <button className="btn wide" disabled={busy}>{busy?'Sending…':'Email me a secure sign-in link'}</button>
      </form>
      {message&&<p className="account-message">{message}</p>}
      <div className="admin-login-divider"><span>or use the existing admin password</span></div>
      {passwordError&&<p className="checkout-error">Incorrect password.</p>}
      <form action="/api/admin/login" method="post" className="admin-login-form">
        <label>Password<input name="password" type="password" required/></label>
        <button className="admin-secondary-btn" type="submit">Log in with password</button>
      </form>
    </section>
  </main>;
}
