# TechBlogTip · Google Sheets Publisher · Milestone B/P5b

**Project:** duykhang68/techblogtip ONLY. The existing Cloudflare public staging Worker is not modified by this backend.

## What this PR delivers

- Separate Cloudflare Worker source at workers/publisher (never bundled into Astro public pages).
- Google Identity Services sign-in and **server-side RS256 signature/claims verification** against Google's published JWKS.
- Strict Google editor email allowlist (configured at Worker runtime).
- Read-only preview of VN rows from the dedicated TechBlogTip Sheet; no public client-side Google or GitHub API credentials.
- Explicit system ID assignment in column A. The backend re-reads the row after assignment.
- Source revision SHA-256 and READY-only server-side publication checks.
- Create GitHub **Draft PR** on a source-specific branch, with idempotent retry when identical source revision already has an open PR.
- Write back *only* system columns K–L once a Draft PR exists and the row revision has been rechecked.
- Reject HTML markup in imported Markdown. Images are local WebP with descriptive alt text.
- Automated mock-integration tests: Google OIDC signature/claims, row authorization, id assignment, draft-only GitHub flow, stale source and repeat submission.

**This PR does not yet create a live Worker, connect OAuth credentials or publish an article.**
Do not merge, deploy, or expose a write-capable API until all security gates and runtime bindings are reviewed.

## Workflow

