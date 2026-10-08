import {getSupabaseAdmin} from './supabaseAdmin';
import {formatOrderNumber} from './orderNumber';

const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendRefundEmail(order,refund){
  if(!process.env.RESEND_API_KEY)throw new Error('RESEND_API_KEY not configured');
  if(!order.email||order.email.endsWith('@invalid.local'))throw new Error('No valid customer email');
  const db=getSupabaseAdmin();
  const {data:previous}=await db.from('order_events').select('id').eq('order_id',order.id).eq('event_type','email_refund').contains('details',{refund_id:refund.id}).limit(1);
  if(previous?.length)return {skipped:true};
  const number=formatOrderNumber(order.order_number||order.id);
  const amount='£'+(refund.amount/100).toFixed(2);
  const partial=refund.amount<Number(order.total_pence||0);
  const subject=`Your ${partial?'partial ':''}refund of ${amount} for order ${number} - Edible Print`;
  const intro=`A refund of ${amount} has been issued to your original payment method for order ${number}.`;
  const text=`Hi ${order.first_name||'there'},\n\n${intro}\n\nPlease allow several working days for the money to appear, depending on your bank.\n\n${partial?'Your order remains active.\n\n':''}Edible Print\nhttps://edibleprint.uk`;
  const html=`<!doctype html><html><body style="margin:0;background:#f6f3ed;font-family:Arial,Helvetica,sans-serif;color:#2f312f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px"><tr><td align="center" style="padding:0 0 18px"><img src="https://cdn.shopify.com/s/files/1/1000/0839/5135/files/Edible_Print_Logo_resdesigned.png?v=1776435305" alt="Edible Print" width="230" style="display:block;width:230px;height:auto"></td></tr><tr><td style="background:#fff;padding:32px;border-radius:12px"><h1 style="font-size:26px;margin:0 0 16px">Refund confirmation</h1><p>Hi ${esc(order.first_name||'there')},</p><p>${esc(intro)}</p><p>Please allow several working days for the money to appear, depending on your bank.</p>${partial?'<p>Your order remains active.</p>':''}<p style="margin-top:24px"><a href="https://edibleprint.uk/account" style="color:#667d60">View your account</a></p></td></tr><tr><td align="center" style="padding:20px;color:#666;font-size:13px">Edible Print | <a href="https://edibleprint.uk" style="color:#667d60">edibleprint.uk</a></td></tr></table></td></tr></table></body></html>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Edible Print <noreply@edibleprint.uk>',to:[order.email],subject,html,text})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.message||`Resend returned ${response.status}`);
  await db.from('order_events').insert({order_id:order.id,event_type:'email_refund',actor:'system',details:{refund_id:refund.id,resend_id:result.id||null,to:order.email,email_subject:subject,email_html:html,email_text:text}});
  return result;
}
