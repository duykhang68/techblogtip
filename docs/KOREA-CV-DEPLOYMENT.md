# Korea CV Maker · integration and activation checklist

This file describes a **private CV tool**, not a blog content publisher. No applicant records should ever be checked in.

## Sequence (one reviewable PR per component)
1. #132 Contract (six-page historic source; no trademark or sample data)
2. #134 Blank schema + validation
3. #136 Astro two-tab input UI
4. #138 Independent Drive-only private Cloudflare Worker
5. #139 GIS OAuth and multi-company CRUD (stacked on #136)
6. #141 A4 Korean print/PDF (stacked on #139)
7. #143 Real six-sheet XLSX (stacked on #141)
8. Deployment gates (this PR)
9. End-to-end acceptance gates (separate PR)
10. **Master integration PR**: create only after component PRs have merged (or are ready for clean cherry-picking), never assert 'production' before exact-SHA checks.

## Google Cloud setup
1. In Google Cloud Console, select the **existing TechBlogTip Publisher Google Cloud project**. Reuse the existing OAuth Web Client ID already referenced by GitHub secret `TBT_GOOGLE_OAUTH_CLIENT_ID`. Do not reuse credentials from OneBlog.
2. APIs & Services → Library → enable **Google Drive API**.
3. Google Auth Platform / OAuth consent screen: declare `https://www.googleapis.com/auth/drive.appdata` (application-owned Drive app data, not full Drive access). The existing Publisher ID-token sign-in and Korea CV Drive access token use different flows: the latter requires separate user consent for `drive.appdata`. Complete relevant verification/consent requirements before general access.
4. Open the **existing OAuth Web application** client and include `https://duykhang68.github.io` in **Authorized JavaScript origins**. Add a separate staging origin when relevant. The exact website origin must match, without `/techblogtip` path.
5. At a reviewed production integration PR, expose the existing public client ID to the Astro build as `PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID` (mapped from `TBT_GOOGLE_OAUTH_CLIENT_ID` without printing it in logs), and configure `PUBLIC_KOREA_CV_API_URL` with the HTTPS Korea CV Worker origin for the production Astro build **only after acceptance**. Do not place a Google client secret in the frontend.
6. For protected DEV deployment, the workflow **reuses** `secrets.TBT_GOOGLE_OAUTH_CLIENT_ID`, `secrets.CLOUDFLARE_API_TOKEN`, and `vars.CLOUDFLARE_ACCOUNT_ID`. Confirm these existing settings are accessible to environment `techblogtip-korea-cv-dev`; repository secrets and environment-scoped secrets have different visibility. Deploy DEV only via manual main-branch confirmation workflow.
7. For production, use an independently reviewed, restricted Worker deployment and provenance check; do not treat a DEV deployment as production.

## Security and privacy
- The Google OAuth access token stays in memory; browser reload requires authorization again. Do not log or cache it.
- Drive `appDataFolder` is application-hidden; users do not see a conventional Drive folder. A visible folder would require a different scope/implementation and review.
- CORS only permits the configured GitHub Pages origin. Every GET/PUT/DELETE authenticates the Google token and validates OAuth client/scope. The user only accesses files their Google token is allowed to access.
- Worker does not copy CV content into KV, R2, GitHub, analytics, logs or Actions artifacts.
- A failure must show a truthful status; never claim saved/printed unless the operation returns successfully.
- **Still needed for acceptance:** cross-device GIS OAuth consent, worker input-shape validation shared with the schema, version conflict/concurrency safety, 413 body limits, accessible keyboard and mobile visual QA, successful authenticated CRUD, redacted logs and clean delete, Office ZIP and exact print layout.

## Manual acceptance evidence without personal information in CI
- Create a **synthetic** CV with fictional `ABC` company and non-identifying text.
- Google connect → save → reload → verify content persists; duplicate → new target company; ensure original unaffected; delete → list no longer contains the record.
- Download PDF: six historical sections, A4 printer, correct Hangul and Vietnamese glyphs, no logo, no clipping at 100% print scale. Use long text tests for multi-page overflow.
- Download XLSX: open in Microsoft Excel and LibreOffice, verify six sheets, Unicode, A4 print configuration, cell values, no error on open.
- Anonymous and foreign token attempts must receive 401/403 with no applicant response.
- CI must pass the **current exact PR head SHA**; merge FIFO; check public `release.json` exact SHA after Pages deploy.

## One-time owner activation (after all CI is green)

No new paid service or OAuth client is required. The existing TechBlogTip Publisher OAuth Web Client ID and Cloudflare account are reused.

1. **Google Cloud Console**: select the *same* Google Cloud project that owns the existing Publisher OAuth client. At **APIs & Services → Library**, enable **Google Drive API** if not already enabled.
2. **Google Auth Platform → Data access**: select **Add or remove scopes**, find/add the exact permission `https://www.googleapis.com/auth/drive.appdata`, and save. Keep current scopes unchanged. If the OAuth app remains in Testing, add the Google account used to test Korea CV under **Audience → Test users**. Publishing or verification is a distinct approval task; do not bypass it.
3. **Google Auth Platform → Clients**: open the **existing Web application Client ID** and ensure **Authorized JavaScript origins** includes `https://duykhang68.github.io` (origin only, without `/techblogtip/`). Do not create a second client unless the existing one cannot accept that origin.
4. **GitHub → techblogtip → Settings → Secrets and variables → Actions**: confirm repository secret `TBT_GOOGLE_OAUTH_CLIENT_ID` and secret `CLOUDFLARE_API_TOKEN` are accessible to the workflow, and variable `CLOUDFLARE_ACCOUNT_ID` exists. Add a single **repository variable** `PUBLIC_KOREA_CV_API_URL` with value `https://techblogtip-korea-cv-dev.tamsudev-com.workers.dev`. No secret value should be pasted into a PR, issue, chat or commit.
5. **GitHub → Actions → Deploy · Korea CV DEV (manual)**: choose branch `main`, choose confirmation `deploy-korea-cv-dev`, and start. The workflow reuses the existing Publisher OAuth Client ID. It must show an exact-SHA health check and anonymous 401 denial; a green workflow means deployed code, **not** yet live authenticated acceptance.
6. **GitHub → Actions → Deploy · GitHub Pages production**: dispatch again on `main` so the Astro build includes the new public Worker URL variable. Require the exact source SHA proof in production.
7. Open `https://duykhang68.github.io/techblogtip/tools/korea-cv/` and sign into Google. Explicitly grant the new **app data** permission; create a fictional ABC company CV, save, reload, duplicate to another company, compare PDF A4 and Excel, then delete both records.

The app must remain fail-closed (no fake 'saved' status) until all authorization and deployed API checks succeed. Never put personal applicant data in CI or GitHub. `drive.appdata` uses Google Drive's hidden app data space, not a visible My Drive folder.
