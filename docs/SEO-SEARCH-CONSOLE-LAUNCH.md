# Milestone D — GitHub Pages SEO launch and Google Search Console

## Fixed release destination
Public production is **https://duykhang68.github.io/techblogtip/** (GitHub Pages URL-prefix property). Cloudflare staging is an independent noindex preview. Do not claim a custom domain or DNS ownership.

## Automatically enforced in CI
- Each Quality build runs `npm run seo:audit` after the Astro build.
- The gate audits generated HTML title, Vietnamese language, description, canonical URL and robots directive; rejects conflicting public/staging indexing.
- The gate validates sitemap URL prefixes, duplicates and expected taxonomy routes.
- Production `deploy-production.yml` builds with `DEPLOY_TARGET=github-pages`, `PUBLIC_INDEXABLE=true` and `SITE_URL=https://duykhang68.github.io/techblogtip/`. Live Pages deployment separately proves public release exact SHA.
- Staging remains `noindex,nofollow` with robots disallow, and will not receive Search Console verification metadata.
- The Google verification tag is emitted **only** for the Pages base path and a valid `PUBLIC_GSC_VERIFICATION` token. Missing token leaves the tag out; it does not imply ownership.

## Final owner verification (requires the Google property account)
1. Open Google Search Console at https://search.google.com/search-console and choose **URL-prefix** property **https://duykhang68.github.io/techblogtip/**, not the GitHub domain root and not a Domain property.
2. Select the **HTML tag** verification method; copy only the `content` token value (not a whole HTML tag).
3. Set GitHub Actions repository or **github-pages** environment variable `PUBLIC_GSC_VERIFICATION` to that token. Do not use the Sheets OAuth client ID or an invented token. Keep the token in the intended property owner's possession.
4. Deploy trusted main via the existing production workflow after required checks pass. Confirm public source contains `<meta name="google-site-verification" content="...">` within the head at the project root.
5. Click **Verify** in Search Console. Submit sitemap URL **https://duykhang68.github.io/techblogtip/sitemap.xml**.
6. Confirm coverage and performance over time in Search Console; initial indexing, rank, click counts and crawl dates cannot be guaranteed by deployment or CI.

This workflow does not automatically call Google Search Console or claim that a property is verified. It needs the owner's Google-side verification action, or a delegated verified-property API permission.

## Verification evidence
Record the source PR head SHA, merged commit SHA, deploy run, public release marker and Search Console property verification status separately. Do not mark D complete until Google Search Console itself confirms ownership.
