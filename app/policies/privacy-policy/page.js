import {pages} from '../../../lib/pages';import {SiteHeader,SiteFooter} from '../../../components/SiteChrome';
export default function Privacy(){const page=pages['privacy-policy'];return <><SiteHeader/><main className="page-shell"><h1>{page.title}</h1><div dangerouslySetInnerHTML={{__html:page.html}}/></main><SiteFooter/></>}
