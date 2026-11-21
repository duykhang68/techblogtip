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
1. In Google Cloud Console, select the Google Cloud project for **TechBlogTip Korea CV only**.
2. APIs & Services → Library → enable **Google Drive API**.
3. Google Auth Platform / OAuth consent screen: declare `https://www.googleapis.com/auth/drive.appdata` (application-owned Drive app data, not full Drive access). Complete relevant verification/consent requirements before general access.
4. Create OAuth **Web application** client ID and include `https://duykhang68.github.io` in **Authorized JavaScript origins**. Add a separate staging origin when relevant. The exact website origin must match, without `/techblogtip` path.
5. Configure GitHub repository/environment variable `PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID` with the *public client ID* and `PUBLIC_KOREA_CV_API_URL` with the HTTPS Korea CV Worker origin for the production Astro build **only after acceptance**. Do not place a Google client secret in the frontend.
6. In protected GitHub environment `techblogtip-korea-cv-dev`, configure `KOREA_CV_GOOGLE_CLIENT_ID` and Cloudflare API credentials. Deploy DEV only via manual main-branch confirmation workflow.
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
