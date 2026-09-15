import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {isAdminValue} from '../../../../lib/adminAuth';

export async function GET(){
  const jar=await cookies();
  const isAdmin=isAdminValue(jar.get('edible_admin')?.value);
  return NextResponse.json({isAdmin},{headers:{'Cache-Control':'no-store'}});
}
