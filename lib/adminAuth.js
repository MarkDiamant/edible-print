import {createHash,timingSafeEqual} from 'crypto';

export function adminToken(){
  if(!process.env.ADMIN_PASSWORD)return null;
  return createHash('sha256').update(`edible-print-admin:${process.env.ADMIN_PASSWORD}`).digest('hex');
}
export function isAdminValue(value){
  const expected=adminToken();
  if(!expected||!value)return false;
  const a=Buffer.from(expected),b=Buffer.from(value);
  return a.length===b.length&&timingSafeEqual(a,b);
}
