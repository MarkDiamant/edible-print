'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabaseClient';
import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';

function Modal({title,body,onClose}){
 return <div role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(30,35,29,.45)',display:'grid',placeItems:'center',padding:20}}><div style={{position:'relative',width:'min(520px,100%)',background:'#fff',borderRadius:18,padding:'34px 30px 30px',boxShadow:'0 20px 60px rgba(0,0,0,.2)',textAlign:'center'}}><button type="button" aria-label="Close" onClick={onClose} style={{position:'absolute',right:14,top:10,border:0,background:'none',fontSize:30,lineHeight:1,cursor:'pointer',color:'#555'}}>×</button><h2 id="reset-modal-title" style={{marginTop:0}}>{title}</h2><p style={{lineHeight:1.6}}>{body}</p><button className="btn" type="button" onClick={onClose}>OK</button></div></div>
}

export default function ResetPassword(){
 const [ready,setReady]=useState(false),[checking,setChecking]=useState(true),[modal,setModal]=useState(null);
 useEffect(()=>{
   let mounted=true;
   const finish=(ok)=>{if(mounted){setReady(ok);setChecking(false)}};
   supabase.auth.getSession().then(({data})=>finish(Boolean(data.session)));
   const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
     if(event==='PASSWORD_RECOVERY'||session){setReady(true);setChecking(false)}
   });
   return()=>{mounted=false;subscription.unsubscribe()}
 },[]);
 async function submit(e){
   e.preventDefault();
   const fd=new FormData(e.currentTarget),password=String(fd.get('password')||''),confirm=String(fd.get('confirmPassword')||'');
   if(password.length<8){setModal({title:'Password too short',body:'Your new password must be at least 8 characters.'});return}
   if(password!==confirm){setModal({title:'Passwords do not match',body:'Please enter the same new password in both boxes.'});return}
   const {error}=await supabase.auth.updateUser({password});
   if(error){setModal({title:'Could not reset password',body:error.message});return}
   await supabase.auth.signOut();
   setModal({title:'Password changed',body:'Your password has been changed. Press OK to return to sign in.'});
 }
 function closeModal(){
   const done=modal?.title==='Password changed';
   setModal(null);
   if(done)location.href='/account';
 }
 return <><SiteHeader/>{modal&&<Modal title={modal.title} body={modal.body} onClose={closeModal}/>}<main className="account-login"><h1>Set a new password</h1>{checking?<p>Checking your reset link…</p>:ready?<><p>Choose the password you want to use for your Edible Print account.</p><form onSubmit={submit}><input name="password" type="password" placeholder="New password" minLength="8" autoComplete="new-password" required/><input name="confirmPassword" type="password" placeholder="Confirm new password" minLength="8" autoComplete="new-password" required/><button className="btn">Save new password</button></form></>:<><p>This password-reset link is invalid or has expired.</p><button className="btn" type="button" onClick={()=>location.href='/account'}>Back to sign in</button></>}</main><SiteFooter/></>
}
