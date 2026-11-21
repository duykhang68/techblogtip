# Visual CMS — open-source foundation

Storyblok-inspired independent visual/headless CMS for TechBlogTip. This is NOT Storyblok and not complete enterprise feature parity.
All source is isolated under apps/visual-cms; no existing blog routes, Korea CV Maker, retired Publisher code, CI or deployment workflows are changed.

## Included
- Responsive visual editing (select a block in preview), mobile/desktop preview and six content blocks.
- Add, reorder, duplicate and remove blocks; undo/redo; autosave; D1 persisted drafts with optimistic revision conflicts.
- D1 history and restore, per-page locale and SEO metadata, page management, publish and unpublish snapshots.
- R2 raster media upload and browsing; safe plain-text rendering; image MIME and magic bytes checked; image size max 8MB.
- Comments; Cloudflare Access signed-JWT validation (issuer, audience, expiry, signature) and allowlisted admin/editor/reviewer.
- Public read-only headless JSON API, separate from authenticated editor routes.

## Data flow
CMS editor (Cloudflare Access) -> new isolated Cloudflare Worker -> D1 (pages, revisions, comments) + R2 (images).
GET /api/published/:locale/:slug delivers published JSON. The existing Astro blog remains static and is NOT automatically updated by CMS publication.

## Setup (no deployment has been performed)
Create a NEW Cloudflare Worker with entrypoint apps/visual-cms/src/index.mjs using the existing Cloudflare CLI (cf).
Bind an isolated D1 database named CMS_DB and R2 bucket named CMS_MEDIA. Apply migrations/0001_init.sql.
Create Cloudflare Access application/policies for the editor and private API paths; the Worker independently verifies JWT.
Set Worker variables ACCESS_TEAM_DOMAIN=https://yourteam.cloudflareaccess.com, ACCESS_AUD=your-access-audience, CMS_ADMINS=comma-separated-admin-emails.
Optional variables CMS_EDITORS and CMS_REVIEWERS grant write and read-only access respectively.
Configure Access paths carefully: if the full domain is behind Access, the public read-only JSON endpoint will also require login.
Deploy only to DEV first. Confirm /health, login, write/restore/publish, R2 upload, public API and browser behavior.
Never place access secrets or passwords in repository, front-end assets, or response bodies.

## Routes
GET /health
GET /admin (editor), /api/me, /api/schema
GET+POST /api/pages; GET+PUT+DELETE /api/pages/:id
POST /api/pages/:id/publish, /unpublish, /restore
GET /api/pages/:id/revisions
GET+POST /api/pages/:id/comments
GET+POST /api/assets, GET /media/:id
GET /api/published/:locale/:slug (public read-only)

## Missing vs. Storyblok enterprise
Not implemented: real-time collaborative cursors, nested reusable component schemas, full drag-and-drop layout canvas, workflow approvals, scheduled publishing, translations, rich-text custom nodes, asset transformations, visual diff, advanced search, webhooks, external integrations, enterprise audit trail, multi-tenancy, SSO role mapping, AI features and SLA.
Published media and published JSON are public; never place private data in them.
Cost-free licensing does NOT imply zero Cloudflare infrastructure bills. Free-tier quotas apply; R2 activation may require billing details.
Do not claim full feature parity, verified hosting or production release until the work is complete and the production SHA is verified.

## 2026-11-22: Google Sign-In + visual workspace (no Zero Trust)

The CMS was explicitly requested again as a **new, isolated tool**. Do not recreate the retired Google Sheets Publisher.

- UI (GitHub Pages, where the existing Google OAuth Client ID is authorized): https://duykhang68.github.io/techblogtip/tools/cms/
- Worker API: https://techblogtip-visual-cms.tamsudev-com.workers.dev
- Legacy /admin on Worker redirects to GitHub Pages so users sign in on the correct OAuth origin.
- Authentication: the public Google Identity Services library returns a short-lived ID token to the UI. The UI sends it via HTTPS Authorization Bearer, and the Worker checks RS256 signature via Google's JWKS, issuer, audience, expiry, verified email and exact email role allowlist. Session token is stored in tab sessionStorage, not in a URL or source code. No Cloudflare Access service required.
- Privileged API CORS is restricted to the established GitHub Pages origin; no allow-all CORS for editing. Invalid or missing tokens fail closed.
- Live published content is rendered as a human-readable page under /p/:locale/:slug. Drafts do NOT have public URLs and must be previewed only inside the authenticated editor.
- Storyblok-inspired layout: component palette, Layers tree, responsive preview canvas, contextual block action toolbar, inline selection, assets, revisions, comments, SEO inspector, explicit draft/publish status, keyboard shortcuts.

## Storyblok feature matrix (reference: storyblok.com/features)

Implemented foundation: visual preview; flat block components; REST public read; version history; comments; basic SEO metadata; manual publishing; R2 asset library; language field; role allowlists.

Partial: component reuse (only built-in block templates), collaboration (page comments, not real-time or inline), localization (locale field, not translation workflow), content delivery (REST JSON plus HTML preview, no GraphQL), workflow (draft/published only), roles (three allowlist roles, no custom roles UI).

Not implemented: nested schema builder and global reusable components; field-level localization; content staging pipelines; approvals and multiple workflow stages; scheduled releases and planner calendar; image crop/transform; A/B testing and personalization; GraphQL and SDKs; webhooks and custom extensions; Activity Dashboard; SSO/SCIM; AI Suite, MCP and FlowMotion; formal enterprise security certifications.

This project does not claim feature parity, or that Cloudflare services never incur cost. GitHub Pages and Cloudflare Free quotas are subject to platform limits.

## Operational release rules

1. Merge only via Ready PR, exact SHA CI/security gates and FIFO.
2. Verify Github Pages contains /techblogtip/tools/cms/ after deploy and that the existing blog is unchanged.
3. Upload the Worker from the merged source, using new GOOGLE_CLIENT_ID (existing public OAuth client), CMS_ADMINS, CMS_DB, CMS_MEDIA and optionally SOURCE_SHA. Do not reuse any other worker's bindings.
4. Verify /health, /api/config, absent/invalid token 401, CORS, D1 and R2 bindings. Do not remove old Cloudflare Access policy until the Worker bearer validation is running.
5. Remove only the four Access applications created for this CMS after the secured Google version is deployed.
6. Perform a real interactive Google login and create/draft/save/publish end-to-end with a permitted account. A CI pass alone is not interactive acceptance.
