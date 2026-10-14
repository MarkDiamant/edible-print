import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {isAdminValue} from '../../../lib/adminAuth';
import ProductsEditor from './ProductsEditor';
export default async function ProductsAdmin(){
 if(!isAdminValue((await cookies()).get('edible_admin')?.value))redirect('/admin');
 return <ProductsEditor/>;
}