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

## Activation prerequisites

The repository currently **has no separate production public site**, so nothing can be marked published yet. To activate:

1. Configure an approved HTTPS custom domain for the distinct Cloudflare assets Worker techblogtip-production (not a staging workers.dev/pages.dev URL). Add GitHub protected environment techblogtip-production, variable TBT_PRODUCTION_SITE_URL and CLOUDFLARE_ACCOUNT_ID, scoped secret CLOUDFLARE_API_TOKEN. GitHub environment approval should protect deployments.
2. In protected techblogtip-publisher-dev environment, set the matching variable TBT_PRODUCTION_SITE_URL and secret TBT_PRODUCTION_SYNC_TOKEN (cryptographically random 48+ chars). Add the *same* secret in the production environment for post-deploy synchronization. Do not put this value in code or client JavaScript.
3. Manually deploy the Publisher DEV Worker from main via deploy-dev-only and verify its health exact SHA.
4. Manually dispatch **Deploy · Cloudflare production** on main, choosing deploy-production-only. It builds indexable Astro, targets only the production Worker using explicit cf mode, and verifies the custom public domain SHA, canonical and robots.
5. Only after that workflow succeeds, **Publisher · Reconcile verified production writeback** runs via workflow_run event. Its protected callback token is validated by the Worker against the actual successful GitHub workflow run and release SHA; it scans Sheet rows in bounded batches, verifies each merged article, then writes eligible M:O cells.

## Manual inspection

The signed-in Editor exposes **Xác minh & ghi M:O** once its on-demand PR inspection confirms a merge. This calls POST /api/verify-release with same-origin protection and the Google editor session. It provides a safe manual recovery path but cannot bypass any proof.

The automated route POST /api/reconcile-production is **not** a public webhook: it requires a private service token and a verified successful main production workflow run, then uses the existing source locks. No cron or scheduled polling is introduced.

**Safety:** staging, Publisher DEV, unmerged PRs, stale editorial revisions, missing CI evidence, missing production domain, wrong source ID, bad canonical, non-indexable content, incorrect ancestry, and conflicting release metadata all fail closed. The old test PR #35 stays closed and must never be merged.

See also docs/PUBLISHER-PROGRESS.md for six-stage Editor UI.
