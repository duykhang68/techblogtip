import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

export function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function articleUrl(article: Article): string {
  return '/bai-viet/' + article.id.replace(/\.md$/, '') + '/';
}
export const categoryUrl = (name: string) => '/chuyen-muc/' + slugify(name) + '/';
export const tagUrl = (name: string) => '/the/' + slugify(name) + '/';
export const seriesUrl = (name: string) => '/chu-de/' + slugify(name) + '/';

export async function getArticles(): Promise<Article[]> {
  const data = await getCollection('articles', ({ data }) => !data.draft);
  return data.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

export function valuesWithCounts(articles: Article[], picker: (article: Article) => string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of articles) for (const name of picker(article)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
