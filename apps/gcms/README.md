# G-CMS · TechBlogTip

Independent content-management application inspired by Ghost's documented capabilities and **Ghost(Pro) Custom**, the highest plan: <https://docs.ghost.org/> and <https://ghost.org/pricing/> (2026-11-22).

G-CMS is **not Ghost**, does not copy Ghost's brand, does not install Ghost or claim its hosted SLA. Ghost custom-tier contractual benefits (dedicated IP, 99.9% uptime SLA, support/deliverability consultation) are *operational services*, not features a free self-hosted implementation automatically inherits.

## Architecture: keep GitHub small

| Component | Responsibility | GitHub footprint |
|---|---|---|
| Astro + GitHub Pages | Existing public TechBlogTip unchanged; static admin shell under \`/techblogtip/gcms/\` | Only UI source, build artifacts not committed |
| Cloudflare Worker \`techblogtip-gcms\` | JSON Content/Admin API, Google identity checks, scheduled-publish handler | A small JS source module |
| Cloudflare D1 \`techblogtip-gcms-db\` | Posts, pages, drafts, revisions, members, newsletters, tiers, audit | Schema migration only |
| Cloudflare R2 \`techblogtip-gcms-media\` | Images/media (public only after upload) | No binaries in repo |
| Google Sign-In (existing GitHub Pages OAuth origin) | Staff sign in, Worker validates signed Google ID token, email allowlist | No client secrets in GitHub |
| Google Drive/Sheets (optional later) | Explicit opt-in exports/backups or operational spreadsheets; never primary CMS datastore | No private documents synced into repo |
| GitHub Actions FIFO | Deploy Astro blog through reviewed PR, CI, exact release SHA verification | Existing workflows reused |

**Do not reintroduce the retired Google Sheets Publisher, Visual Editor 2.0, Notion, Obsidian or old Publisher DEV Worker.** G-CMS is independent of the retired Visual CMS. Do not migrate its D1 or R2 or alter its OAuth state as a side effect.

## Capability matrix — reference target: Ghost Custom

A heading is a reference requirement, not a claim of parity.

| Ghost Custom capability | G-CMS current code | Status / what remains |
|---|---|---|
| Posts, pages, drafts, tags, excerpts | D1 CRUD, block editor, list/search/filter | Functional once deployed/configured; richer WYSIWYG pending |
| Publishing, scheduling | Admin publish/unpublish, scheduled jobs | Requires deployed Worker and enabled Cron. No Astro publishing bridge yet |
| Revision history | Immutable versions, restore, conflict detection | Implemented in API |
| SEO | SEO title/description/canonical fields, existing Astro SEO | CMS content routes not yet integrated into Astro sitemap |
| Media library | R2 upload/list and link in editor | Public images, 8 MB; image processing pending |
| Staff roles | Google JWT verification, admin/editor/reviewer allowlists | Custom staff roles, invites, SSO pending |
| Members | Member list and labels | Public signup, confirmed email, member login, CSV import/export pending |
| Membership tiers | Tier catalog schema and UI | No Stripe, checkout, billing entitlements yet |
| Newsletters | Newsletter catalog schema and UI | No sends, subscriptions, templates, deliverability or campaign analytics |
| Native analytics | Real CMS record counts | Pageview, signup, source attribution, newsletter opens/clicks pending |
| Public Content API | Read-only published posts/pages, teaser-only for gated content | API key/SDK, filtering, pagination, per-slug endpoint pending |
| Admin API, audit | Authenticated CMS API, operation audit | Webhook dispatcher, integrations, management dashboard pending |
| Themes/i18n | Existing Astro theme + Vietnamese UI | Theme marketplace, field localization pending |
| Social distribution, recommendations, referral programs | Not connected | ActivityPub, network, referral provider pending |
| Enterprise Custom | Architecture can be scaled | No dedicated IP, contracted SLA, advanced support, unlimited service quotas |

**G-CMS does not send email, charge cards, create live members' sessions, or publish Astro articles yet.** Do not report it as parity/completed and do not populate fake operational data.

## Deployment / operations (do in this order)

1. Merge this **Open/Ready PR through FIFO only** when required Quality/Security/FIFO admission gates pass for its *exact head SHA*. Verify the published GitHub Pages \`/techblogtip/gcms/\` route and \`/release.json\` exact production SHA before claiming launched.
2. Create separate Cloudflare D1 database \`techblogtip-gcms-db\` and R2 bucket \`techblogtip-gcms-media\`; do not reuse Visual CMS resources.
3. Apply \`apps/gcms/migrations/0001_init.sql\` in D1. Configure the new Worker with main module \`apps/gcms/src/index.mjs\`, including \`apps/gcms/src/auth.mjs\`, D1 binding \`GCMS_DB\`, R2 binding \`GCMS_MEDIA\`, and text/secret variables \`GCMS_GOOGLE_CLIENT_ID\`, \`GCMS_ADMINS\`, optional \`GCMS_EDITORS\`, \`GCMS_REVIEWERS\`, and \`SOURCE_SHA\`. Use Cloudflare secrets, never source-code keys. Public OAuth client ID must be authorized for \`https://duykhang68.github.io\`.
4. Keep Worker domain \`techblogtip-gcms.tamsudev-com.workers.dev\` (configure only after verifying ownership/route). No Cloudflare Access product or paid Zero Trust plan needed. Worker verifies Google JWT issuer/audience/RS256/email verification/expiry on every privileged request. Only configured email allowlist can access private data.
5. Verify \`/health\` exact source SHA, \`/api/config\`, 401 with absent/invalid token, 403 for unauthorized Google identity, CORS controls, D1 persistence, draft-save/reload, revisions, publish/unpublish, R2 upload, and Content API public-vs-gated block redaction. Acceptance requires real Google login; CI test alone is insufficient.
6. Enable a Worker **Cron Trigger** at an explicitly chosen interval only when scheduling is exercised. It publishes due entries inside D1. Do not reuse GitHub CI cron or create background polling tasks for FIFO. Confirm UTC timestamp scheduling.
7. To make G-CMS posts appear on the existing Astro blog, build a *separate*, gated publish bridge: retrieve published entries from Content API at build time, sanitize/render, create reviewed PR, pass CI, merge FIFO, deploy exact SHA. Never commit D1 exports, images, credentials, member lists or arbitrary bulk content to GitHub. A more scalable option is Cloudflare Worker-rendered published pages with Astro links, but would require route and SEO design review.

### Limits and security notes

- GitHub Pages static content can be viewed by anyone; the HTML app must never embed secrets or private drafts.
- Current public Content API returns only metadata/teaser for \`members\`/\`paid\` visibility. Reader access is deliberately disabled until an entitlement system is implemented.
- \`R2\` media URLs are public; do not upload private member attachments there.
- Cloudflare Free-tier usage and possible R2 billing/activation requirements vary; Ghost Custom is not included.
- Identity tokens are kept in \`sessionStorage\` (tab-scoped), never localStorage or URL.
- Never claim Ghost Customer parity or 99.9% uptime without production measurements and a contract.
