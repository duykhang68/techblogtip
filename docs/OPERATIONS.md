# Operations — foundation

## Cloudflare staging setup

The authorized Cloudflare account has the workers.dev subdomain `tamsudev-com`; staging Worker **must be uniquely named** `techblogtip-staging`. No OneBlog Worker or deployment is touched.

In GitHub `techblogtip` → Settings → Secrets and variables → Actions:
- `CLOUDFLARE_API_TOKEN`: API token scoped to deploy Workers within the correct account.
- `CLOUDFLARE_ACCOUNT_ID`: **optional GitHub Actions variable** (not a secret). Default is the verified account `d2228e3f75bc47eff64442ad8a225f85` and can be overridden with a repository/environment variable. GitHub Actions secret with this name is no longer required.

Cloudflare CLI `cf` reads `cloudflare.config.ts`. Source is built via Astro; `npx cf deploy ./dist` uploads an **assets-only Worker**. Only the staging workflow is authored in Milestone A, no production live writer.

Use the **Deploy · Cloudflare staging** workflow after `main` receives a validated merge. The workflow fails if the API token secret is absent and verifies `/release.json` only after deployment. The staging URL must stay noindex. Enforce Cloudflare Access when the preview must be private.

## Pull Request policy
1. Create Draft PR; run quality checks on the actual HEAD SHA.
2. Sync stale branch (without bypassing checks), then Ready for review.
3. Merge one PR at a time; no early merge or guessed production status.
4. Staging deploy on `main` with fixed concurrency (no cancel of in-progress deploy).
5. Verify the exact deployed public SHA; investigate failure rather than reporting success.

## Local
```bash
npm install
npm run quality
npm run dev
```

## SEO prelaunch
- The site emits staging canonical URLs and `noindex` by default.
- Before public launch, decide brand and domain, set `SITE_URL`, set `PUBLIC_INDEXABLE=true`, validate sitemap/robots/canonicals, then enable search indexing.
- Search Console and real keyword data will be added in a later milestone.
