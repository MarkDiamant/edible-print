'use client';

import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabaseClient';

const s={
  shell:{minHeight:'100vh',display:'grid',placeItems:'center',padding:'28px',background:'linear-gradient(180deg,#f5f8f3 0%,#fffdfb 100%)'},
  card:{width:'min(100%,520px)',background:'#fff',border:'1px solid #e7e1dc',borderRadius:22,padding:'34px',boxShadow:'0 18px 55px rgba(47,58,47,.10)'},
  brand:{fontSize:13,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#7f9777',marginBottom:8},
  title:{fontFamily:'Playfair Display,serif',fontSize:40,fontWeight:400,margin:'0 0 10px'},
  intro:{margin:'0 0 26px',color:'#656b63'},
  form:{display:'grid',gap:14},
  label:{display:'grid',gap:7,fontWeight:600},
  input:{width:'100%',padding:'13px 14px',border:'1px solid #dcd8d3',borderRadius:10,background:'#fff'},
  note:{margin:'14px 0 0',padding:'12px 14px',background:'#eef3ec',border:'1px solid #dbe5d7',borderRadius:10,color:'#2f3a2f'},
  divider:{display:'flex',alignItems:'center',gap:12,margin:'26px 0 18px',color:'#8b8b86',fontSize:12},
  line:{height:1,background:'#e7e1dc',flex:1},
  secondary:{padding:'12px 16px',borderRadius:10,border:'1px solid #cfc9c3',background:'#fff',fontWeight:600,cursor:'pointer'}
};

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

  return <main style={s.shell}>
    <section style={s.card}>
      <div style={s.brand}>Edible Print</div>
      <h1 style={s.title}>Admin sign in</h1>
      <p style={s.intro}>View orders, customer details and artwork, then update each order as it moves through production.</p>
      <form onSubmit={sendLink} style={s.form}>
        <label style={s.label}>Email address<input style={s.input} value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>
        <button className="btn wide" disabled={busy}>{busy?'Sending…':'Email me a secure sign-in link'}</button>
      </form>
      {message&&<p style={s.note}>{message}</p>}
      <div style={s.divider}><span style={s.line}/><span>or use the existing admin password</span><span style={s.line}/></div>
      {passwordError&&<p className="checkout-error">Incorrect password.</p>}
      <form action="/api/admin/login" method="post" style={s.form}>
        <label style={s.label}>Password<input style={s.input} name="password" type="password" required/></label>
        <button style={s.secondary} type="submit">Log in with password</button>
      </form>
    </section>
  </main>;
}
