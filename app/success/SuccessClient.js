'use client';
import {useEffect} from 'react';
import Link from 'next/link';

export default function SuccessClient(){
  useEffect(()=>{localStorage.removeItem('edible-cart-auth');localStorage.removeItem('ep_order_message')},[]);
  return <main className="success"><div className="tick">✓</div><h1>Thank you for your order</h1><p>Your payment has been received. You’ll receive an order confirmation by email, and we’ll send further updates as your order progresses. We’ll also check your artwork before printing and contact you if anything needs attention.</p><Link className="btn" href="/">Back to Edible Print</Link></main>;
}
