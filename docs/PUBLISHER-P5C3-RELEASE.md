# P5c.3 — Verified release writeback to Google Sheets M:O

## Publication proof

A TechBlogTip article reaches **100% — Đã đăng** only when all these gates pass:

1. The Sheets VN row is READY or PUBLISHED and its current fingerprint recomputes to K. L is a source-bound GitHub PR.
2. The PR has actually **merged into main**. Exact-head CI has a completed successful Quality check and no incomplete/failed checks.
3. The public production release.json contains project techblogtip, ref main, valid 40-character release SHA and build timestamp.
4. The real HTTPS production article URL /bai-viet/{slug}/ responds 200 HTML without redirect and contains the correct source ID, source revision, canonical URL and index,follow robots tag.
5. GitHub verifies the merge commit is an ancestor of the public release SHA, which must itself be in main history.

The Worker then writes **only M:O** (canonical URL, public release SHA and UTC *verification* timestamp), inside the existing per-source Durable Object lease. It re-reads A:O, refuses concurrent edits, and never overwrites partial or conflicting release metadata. Replays preserve the original publication timestamp.

The GET /api/pr-status route checks the current public evidence before returning productionVerified=true. Neither a status PUBLISHED in column I nor an existing M:O triple alone proves publication.

## GitHub Pages production — selected target

**Production:** https://duykhang68.github.io/techblogtip/

**Publisher:** https://techblogtip-publisher-dev.tamsudev-com.workers.dev/admin/

Cloudflare `techblogtip-staging` remains an independent noindex preview.
The earlier suggested `seomoney.org` domain is not used, and no production
Cloudflare assets Worker or Cloudflare production secret is required.

The repository deploys the static Astro site from trusted `main` using the
pinned GitHub Pages Actions: configure-pages, upload-pages-artifact and
deploy-pages, within the standard protected **github-pages** environment.
Production uses Astro `base=/techblogtip`, indexable HTML, project-prefixed
navigation, sitemap and RSS. It verifies public `/techblogtip/release.json`
and exact SHA before attempting article reconciliation.

**Required once in GitHub UI** (Admin permission needed):
1. In [Settings → Pages](https://github.com/duykhang68/techblogtip/settings/pages),
   set **Build and deployment → Source: GitHub Actions** (not "Deploy from a
   branch"). Confirm any previous GitHub Pages custom domain field is empty.
2. Configure environment **github-pages** with a protection rule if desired.
   Only `secrets.TBT_PRODUCTION_SYNC_TOKEN` is needed there for automated
   writeback; public URL is fixed in repo and needs no Environment variable.
3. Configure environment **techblogtip-publisher-dev** with the **same**
   `secrets.TBT_PRODUCTION_SYNC_TOKEN` value, generated securely (32–256
   characters). `TBT_PRODUCTION_SITE_URL` is pinned to the GitHub Pages
   URL by the Publisher deployment workflow; no custom-domain variable needed.
4. After merging this PR, manually deploy the **Publisher DEV** Worker once
   via `deploy-dev-only` so it knows the Pages target and sync token.
5. GitHub Pages production builds/deploys on every `main` push. It verifies
   the public URL, release SHA, robots and canonical. The same protected job
   calls signed, source-locked **M:O** reconciliation. If the sync secret is
   not yet installed, Pages may deploy successfully, but automated writeback
   is skipped and the Editor still offers manual verification when eligible.

A real, approved Sheets article must have a merged PR and be present in a
verified GitHub Pages release before any M:O cell is written. PR #35 was an
unmerged test; do not publish it.

## Manual inspection

The signed-in Editor exposes **Xác minh & ghi M:O** once its on-demand PR inspection confirms a merge. This calls POST /api/verify-release with same-origin protection and the Google editor session. It provides a safe manual recovery path but cannot bypass any proof.

The trusted post-GitHub-Pages-deployment route POST /api/reconcile-production is **not** a public webhook: it requires a private service token and a verified active or successfully completed main production workflow run, then uses the existing source locks. No cron or scheduled polling is introduced.

**Safety:** staging, Publisher DEV, unmerged PRs, stale editorial revisions, missing CI evidence, missing production domain, wrong source ID, bad canonical, non-indexable content, incorrect ancestry, and conflicting release metadata all fail closed. The old test PR #35 stays closed and must never be merged.

See also docs/PUBLISHER-PROGRESS.md for six-stage Editor UI.

## Workflow name is part of the production callback contract

Publisher Worker requires the GitHub Actions `workflow_runs.name` to be **exactly** `Deploy · GitHub Pages production` before trusted M:O writeback. GitHub `run-name` overrides that API field. On `main` the workflow must preserve the exact trusted title; non-main manual dispatches can still display `SKIP · production requires main`. A dynamic main title such as `Deploy production · SHA ...` causes the Worker to reject the callback with `403 release_sync_untrusted`, even after Pages successfully deploys. The regression test in `tests/publisher-release-proof.test.mjs` protects this contract.
