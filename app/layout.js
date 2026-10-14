import './globals.css';
import './footer-credit.css';
const favicon='https://diiqajrvlalkggjlutyn.supabase.co/storage/v1/object/public/product-images/shopify-migration/23336457-54f3-47b2-9372-ccd2d7b9d3e5.png';
import {getSupabaseAdmin} from '../lib/supabaseAdmin';export async function generateMetadata(){let icon=favicon;try{const {data}=await getSupabaseAdmin().from('site_assets').select('url').eq('key','favicon').maybeSingle();if(data?.url)icon=data.url}catch{}return {title:'Edible Print | Custom Edible Icing Prints',description:'Custom edible icing prints for cakes, cupcakes, biscuits and branded treats. Fast UK dispatch.',icons:{icon,shortcut:icon,apple:icon}};}
export default function RootLayout({children}){return <html lang="en-GB"><body>{children}</body></html>}