\`\`\`
Google Sheet VN → Google sign-in → read rows → Preview
    → [create system ID if missing]
    → Editor changes status in Sheet to READY
    → Worker re-reads source and calculates SHA-256 revision
    → user confirms Create Draft PR
    → Worker re-reads revision and status
    → GitHub branch + Markdown commit + Draft PR
    → Worker re-reads source by stable source ID (not row index)
    → fill source_hash (K) and draft_pr (L)
    → human review → CI → FIFO merge → verified Cloudflare production SHA
    → [future milestone] release_sha/published_url/published_at
\`\`\`

## Required one-time setup (not present in repository)

1. **Google Cloud project**: configure OAuth consent screen and create a Google Identity Services **Web client ID**. Add the actual private admin Worker origin to Authorized JavaScript Origins (for example, \`https://techblogtip-publisher-dev.<your-workers-subdomain>.workers.dev\`). Do not reuse another blog's OAuth client.
2. **Service account**: create a separate service account with minimum Sheets access. Share the dedicated TechBlogTip Spreadsheet only with its service-account address, with Editor rights for system columns. Drive access is NOT needed for this API.
3. **GitHub**: create a least-privilege publisher token or GitHub App installation scoped to **techblogtip only**, with Contents Read/Write and Pull Requests Read/Write. Do not reuse OneBlog's token; never expose it to JS.
4. **Cloudflare**: use \`workers/publisher/cloudflare.config.ts\` with the **cf CLI**, not Wrangler. Add nonsecret variables \`GOOGLE_OAUTH_CLIENT_ID\`, \`ALLOWED_EDITORS\`, \`SHEETS_SPREADSHEET_ID\`, \`SHEETS_GID\` to Worker configuration. Put \`GOOGLE_SERVICE_ACCOUNT_JSON\` and \`GITHUB_PUBLISHER_TOKEN\` into **encrypted Worker secrets**. Do not commit any .env containing credentials.
5. Deploy this Worker separately **only after** unit/integration tests, credential binding and explicit admin access controls have passed. Do not deploy to \`techblogtip-staging\`.
6. Configure Cloudflare WAF Rate Limiting (and optionally Access) for the admin Worker to reduce abusive public requests.

## Runtime routes

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | /health | Public | No sensitive config |
| GET | /admin | Public shell | No data until Google auth |
| GET | /admin.js, /admin.css | Public assets | In-memory client token only |
| GET | /api/rows | Authenticated editor | VN sheet rows |
| GET | /api/revision?sourceId=... | Authenticated editor | Current READY source revision |
| POST | /api/allocate-id | Authenticated editor + same origin | System A ID, reread |
| POST | /api/submit | Authenticated editor + same origin | Revision check → Draft PR → K/L writeback |

Only same-origin browser POST is accepted. Every API endpoint verifies the Google ID token signature, issuer, audience, expiry, verified email and allowlist.

## Acceptance and known remaining work

- [ ] PR Quality and Security Audit PASS on exact SHA.
- [ ] Review Google OAuth and service-account access policies (separate user credentials needed).
- [ ] Real authorized login; verify unauthorized editor denied.
- [ ] DRAFT cannot create a PR; READY can create precisely one Draft PR.
- [ ] Sort rows, retry request and simulate stale data between read and write.
- [ ] Check that GitHub token, Google service key and sheets author content never enter client-side bundled scripts.
- [ ] Confirm K/L writeback after PR and no write to M/N/O before **verified production**.
- [ ] E2E deployed Worker → real new Sheet → GitHub Draft PR.

**Concurrency caveat:** the Google Sheets Values API lacks compare-and-swap for cell updates. The current source-ID allocation and K/L writeback re-read and reject many stale requests, but cannot guarantee transactional uniqueness under simultaneous writes. Add a per-source Cloudflare Durable Object (or another lock) before enabling multi-editor concurrent publishing. Until then keep the Worker undeployed or single-editor and manually supervised.

**P5c is still required:** Google Drive→WebP media import, rich WYSIWYG editor, CI feedback and verified production release writeback. No cron or repeated polling is part of this implementation.

## Tests

Run \`npm test\`, or only publisher tests with \`npm run publisher:test\`. Tests use generated local cryptographic keys and mocked Google/GitHub responses; they do not call real APIs, and do not need secrets.


## Deployment workflow: strictly manual and exact-SHA checked

Workflow: \`.github/workflows/deploy-publisher-dev.yml\`, **workflow_dispatch only** on reviewed \`main\`. It cannot be triggered by PR creation, merges, Cron, or main pushes. The job uses the \`techblogtip-publisher-dev\` environment and deploys only the separate Worker \`techblogtip-publisher-dev\`.

Configure these **new TechBlogTip GitHub Actions Secrets** in the environment (or scoped repository secrets). The old blog credentials must never be reused:

| Secret | Purpose |
| --- | --- |
| \`TBT_GOOGLE_OAUTH_CLIENT_ID\` | New Google Identity Services web-client ID, authorized origin for Publisher Worker |
| \`TBT_ALLOWED_EDITORS\` | Exact comma-delimited editor emails; no wildcard |
| \`TBT_SHEETS_SPREADSHEET_ID\` | Dedicated TechBlogTip native Google Sheet, tab VN |
| \`TBT_SHEETS_GID\` | Pinned numeric GID for tab VN |
| \`TBT_GOOGLE_SERVICE_ACCOUNT_JSON\` | Entire JSON for a **new** service account granted Editor on only this Sheet |
| \`TBT_GITHUB_PUBLISHER_TOKEN\` | New GitHub fine-grained token/App installation, restricted to \`duykhang68/techblogtip\`, Contents/Pull Requests write |

The GitHub Actions secret \`CLOUDFLARE_API_TOKEN\` is also required; its Cloudflare permissions must allow Workers deployment. Nonsecret \`CLOUDFLARE_ACCOUNT_ID\` may be set via Actions variable or will use the authorized staging account ID. Access should be restricted to the required account.

Before release, the workflow checks **all** required bindings and validates JSON with no logging, builds the Worker, writes a temporary file with \`0600\` permissions, and runs \`cf deploy --secrets-file\`. It deletes the temporary file even if deploy fails. The public smoke test checks \`/health\` exact SHA, \`/admin\` noindex, and unauthorized \`/api/rows\` returns 401. It never makes an authorized request or creates an article. The real OAuth+Sheets+Draft PR E2E remains a separate manual acceptance gate.

Run the workflow via \`https://github.com/duykhang68/techblogtip/actions/workflows/deploy-publisher-dev.yml\` after configuring secrets. Choose the required \`deploy-dev-only\` confirmation. The workflow uses \`concurrency\` with no cancellation.

**Security note:** Even with server-side OAuth allowlisting, deploy only after validating the authorized Google client origin and setting up WAF/Cloudflare Access and a single responsible editor. The current Google Sheets Values API implementation lacks transactional row locking; do not use concurrent editors until a Durable Object/source lock is implemented.


## Persistent browser session (post-P5b UX enhancement)

After Google Identity Services grants an authorized editor's Google ID token, the
Worker verifies the Google signature and allowlist, then issues a purpose-signed
**7-day** cookie (HttpOnly, Secure, SameSite=Strict, Path=/). Reloading the same
browser or reopening it within seven days automatically restores the editor session
through \`GET /api/session\` and fetches the Sheet without another Google prompt.
\`DELETE /api/session\` removes the browser cookie on explicit logout.

No Google ID token, GitHub token, or service-account credential is stored in
\`localStorage\`, \`sessionStorage\`, or JavaScript-managed cookies. Every Worker
API request checks the cookie signature, expiry, and current allowed-editor list;
mutating requests remain same-origin only. A modified or expired cookie fails closed.
This is a same-browser convenience session, not permanent Google OAuth refresh access:
after seven days, log in again. Google OAuth settings and access rules still apply.

Without requiring another Actions secret, the Worker currently derives a
purpose-separated HMAC signer using HKDF from its existing high-entropy GitHub
Publisher token. Rotating that token invalidates previous browser sessions.
Optionally supply a **separate** Worker secret named \`SESSION_SIGNING_KEY\`
(minimum 20 characters) to decouple the cookie lifetime from GitHub token rotation.
This value must only exist in encrypted Worker bindings, never in public page JS.


## Read-only Preflight Diagnostics (next P5b acceptance step)

The authenticated admin page provides a **Kiểm tra kết nối** button.
\`GET /api/preflight\` uses the current editor session and runs two isolated
nonmutating checks:

- Google service account OAuth and read-only access to the validated \`VN\` schema.
- GitHub publisher token access to \`duykhang68/techblogtip\` main SHA.

It never mutates a Google Sheet, creates a GitHub branch or opens a PR.
It returns restricted status codes rather than upstream error bodies or secrets.
**A successful read-only test does NOT prove GitHub Contents/PR write permissions.**
Those are validated only by the explicit, separate READY→Draft PR human acceptance step.


## Live read-only integration canary

Workflow: \`.github/workflows/publisher-live-readonly-canary.yml\`. It runs once
after this feature is merged into trusted main, and is also manually dispatchable.
It does not deploy or mutate any resources. It checks the real Google service
account access to the pinned \`VN\` Sheet, the scoped GitHub token's ability to
read main, Publisher DEV health SHA, noindex admin, and HTTP 401 for anonymous
\`/api/rows\` and \`/api/preflight\`. The Worker SHA must be an ancestor of
the tested main SHA.

Only the Google OAuth service-account token exchange POST is used; all Google
Sheets and GitHub requests are GET. No private source content is printed.
A passing result **does not validate GitHub write permissions** or the actual
READY → Draft PR → K:L writeback path; those require explicit editor acceptance.

## P5c.1 — On-demand PR/CI tracking

Authenticated `GET /api/pr-status?sourceId=<TBT-ID>` re-reads the pinned Sheets row,
validates the registered PR URL belongs to `duykhang68/techblogtip`, checks GitHub
source-id, source-revision, expected source branch, base main and exact head SHA.
It returns Draft / Review / Merged / Closed and does not mutate Google Sheets or GitHub.

For open PRs the Worker attempts optional `Checks: Read` access via GitHub check-runs
on the **same head SHA**. Tokens restricted to Contents and Pull requests may lack this
permission; when missing, the result is unavailable, NEVER a passing CI result.
Even successful reported checks do not verify production release or authorize merge.
The admin offers `Kiểm tra PR/CI` only when the Sheet has a recorded PR. No polling,
cron, auto-undraft, auto-merge or release writeback. Browser never calls GitHub API.

This enhancement is effective on Publisher DEV only after the separate manual
deployment workflow has verified the deployed `/health` exact SHA.


## P5c.2 · Visual drafting, first safe slice

The Publisher Admin includes a **Sửa trực quan** button for rows with system ID
in IDEA, DRAFT or REVIEW that have not been sent to GitHub or published.
\`GET /api/draft?sourceId=...\` loads an editable row and SHA-256 snapshot of its
source identity plus all 15 Google Sheets cells.
\`PUT /api/draft\` requires an authorized Google editor, same-origin request,
the original snapshot and exactly eight editor-owned values. It fails with 409
if the source changed, status became READY, or any K:O release/PR cell is filled.

The server allows only an atomic Google Sheets batchUpdate to **B:H and J**;
it never changes system ID A, human workflow status I or system K:O.
It rereads the Sheet after saving to detect unexpected changes. Validation
rejects raw HTML, executable Markdown links, unsupported media and malformed
metadata. Draft text may be shorter than READY validation's publication minimum;
\`/api/submit\` retains the strict READY content checks.

The first WYSIWYG canvas supports headings H2/H3, paragraphs, lists, bold/italic,
undo/redo and plain-text paste. Advanced Markdown such as links, images,
fenced code and tables is **view-only** in this slice to prevent destructive
round trips; continue editing those articles in the original Google Sheet.
No media upload is enabled. Manual save only; no cron or autosave, no local
credential storage. Reloading the browser does not retain unsaved edits.

**Single-editor restriction remains in force:** the Google Sheets Values API has
no compare-and-swap. An external writer changing source cells between the last
read and batch write can still race, despite snapshot checks and post-write
verification. Multi-editor usage awaits a transactional per-source lock.

## Markdown integrity fix for the visual draft editor

The editor now retains the **exact original `body` from the authorized Sheet** when the visual canvas has not changed, even when a user edits metadata such as title, summary or tags. Contenteditable's implicit paragraph spacing must never rewrite source Markdown on a metadata-only save. Only deliberate changes in the visual body are serialized. Successful saves reset the original-body baseline using the canonical server response; a 409 conflict disables further writes until the editor is reloaded. This still requires a separate per-source lock before concurrent writers can be enabled.

## P5c.2 · Source-level write coordination (Durable Objects)

Publisher DEV now uses a **SQLite-backed SourceWriteLock Durable Object**, deterministically
keyed by spreadsheet, GID, and source ID. Each request that writes editorial
cells or creates a GitHub Draft PR must first acquire a 120-second lease.
Source ID allocation uses a separate key scoped to the pinned row number.

- Simultaneous Publisher requests for the same source are rejected with HTTP
  **409 source_busy** instead of racing across Sheets and GitHub.
- Locks are released in a finally block; a Worker crash cannot leave one
  permanently held because the SQLite lease expires after two minutes.
- If the binding is missing/unavailable, the Worker returns **503** and does
  not attempt writes. The manual Publisher DEV deployment will verify that the
  binding is present on the public health endpoint at the exact SHA.
- Each source gets its own Durable Object, so unrelated articles are not blocked.
- This uses `cf/config` with `bindings.durableObject` and a
  `exports.durableObject({storage:'sqlite'})` declaration. Cloudflare account
  support and usage charges for Durable Objects may apply.
- **Important limitation:** a separate person editing cells directly in Google
  Sheets cannot be forced to acquire the Worker lock. The SHA-256 snapshot
  precondition plus post-write verification still help detect such edits,
  but this is *not* a Google Sheets transaction-level compare-and-swap.
  Do not claim fully lossless multi-editor concurrency for external Sheet edits.

No automatic merges, public deployment, polling, or privileged browser token.

## Editorial readiness validation (read-only)

The authenticated admin offers a **Kiểm tra bài** button for rows with
system-issued IDs. `GET /api/validate?sourceId=...` reads the actual pinned
Google Sheet and runs the **same content preparation checks** that would apply
to READY, without changing the real status cell I. It returns whether the
content is technically valid, whether the row is truly READY, whether any
system-managed K:O cells are already populated, and concise validation errors.

Passing content checks is **not editorial approval**. A DRAFT row must remain
DRAFT until a human editor approves and explicitly changes it to READY in
Google Sheets. This endpoint never opens PRs, writes Google Sheets, or marks
anything published. Existing PRs require review rather than re-submission.
