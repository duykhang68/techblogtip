import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const expect=['index.html','robots.txt','sitemap.xml','release.json','chuyen-muc/index.html','chu-de/index.html','the/index.html','sitemap/index.html','404.html'];
for(const path of expect)if(!existsSync(resolve('dist',path)))throw new Error('Missing dist/'+path);
const html=readFileSync('dist/index.html','utf8');
const production=process.env.PUBLIC_INDEXABLE==='true';
const sitemapHtml=readFileSync('dist/sitemap/index.html','utf8');
const publicPathPrefix=process.env.DEPLOY_TARGET==='github-pages'?'/techblogtip':'';
if(!html.includes('href="'+publicPathPrefix+'/sitemap/"'))
  throw new Error('Global footer is missing the public HTML sitemap link');
if(!sitemapHtml.includes('href="'+publicPathPrefix+'/sitemap.xml"'))
  throw new Error('HTML sitemap must link the canonical XML sitemap');
if(!sitemapHtml.includes('aria-label="Sơ đồ cấu trúc website TechBlogTip"'))
  throw new Error('HTML sitemap is missing semantic navigation');

if(!html.includes('lang="vi"'))throw new Error('Vietnamese language marker missing');
if(!html.includes(production?'index,follow':'noindex,nofollow'))
  throw new Error(production?'Production must be indexable':'Staging must remain noindex');
const robots=readFileSync('dist/robots.txt','utf8');
if(!robots.includes(production?'Allow: /':'Disallow: /'))
  throw new Error('Robots policy does not match build environment');
const sitemap=readFileSync('dist/sitemap.xml','utf8');
if(!sitemap.includes('<urlset'))throw new Error('Sitemap malformed');
if(process.env.DEPLOY_TARGET==='github-pages'){
  const prefix='/techblogtip/';
  if(!html.includes('href="'+prefix+'"')||!html.includes('href="'+prefix+'favicon.svg"')||
     !html.includes('href="https://duykhang68.github.io'+prefix+'"'))
    throw new Error('GitHub Pages base-path navigation, favicon, or canonical is missing');
  if(!sitemap.includes('https://duykhang68.github.io'+prefix))
    throw new Error('Sitemap URLs must use the GitHub Pages project path');
  if(!robots.includes('https://duykhang68.github.io'+prefix+'sitemap.xml'))
    throw new Error('Sitemap directive must reference GitHub Pages subpath');
}

// Retired public routes must not be published.
for(const path of ['ban-do-kien-thuc/index.html','tim-kiem/index.html','branding/index.html','rss.xml','search-index.json']){
  if(existsSync(resolve('dist',path)))throw new Error('Retired feature must not be published: '+path);
}

// Resume Studio was retired; fail CI if its former public route reappears.
if(existsSync(resolve('dist/tools/resume/index.html')))throw new Error('Retired Resume Studio route must not be published');
const release=JSON.parse(readFileSync('dist/release.json','utf8'));
const sha=process.env.SOURCE_SHA || process.env.GITHUB_SHA;
if(process.env.GITHUB_ACTIONS==='true' && release.sha!==sha)throw new Error('Built release SHA mismatch');
console.log('Verified HTML, sitemap, noindex, retired routes and exact SHA marker');


// Visualizer publication gate: every article with 2+ H2 sections must render its story map.
import { readdirSync } from 'node:fs';
const articlesDir=resolve('src/content/articles');
// An explicit new editorial request allows the GitHub CLI guide alongside the retained PageSpeed article.
const approved=[
  'techblogtip-100-diem-google-pagespeed-insights.md',
  'xoa-nhieu-repository-github-cli-an-toan.md',
].sort();
const authored=readdirSync(articlesDir).filter(n=>n.endsWith('.md')).sort();
if(JSON.stringify(authored)!==JSON.stringify(approved))
  throw new Error('Published sources must match the two explicitly approved articles');
const builtSlugs=readdirSync(resolve('dist/bai-viet'),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
const expectedSlugs=approved.map(name=>name.replace(/\.md$/,'')).sort();
if(JSON.stringify(builtSlugs)!==JSON.stringify(expectedSlugs))
  throw new Error('Built article routes contain removed or missing posts');
for(const slug of builtSlugs){
  const href=publicPathPrefix+'/bai-viet/'+slug+'/';
  if(!sitemapHtml.includes('href="'+href+'"'))
    throw new Error('HTML sitemap is missing the published article URL: '+href);
}
if(!sitemap.includes(publicPathPrefix+'/sitemap/</loc>'))
  throw new Error('XML sitemap is missing the public HTML sitemap route');

for(const name of readdirSync(articlesDir).filter(n=>n.endsWith('.md'))){
 const source=readFileSync(resolve(articlesDir,name),'utf8');
 if(/^draft:\s*true\s*$/m.test(source))continue;
 const sections=[...source.matchAll(/^##\s+.+$/gm)].length;
 const slug=name.replace(/\.md$/,'');
 const built=resolve('dist/bai-viet',slug,'index.html');
 if(!existsSync(built))throw new Error('Visualizer gate: missing built article '+slug);
 const markup=readFileSync(built,'utf8');
 if(sections>=2 && !markup.includes('data-auto-visualizer'))
  throw new Error('Visualizer gate: missing auto-generated story map for '+slug);
 if(slug==='xoa-nhieu-repository-github-cli-an-toan' && !markup.includes('data-repo-deletion-flow'))
  throw new Error('Visualizer gate: GitHub CLI article needs its safety flow');
 if(slug==='techblogtip-engineering-rules' && (!markup.includes('ENGINEERING CONTRACT') || !markup.includes('RELEASE TRUST CHAIN')))
  throw new Error('Visualizer gate: engineering rules diagrams not rendered');
}
console.log('Verified auto-generated visual story maps on all eligible public articles');
