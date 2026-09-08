import {createClient} from '@supabase/supabase-js';

const SUPABASE_URL='https://diiqajrvlalkggjlutyn.supabase.co';

export function getSupabaseAdmin(){
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('Supabase server authorisation is not configured');
  return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
