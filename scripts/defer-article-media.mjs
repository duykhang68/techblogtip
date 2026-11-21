import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time HTML rewrite: offscreen article media does not expose network URLs
// until IntersectionObserver approaches it. Never mutate markup in the browser.
function deferTag(tag) {
  if (!/\ssrc=(["'])[^"']+\1/i.test(tag) || /\sdata-defer-src=/i.test(tag)) return tag;
  const rewritten = tag.replace(/\s(src|srcset)=(["'])(.*?)\2/gi,
    (_match, name, quote, value) => ' data-defer-' + name + '=' + quote + value + quote);
  const extra = (/\sloading=/i.test(rewritten) ? '' : ' loading="lazy"') +
    (/^<img\b/i.test(rewritten) && !/\sdecoding=/i.test(rewritten) ? ' decoding="async"' : '');
  return rewritten.replace(/\s*\/?>$/, extra + '>');
}

export function deferArticleMedia(html) {
  return html.replace(
    /(<article\b[^>]*class="prose"[^>]*>)([\s\S]*?)(<\/article>)/gi,
    (_whole, opening, article, closing) => opening + article
      .split(/(<noscript>[\s\S]*?<\/noscript>)/gi)
      .map(part => {
        // Repeated builds must never transform the non-JS fallback.
        if (/^<noscript>/i.test(part)) return part;
        const withIframes = part.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, block => {
          const tag = block.match(/^<iframe\b[^>]*>/i)?.[0];
          if (!tag) return block;
          const rewritten = deferTag(tag);
          return rewritten === tag ? block : block.replace(tag, rewritten) + '<noscript>' + block + '</noscript>';
        });
        return withIframes.replace(/<img\b[^>]*>/gi, tag => {
          const rewritten = deferTag(tag);
          return rewritten === tag ? tag : rewritten + '<noscript>' + tag + '</noscript>';
        });
      }).join('') + closing
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
