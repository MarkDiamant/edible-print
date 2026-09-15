export function formatOrderNumber(value){
  const numeric=Number(value);
  if(Number.isInteger(numeric)&&numeric>0)return String(numeric+252).padStart(4,'0');
  const raw=String(value??'').trim();
  return raw||'----';
}
