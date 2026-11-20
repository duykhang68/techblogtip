import type { APIRoute } from 'astro';
import { getArticles, articleUrl } from '../lib/content';
export const GET: APIRoute = async () => {
  const articles=await getArticles();
  const body=articles.map(a=>({
    title:a.data.title,description:a.data.description,category:a.data.category,
    tags:a.data.tags,url:articleUrl(a),published:a.data.published.toISOString(),
  }));
  return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'}});
};
