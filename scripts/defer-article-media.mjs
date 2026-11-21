import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time HTML rewrite, never performed on the client: the browser's speculative
// parser cannot fetch below-fold article media while src/srcset is absent.
export function deferArticleMedia(html) {
  return html.replace(
    /(<article\b[^>]*class="prose"[^>]*>)([\s\S]*?)(<\/article>)/gi,
    (_whole, opening, article, closing) => {
      const deferred = article.replace(/<(img|iframe)\b[^>]*>/gi, (tag) => {
        if (!/\s(?:src|srcset)=(["'])[^"']+\1/i.test(tag) || /\sdata-defer-src=/i.test(tag)) return tag;
        const rewritten = tag.replace(/\s(src|srcset)=(["'])(.*?)\2/gi,
          (_match, name, quote, value) => ' data-defer-' + name + '=' + quote + value + quote);
        const extra = (/(?:\s)loading=/i.test(rewritten) ? '' : ' loading="lazy"') +
          ((/^<img\b/i.test(rewritten) && !/\sdecoding=/i.test(rewritten)) ? ' decoding="async"' : '');
        return rewritten.replace(/\s*\/?>$/, extra + '>') + '<noscript>' + tag + '</noscript>';
      });
      return opening + deferred + closing;
    }
  );
}

function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const target = join(folder, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith('.html')) {
      const before = readFileSync(target, 'utf8');
      const after = deferArticleMedia(before);
      if (after !== before) writeFileSync(target, after);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  walk(resolve('dist'));
  console.log('Deferred below-fold article images/iframes in production HTML');
}
