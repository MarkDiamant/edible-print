'use client';
import {useEffect} from 'react';

export default function RoyalMailAutoOpen({enabled}){
  useEffect(()=>{
    if(!enabled)return;
    window.open('https://business.parcel.royalmail.com/orders/','_blank','noopener,noreferrer');
  },[enabled]);
  return null;
}
