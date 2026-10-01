export const DEFAULT_DISPATCH_SETTINGS={cutoff_time:'13:00:00',working_days:[1,2,3,4,5],delay_until:null,express_days:1,standard_min_days:2,standard_max_days:3};

function londonParts(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now);
 const get=t=>parts.find(p=>p.type===t)?.value;
 const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get('weekday')];
 return {date:`${get('year')}-${get('month')}-${get('day')}`,minutes:+get('hour')*60 + +get('minute'),weekday};
}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12))}
function iso(d){return d.toISOString().slice(0,10)}
function day(d){return d.getUTCDay()}
function nextWorking(date,days){let d=parseDate(date);do{d.setUTCDate(d.getUTCDate()+days);days=1}while(!this.includes(day(d)));return iso(d)}
export function dispatchEstimate(settings={},delivery='standard',now=new Date()){
 const s={...DEFAULT_DISPATCH_SETTINGS,...settings};const work=(s.working_days||[1,2,3,4,5]).map(Number);const lp=londonParts(now);const [h,m]=String(s.cutoff_time||'13:00').split(':').map(Number);const cutoff=h*60+(m||0);
 let dispatch=lp.date;
 const delay=s.delay_until&&s.delay_until>dispatch?s.delay_until:null;
 if(delay)dispatch=delay;
 else if(!work.includes(lp.weekday)||lp.minutes>=cutoff)dispatch=nextWorking.call(work,dispatch,1);
 while(!work.includes(day(parseDate(dispatch))))dispatch=nextWorking.call(work,dispatch,1);
 const minTransit=delivery==='express'?Number(s.express_days||1):Number(s.standard_min_days||2);const maxTransit=delivery==='express'?minTransit:Number(s.standard_max_days||3);
 let arrivalMin=dispatch;for(let i=0;i<minTransit;i++)arrivalMin=nextWorking.call(work,arrivalMin,1);
 let arrivalMax=dispatch;for(let i=0;i<maxTransit;i++)arrivalMax=nextWorking.call(work,arrivalMax,1);
 return {dispatchDate:dispatch,deliveryDate:arrivalMin,deliveryDateMin:arrivalMin,deliveryDateMax:arrivalMax,cutoff:String(s.cutoff_time||'13:00').slice(0,5),delayed:Boolean(delay)};
}
export function prettyDispatchDate(s){return new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/London'})}

export function deliveryEstimateLabel(e){const a=prettyDispatchDate(e.deliveryDateMin||e.deliveryDate),b=prettyDispatchDate(e.deliveryDateMax||e.deliveryDate);return a===b?a:`${a} – ${b}`}
