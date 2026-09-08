'use client';
import {useEffect} from 'react';
import Link from 'next/link';

export default function SuccessClient(){
  useEffect(()=>{localStorage.removeItem('edible-cart-auth')},[]);
  return <main className="success"><div className="tick">✓</div><h1>Thank you for your order</h1><p>Your payment has been received. We’ll check your artwork before printing and will contact you if anything needs attention.</p><Link className="btn" href="/">Back to Edible Print</Link></main>;
}
