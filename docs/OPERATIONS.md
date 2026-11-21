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

## Understanding skipped GitHub Actions

GitHub Actions does not provide arbitrary labels for workflow runs. We use `run-name` as a no-runner-cost reason label, visible in the **Actions** run list even when the job-level `if` prevents a runner from starting.

| Run title | Meaning | Next action |
| --- | --- | --- |
| `SKIP OK · <workflow> passed` | Upstream CI completed successfully. **CI Incident Collector** has no failure to record; expected skip. | None. |
| `COLLECT INCIDENT · <workflow>: <conclusion>` | Upstream failed, timed out, requested action, or did not start. The collector should create or update a deduplicated GitHub Issue. | Check the collector job and incident Issue. |
| `SKIP REVIEW · <workflow>: <conclusion>` | Upstream was cancelled, skipped, neutral, etc. Collector intentionally does not classify it as a failure, **but that does not prove CI passed**. | Inspect upstream run; rerun or investigate when appropriate. |
| `BACKFILL · workflow_dispatch/push` | The collector was started manually or its own code changed. It scans recent failures. | Check job logs for scan results. |
| `SKIP · ... requires main` | A manual deployment or canary was launched from a non-`main` ref and is correctly blocked. | Select `main` for manual runs. |
| `SKIP · ... confirmation` | Publisher DEV was not explicitly authorized by the `deploy-dev-only` input. | Re-dispatch with the expected input on `main`. |

Production release also has an optional Sheets M:O writeback step. When `TBT_PRODUCTION_SYNC_TOKEN` is absent, the opposite explanatory step emits a notice **and a job summary**. This does **not** imply production deployment failed; confirm the live SHA verification separately.

Path-filtered workflows may **not start at all** if their watched files have not changed. Missing runs are not equivalent to green checks; inspect the `on.paths` filters before deciding a check is intentionally omitted.

These titles apply only to **new runs after the workflow update reaches `main`**. GitHub cannot retroactively rename historical skipped runs. All checks, main-only guards, write-token restrictions, and event-driven behavior remain unchanged.
