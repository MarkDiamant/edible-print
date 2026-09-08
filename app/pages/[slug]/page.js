import {notFound} from 'next/navigation';import {pages} from '../../../lib/pages';import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';
export function generateStaticParams(){return Object.keys(pages).map(slug=>({slug}))}
export default async function InfoPage({params}){const {slug}=await params;const page=pages[slug];if(!page)notFound();return <><SiteHeader/><main className="page-shell"><h1>{page.title}</h1><div dangerouslySetInnerHTML={{__html:page.html}}/></main><SiteFooter/></>}
