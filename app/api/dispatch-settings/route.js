import {NextResponse} from 'next/server';import {getSupabaseAdmin} from '../../../lib/supabaseAdmin';import {DEFAULT_DISPATCH_SETTINGS} from '../../../lib/dispatchSchedule';
export const dynamic='force-dynamic';
export async function GET(){const db=getSupabaseAdmin();const {data}=await db.from('dispatch_settings').select('cutoff_time,working_days,delay_from,delay_until').eq('id',true).maybeSingle();return NextResponse.json({...DEFAULT_DISPATCH_SETTINGS,...(data||{})},{headers:{'Cache-Control':'no-store'}})}
