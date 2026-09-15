import {createHmac,timingSafeEqual} from 'crypto';

const ADMIN_EMAIL='hello@edibleprint.uk';

function secret(){
  const value=process.env.ADMIN_PASSWORD;
  if(!value)throw new Error('Admin access is not configured');
  return value;
}

export function isAllowedAdminEmail(email){
  return String(email||'').trim().toLowerCase()===ADMIN_EMAIL;
}

export function createAdminMagicToken(email){
  const normal=String(email||'').trim().toLowerCase();
  if(!isAllowedAdminEmail(normal))throw new Error('Not authorised');
  const exp=Date.now()+15*60*1000;
  const payload=Buffer.from(JSON.stringify({email:normal,exp})).toString('base64url');
  const sig=createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminMagicToken(token){
  const [payload,sig]=String(token||'').split('.');
  if(!payload||!sig)return null;
  const expected=createHmac('sha256',secret()).update(payload).digest('base64url');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!isAllowedAdminEmail(data.email)||!data.exp||Date.now()>data.exp)return null;
    return data;
  }catch{return null;}
}
