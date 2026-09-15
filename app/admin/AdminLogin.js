'use client';

import {useState} from 'react';

export default function AdminLogin({passwordError=false,linkInvalid=false}){
  const [email,setEmail]=useState('hello@edibleprint.uk');
  const [message,setMessage]=useState(linkInvalid?'That sign-in link is invalid or has expired. Please request a new one.':'');
  const [busy,setBusy]=useState(false);

  async function sendLink(e){
    e.preventDefault();
    setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/admin/request-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim()})});
      const data=await res.json().catch(()=>({}));
      setMessage(res.ok?'Check hello@edibleprint.uk for your secure admin sign-in link.':(data.error||'Could not send the sign-in email.'));
    }catch{setMessage('Could not send the sign-in email.');}
    setBusy(false);
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
