const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function publishedHTML(data){
const blocks=(data.blocks||[]).map(b=>{
 const p=b.props||{};
 if(b.type==='heading')return '<h2>'+escape(p.text)+'</h2>';
 if(b.type==='paragraph')return '<p>'+escape(p.text).replace(/\n/g,'<br>')+'</p>';
 if(b.type==='quote')return '<blockquote>'+escape(p.text)+'</blockquote>';
 if(b.type==='feature')return '<section class="feature"><h3>'+escape(p.label)+'</h3><p>'+escape(p.text)+'</p></section>';
 if(b.type==='image'&&/^\/media\/[a-f0-9-]{36}$/i.test(p.src||''))return '<img loading="lazy" src="'+escape(p.src)+'" alt="'+escape(p.alt)+'">';
 if(b.type==='button'&&(/^\/(?!\/)[^<>]*$/.test(p.url||'')||/^https:\/\/[^\s<>]+$/i.test(p.url||'')))return '<p><a class="cta" href="'+escape(p.url)+'">'+escape(p.label||'Xem thêm')+'</a></p>';
 return '';
}).join('\n');
return '<!doctype html><html lang="'+escape(data.locale)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+escape(data.title)+' · TechBlogTip CMS</title><meta name="description" content="'+escape(data.description)+'"><style>body{margin:0;background:#f3f5f8;color:#20252b;font-family:system-ui,-apple-system,sans-serif;line-height:1.8}.sheet{margin:32px auto;padding:34px;width:min(860px,calc(100% - 30px));background:#fff;border:1px solid #e0e6e8;border-radius:12px}small{color:#647682}h1{line-height:1.3;font-size:clamp(25px,4vw,42px)}h2{line-height:1.4}p{hyphens:none}img{max-width:100%;height:auto}blockquote{background:#f0f8f7;border-left:4px solid #00a99d;margin:22px 0;padding:15px}.feature{background:#e7f6f2;padding:20px;border-radius:8px}.cta{background:#20252b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none}@media(max-width:600px){.sheet{margin:8px auto;padding:17px}}</style></head><body><article class="sheet"><small>TechBlogTip CMS · Published page</small><h1>'+escape(data.title)+'</h1><p>'+escape(data.description)+'</p>'+blocks+'</article></body></html>';
}
