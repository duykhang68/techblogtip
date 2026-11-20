# TechBlogTip Google Sheets Publisher · P5 contract

This is an **isolated new project** under `duykhang68/techblogtip`, not OneBlog or `khoahoctienghan`. No spreadsheet or Google Drive folder IDs have been selected. Do not copy legacy IDs, credentials or Worker names.

## Purpose of this first PR

Implement a pure row-to-content adapter with tests, source fingerprinting and strict validation before enabling OAuth, Google APIs or GitHub PR writes. This is **not yet a live Publisher** and intentionally exposes no unauthenticated web UI.

## Google Sheets workbook: tab `VN`

| Column | Header | Owner | Meaning |
| --- | --- | --- | --- |
| A | source_id | SYSTEM | Stable `TBT-...` ID independent of row number |
| B | title | EDITOR | Article title |
| C | body | EDITOR | Raw draft body; may contain headings/lists |
| D | author | EDITOR | Verified byline (not derived from email without consent) |
| E | category | EDITOR | Explicit taxonomy |
| F | tags | EDITOR | Comma/semicolon-separated tags |
| G | summary | EDITOR | SEO description (25–200 characters) |
| H | series | EDITOR | Optional series |
| I | status | EDITOR | IDEA → DRAFT → REVIEW → READY |
| J | slug | EDITOR | Optional lowercase slug; generated if blank |
| K | source_hash | SYSTEM | Last submitted immutable-source fingerprint |
| L | draft_pr | SYSTEM | GitHub Draft PR URL |
| M | published_url | SYSTEM | Verified actual public article URL |
| N | release_sha | SYSTEM | Only **publicly verified** commit SHA |
| O | published_at | SYSTEM | Timestamp after verified production |

User-owned B:J are never silently modified by backend writeback; system writes only system columns. Stable source identity and fingerprint contain spreadsheet ID, sheet GID and source ID, not row position.

### Server-side publication invariants for next PR

1. User logs in with Google; Worker validates ID token and editor allowlist. Browser gets no GitHub secret and does not call GitHub API directly.
2. Worker **re-reads** the exact row from the pinned new spreadsheet via a service account, verifies that source revision did not change and that status is READY. Generate unique source ID server-side; never assume row number uniquely identifies a record.
3. Normalize/validate row using `scripts/publisher/sheets.mjs`. Convert to `src/content/articles/<slug>.md`. Images must be WebP; Drive hotlinks are prohibited.
4. Prevent duplicate open PR for identical `spreadsheetId + sheetGid + sourceId`. Create a **Draft PR**. Do not automatically undraft/merge.
5. FIFO review → exact HEAD CI → merge → Cloudflare → public SHA verification. PR merged is **not** publication verification.
6. Only after verifying public article URL and SHA should backend fill published_url, release_sha and published_at. Retries must be idempotent; never overwrite conflicting nonempty system values.
7. No cron/polling by default; event-driven refresh and manual recovery only.

## Remaining dependencies

- A **new** TechBlogTip Spreadsheet ID, Drive folder ID, and explicit permission assignment.
- New Cloudflare Worker for publisher backend, Google OAuth client, service account, GitHub installation/token with minimum rights, encrypted secrets.
- Integration tests: OAuth denied, edited row, sorted rows, duplicate source, missing media, failed PR/CI/deploy, verified writeback, stale commit SHA.
- Real browser WYSIWYG preview/editor, accessible status, explicit publish action.

## Pure adapter behavior

`prepareSheetArticle(raw, {spreadsheetId, sheetGid, publishedDate})` returns a stable source revision, article path and Markdown. It has no network access and cannot publish anything by itself. Use Node's built-in test suite: `npm test`.

## Acceptance gate

This P5 contract stage can pass when its tests and repository CI pass on exact head SHA. **P5 overall** is not complete until a real authorized Google Sheet can create a Draft PR through the Worker and verified public writeback is demonstrated.
