import type { APIRoute } from 'astro';
import { getArticles, articleUrl, categoryUrl, tagUrl, seriesUrl } from '../lib/content';
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const GET: APIRoute = async ({site}) => {
  const base=site||new URL('https://techblogtip-staging.tamsudev-com.workers.dev/');
  const posts=await getArticles();
  const routePaths=new Set(['/', '/chuyen-muc/', '/chu-de/', '/the/', '/tim-kiem/']);
  for(const a of posts){
    routePaths.add(articleUrl(a));routePaths.add(categoryUrl(a.data.category));
    a.data.tags.forEach(t=>routePaths.add(tagUrl(t)));
    if(a.data.series)routePaths.add(seriesUrl(a.data.series));
  }
  for(let i=2;i<=Math.ceil(posts.length/8);i++) routePaths.add('/page/'+i+'/');
  const rows=[...routePaths].map(p=>'<url><loc>'+xml(new URL(p,base).toString())+'</loc></url>').join('');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
