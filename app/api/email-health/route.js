import {NextResponse} from 'next/server';
export async function GET(){return NextResponse.json({resendConfigured:Boolean(process.env.RESEND_API_KEY)});}
