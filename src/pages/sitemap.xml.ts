import type { APIRoute } from 'astro';
import { getArticles, articleUrl, categoryUrl, tagUrl, seriesUrl, withBase } from '../lib/content';

// Google Sitemap protocol 0.9: UTF-8, absolute canonical URLs, valid XML and
// factual lastmod values. Never invent build-time lastmod for unchanged pages.
const escapeXml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

function addUrl(target: Map<string, string | null>, path: string, base: URL, lastmod?: Date) {
  const absolute = new URL(path, base);
  if (absolute.origin !== base.origin ||
      !absolute.pathname.startsWith(import.meta.env.BASE_URL || '/')) {
    throw new Error('Sitemap URL outside the configured site');
  }
  // Canonical URLs have trailing slashes and exclude query strings/fragments.
  absolute.search = '';
  absolute.hash = '';
  if (!absolute.pathname.endsWith('/')) absolute.pathname += '/';
  const url = absolute.toString();
  const modified = lastmod && !Number.isNaN(lastmod.getTime())
    ? lastmod.toISOString()
    : null;
  const previous = target.get(url);
  if (!target.has(url) || (modified && (!previous || modified > previous))) {
    target.set(url, modified);
  }
}

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL('https://techblogtip-staging.tamsudev-com.workers.dev/');
  const posts = await getArticles();
  const urls = new Map<string, string | null>();

  for (const route of ['/', '/chuyen-muc/', '/chu-de/', '/the/', '/tim-kiem/']) {
    addUrl(urls, withBase(route), base);
  }

  for (const article of posts) {
    const { published, updated, category, tags, series } = article.data;
    addUrl(urls, articleUrl(article), base, updated && updated > published ? updated : published);
    addUrl(urls, categoryUrl(category), base);
    for (const tag of tags) addUrl(urls, tagUrl(tag), base);
    if (series) addUrl(urls, seriesUrl(series), base);
  }

  // The homepage uses eight articles per page; never output a non-existent
  // paginated route. Keep this in sync with src/pages/index.astro.
  for (let page = 2; page <= Math.ceil(posts.length / 8); page++) {
    addUrl(urls, withBase('/page/' + page + '/'), base);
  }

  const rows = [...urls]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([url, lastmod]) => {
      const mod = lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '';
      return '  <url><loc>' + escapeXml(url) + '</loc>' + mod + '</url>';
    });

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join('\n') + '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
