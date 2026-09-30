'use client';
import {useState} from 'react';
import {supabase} from '../../../lib/supabaseClient';
import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';
export default function ResetPassword(){
 const [message,setMessage]=useState('');
 async function submit(e){e.preventDefault();const password=new FormData(e.currentTarget).get('password');const {error}=await supabase.auth.updateUser({password});if(error)setMessage(error.message);else{setMessage('Password updated.');setTimeout(()=>location.href='/account',700)}}
 return <><SiteHeader/><main className="account-login"><h1>Set a new password</h1><form onSubmit={submit}><input name="password" type="password" placeholder="New password" minLength="6" required/><button className="btn">Save password</button>{message&&<p>{message}</p>}</form></main><SiteFooter/></>
}
