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