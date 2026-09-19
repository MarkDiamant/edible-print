'use client';
import {useEffect} from 'react';

export default function RoyalMailAutoOpen({enabled}){
  useEffect(()=>{
    if(!enabled)return;
    const url='https://business.parcel.royalmail.com/orders/';
    const timer=setTimeout(()=>{ window.location.assign(url); },150);
    return ()=>clearTimeout(timer);
  },[enabled]);
  return null;
}
