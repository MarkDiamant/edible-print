import './globals.css';
import './footer-credit.css';
const favicon='https://cdn.shopify.com/s/files/1/1000/0839/5135/files/ChatGPT_Image_Apr_19_2026_10_11_29_PM.png?v=1776633169';
import {getSupabaseAdmin} from '../lib/supabaseAdmin';export async function generateMetadata(){let icon=favicon;try{const {data}=await getSupabaseAdmin().from('site_assets').select('url').eq('key','favicon').maybeSingle();if(data?.url)icon=data.url}catch{}return {title:'Edible Print | Custom Edible Icing Prints',description:'Custom edible icing prints for cakes, cupcakes, biscuits and branded treats. Fast UK dispatch.',icons:{icon,shortcut:icon,apple:icon}};}
export default function RootLayout({children}){return <html lang="en-GB"><body>{children}</body></html>}
