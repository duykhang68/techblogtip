# Production sitemap & Google indexing monitoring

## Automated deployment gate
After the existing exact-SHA release proof, `deploy-production.yml` runs `scripts/verify-live-sitemap.mjs`. It fetches live `/techblogtip/sitemap.xml` (HTTP 200, XML format, schema namespace, nonempty and unique canonical URLs), checks `robots.txt`, and fetches homepage plus up to five article URLs to confirm HTTP 200, canonical and `index,follow`. Failure marks the deploy workflow red **after publication**; it does not roll back the Pages artifact. Inspect Actions job summary. Build-time `seo:audit` remains unchanged.

## Google Search Console (optional, read-only)
The trusted `deploy-production.yml` job performs read-only URL inspection immediately after live sitemap verification succeeds. `seo-index-monitor.yml` is manual-dispatch only; no privileged `workflow_run` trigger is used. Neither workflow uses a daily cron or submits URLs to Google's Indexing API.

The Google URL Inspection API requires an authorized identity. To enable:
1. In Google Cloud, enable **Search Console API** and create a dedicated service account. Create its JSON key and store the entire JSON in GitHub Actions secret `GSC_SERVICE_ACCOUNT_JSON`. Do not commit the key, print it or use it in frontend code.
2. In Search Console, add the service-account email as an authorized user of the exact URL-prefix property (for example `https://duykhang68.github.io/techblogtip/`). Set repository Actions variable `GSC_SITE_URL` to the exact property URL if it differs from the default.
3. Run **Actions → SEO · Google indexing monitor → Run workflow** after the change is on `main`. Check the job summary.

If the secret is missing, the job reports **SKIP** without inventing indexing data. If Google refuses inspection for an individual URL, it reports **UNKNOWN**, not `Not indexed`. The monitor samples the homepage and up to nine article URLs, so totals are for that sample only. Google status can lag behind the public sitemap.

## Not included
No promise of indexing, no automatic daily resubmission, no OAuth tokens on public Pages, and no claim that a public HTTP 200 response proves Google has indexed a URL.
