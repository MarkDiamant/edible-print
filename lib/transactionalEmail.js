import {getSupabaseAdmin} from './supabaseAdmin';

const LOGO='https://cdn.shopify.com/s/files/1/1000/0839/5135/files/Edible_Print_Logo_resdesigned.png?v=1776435305';
const SITE='https://edibleprint.uk';
const WUA='https://www.woulduseagain.com/recommend/edible-print-4ead8a96';
const FROM='Edible Print <noreply@edibleprint.uk>';

function esc(value=''){
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function money(pence=0){return `£${(Number(pence||0)/100).toFixed(2)}`}

function addressText(address={}){
  return [address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ');
}

async function getOrder(orderId){
  const db=getSupabaseAdmin();
  const {data:order,error}=await db.from('orders').select('*').eq('id',orderId).single();
  if(error)throw error;
  const {data:items,error:itemError}=await db.from('order_items').select('*').eq('order_id',orderId).order('created_at');
  if(itemError)throw itemError;
  const {count:artworkCount,error:artError}=await db.from('artwork').select('id',{count:'exact',head:true}).eq('order_id',orderId);
  if(artError)throw artError;
  return {...order,items:items||[],artwork_count:artworkCount||0};
}

function contentFor(type,order){
  const number=order.order_number||order.id;
  if(type==='confirmation')return {
    subject:`Order ${number} confirmed - Edible Print`,
    heading:'Thanks, your order is confirmed',
    intro:'We have received your order and artwork. We will check the files before printing and keep you updated as it moves through production.',
    cta:'View your account',href:`${SITE}/account`
  };
  if(type==='processing')return {
    subject:`Order ${number} is being prepared - Edible Print`,
    heading:'Your order is being prepared',
    intro:'Your order is now in production. We are preparing your edible prints and will update you again when they are ready to go.',
    cta:'View your account',href:`${SITE}/account`
  };
  if(type==='ready')return {
    subject:`Order ${number} is ready - Edible Print`,
    heading:order.shipping_method==='collection'?'Your order is ready for collection':'Your order is ready',
    intro:order.shipping_method==='collection'?'Your edible prints are ready for collection.':'Your edible prints are ready and are being prepared for dispatch.',
    cta:'View your account',href:`${SITE}/account`
  };
  if(type==='dispatched')return {
    subject:`Order ${number} has been dispatched - Edible Print`,
    heading:'Your order is on its way',
    intro:'Your edible prints have been dispatched. Thank you for ordering from Edible Print.',
    cta:'View your account',href:`${SITE}/account`
  };
  if(type==='feedback')return {
    subject:`How did we do? Order ${number} - Edible Print`,
    heading:'We would love your feedback',
    intro:'We hope you were happy with your edible prints. If you would use Edible Print again, a quick recommendation helps other customers choose with confidence.',
    cta:'Leave us a recommendation',href:WUA
  };
  throw new Error(`Unknown email type: ${type}`);
}

function itemRows(items=[]){
  return items.map(item=>`<tr><td style="padding-top:10px;padding-bottom:10px;border-bottom:1px solid #ece9e2;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#2f312f;"><strong>${esc(item.product_title)}</strong><br><span style="color:#666b66;">${esc(item.variant_label||'')} &nbsp; Qty ${esc(item.quantity)}</span></td><td align="right" style="padding-top:10px;padding-bottom:10px;border-bottom:1px solid #ece9e2;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#2f312f;">${money((item.unit_price_pence||0)*(item.quantity||0))}</td></tr>`).join('');
}

function htmlFor(type,order){
  const c=contentFor(type,order);
  const address=addressText(order.shipping_address||{});
  const detailBlock=type==='feedback'?'':`
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#667066;padding-bottom:8px;">ORDER ${esc(order.order_number||order.id)}</td></tr>
      ${itemRows(order.items)}
      <tr><td style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#454945;">Artwork received</td><td align="right" style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#454945;">${esc(order.artwork_count)}</td></tr>
      <tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#454945;">Delivery</td><td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#454945;">${esc(order.shipping_method||'standard')}</td></tr>
      <tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#454945;">Total</td><td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#2f312f;"><strong>${money(order.total_pence)}</strong></td></tr>
      ${address?`<tr><td colspan="2" style="padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#666b66;"><strong style="color:#454945;">Delivery address</strong><br>${esc(address)}</td></tr>`:''}
    </table>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f6f3ed;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f3ed"><tr><td align="center" style="padding-top:28px;padding-right:14px;padding-bottom:28px;padding-left:14px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td align="center" style="padding-bottom:18px;"><img src="${LOGO}" width="230" height="77" border="0" alt="Edible Print" style="display:block;width:230px;height:auto;"></td></tr><tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:34px;padding-right:32px;padding-bottom:34px;padding-left:32px;border-radius:14px;"><h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:34px;color:#2f312f;">${esc(c.heading)}</h1><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#555b55;">Hi ${esc(order.first_name||'there')},</p><p style="margin-top:12px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#555b55;">${esc(c.intro)}</p>${detailBlock}<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td bgcolor="#819b78" style="background-color:#819b78;border-radius:8px;"><a href="${c.href}" style="display:inline-block;padding-top:13px;padding-right:22px;padding-bottom:13px;padding-left:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold;">${esc(c.cta)}</a></td></tr></table></td></tr><tr><td bgcolor="#f0eee8" align="center" style="background-color:#f0eee8;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#666b66;"><strong>Edible Print</strong><br>Custom Edible Prints &amp; Cake Toppers<br><a href="${SITE}" style="color:#667d60;text-decoration:none;">edibleprint.uk</a></p></td></tr></table></td></tr></table></body></html>`;
}

function textFor(type,order){
  const c=contentFor(type,order);
  const lines=[c.heading,'',`Hi ${order.first_name||'there'},`,c.intro,''];
  if(type!=='feedback'){
    lines.push(`Order: ${order.order_number||order.id}`);
    for(const item of order.items||[])lines.push(`${item.product_title} - ${item.variant_label||''} - Qty ${item.quantity}`);
    lines.push(`Artwork received: ${order.artwork_count}`);
    lines.push(`Delivery: ${order.shipping_method||'standard'}`);
    lines.push(`Total: ${money(order.total_pence)}`);
    const address=addressText(order.shipping_address||{});if(address)lines.push(`Delivery address: ${address}`);
    lines.push('');
  }
  lines.push(`${c.cta}: ${c.href}`,'','Edible Print','Custom Edible Prints & Cake Toppers','edibleprint.uk');
  return lines.join('\n');
}

export async function sendOrderEmail(orderId,type,{scheduledAt}={}){
  if(!process.env.RESEND_API_KEY)throw new Error('RESEND_API_KEY is not configured');
  const db=getSupabaseAdmin();
  const eventType=`email_${type}`;
  const {data:already}=await db.from('order_events').select('id').eq('order_id',orderId).eq('event_type',eventType).maybeSingle();
  if(already)return {skipped:true};
  const order=await getOrder(orderId);
  if(!order.email||order.email.endsWith('@invalid.local'))throw new Error('Order has no deliverable email address');
  const c=contentFor(type,order);
  const payload={from:FROM,to:[order.email],subject:c.subject,html:htmlFor(type,order),text:textFor(type,order)};
  if(scheduledAt)payload.scheduled_at=scheduledAt;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.message||`Resend returned ${response.status}`);
  await db.from('order_events').insert({order_id:orderId,event_type:eventType,actor:'system',details:{resend_id:result.id||null,scheduled_at:scheduledAt||null}});
  return result;
}
