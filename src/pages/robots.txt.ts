import type { APIRoute } from 'astro';
export const GET: APIRoute = ({site}) => {
  const indexable=import.meta.env.PUBLIC_INDEXABLE==='true';
  const body=indexable
    ? 'User-agent: *\nAllow: /\nSitemap: '+new URL('/sitemap.xml',site||new URL('https://techblogtip-staging.tamsudev-com.workers.dev/')).toString()+'\n'
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300'}});
};
