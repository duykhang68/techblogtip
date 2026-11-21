import type { APIRoute } from 'astro';
import { getArticles, articleUrl, withBase } from '../lib/content';
const xml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export const GET: APIRoute = async ({site}) => {
  const base=site||new URL('https://techblogtip-staging.tamsudev-com.workers.dev/');
  const articles=await getArticles();
  const items=articles.map(a=>'<item><title>'+xml(a.data.title)+'</title><link>'+xml(new URL(articleUrl(a),base).toString())+'</link><guid>'+xml(new URL(articleUrl(a),base).toString())+'</guid><pubDate>'+a.data.published.toUTCString()+'</pubDate><description>'+xml(a.data.description)+'</description></item>').join('');
  const body='<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TechBlogTip</title><link>'+xml(new URL(withBase('/'),base).toString())+'</link><description>Hướng dẫn công nghệ và thủ thuật tiếng Việt</description><language>vi-VN</language>'+items+'</channel></rss>';
  return new Response(body,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
