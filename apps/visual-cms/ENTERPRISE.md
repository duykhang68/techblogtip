# Enterprise CMS expansion, 2026-11-22

Reference: https://www.storyblok.com/features, reviewed November 2026.

## Implemented core
- Global reusable components: a component group composed of validated leaf blocks. Inserted into pages by reference and resolved on delivery.
- Spaces: workspace selector, role-checked space-scoped private APIs, additive D1 migration preserving legacy pages and media.
- Workflow: configurable ordered review states, approval required before publishing when activated, edits reset approvals to draft.
- Releases: scheduled publish/unpublish actions with expected revision checks, atomic job claim, error reporting and cancellation. The cron trigger must also be configured.
- GraphQL-style published content API: bounded read-only queries on /graphql; fixed schema exposed under /graphql/schema.
- AI: deterministic no-cost SEO analysis; optional disabled-by-default Workers AI text suggestions with explicit approval and daily requests quota.
- Activity dashboard: D1 audit log of content and permission changes.

## Deployment
Run apps/visual-cms/migrations/0002_enterprise.sql on the isolated CMS D1 database exactly once. Preserve a backup of existing content.
Merge only after current SHA Quality, Gitleaks and FIFO. Verify GitHub Pages deployment SHA.
Then deploy the Worker from merged source with the existing D1/R2/Google OAuth bindings and SOURCE_SHA.
Enable a five-minute Cloudflare Worker cron to execute queued schedules. Verify with a real scheduled test.
Do not enable the AI binding or CMS_AI_ENABLED without confirming free allocation and a nonbillable model for this account.

## Routes
Private: /api/spaces, /api/members, /api/components, /api/workflows, /api/workflows/pages/:id, /api/schedules, /api/activity, /api/ai/status, /api/ai/analyze, optional /api/ai/generate.
Public: /graphql and /graphql/schema plus /api/published/:locale/:slug?space=id.
All private APIs require cryptographically verified Google ID tokens and workspace permissions.

## Explicit limits — not Storyblok enterprise parity
- Slugs remain globally unique across workspaces due to legacy index; same slug/locale cannot be reused in different spaces yet.
- R2 media are public/shared; do not upload private assets. Not full tenant isolation.
- Global blocks do not support nested component schemas, conditional field types or component-level approval.
- Workflow builder is ordered stages, not visual DAG orchestration or FlowMotion.
- GraphQL supports page/pages field projections only; no variables, fragments, mutations, directives, subscriptions or introspection.
- Scheduler runs at five-minute resolution when cron exists; jobs are revision-pinned, failed jobs are retained for review.
- AI text generation stays disabled unless explicitly configured. No autonomous AI agents, MCP server, comprehensive translations or image generation.
- No SSO/SCIM, ISO/SOC certification claims, A/B testing, real-time collaboration, image transforms, or enterprise SLA.
- Publishing is independent of the Astro static blog and does not update blog posts automatically.