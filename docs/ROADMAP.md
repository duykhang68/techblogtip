# TechBlogTip roadmap — writer postponed

**Decision (22 November 2026):** Decommission current Google Sheets/Excel → Visual Editor → Notion/Obsidian → GitHub publishing stack. It will be redesigned only in a later explicit project phase.

## Removed

- Google Sheets / Excel article publishing and dedicated Editorial Publisher spreadsheet.
- Visual Editor / Studio 2.0, dedicated Publisher DEV Worker, article metadata and import APIs.
- Notion P6, Obsidian P7, P8 Drive test media, manual deploy/canary workflows and Sheets M:O production reconciliation.

The dedicated Editorial Publisher spreadsheet was permanently deleted. The five P8 test images were moved to Trash and the now-empty P8 folder was deleted; the image IDs are no longer accessible through Drive. The separate CV sample folder was deliberately preserved.

## Preserved

- All existing published blog articles and historical case-study diagrams.
- Astro SSG, homepage, Archive, interactive Knowledge Map, taxonomies, search, RSS, sitemap, SEO, branding and performance checks.
- GitHub Actions CI/security, event-driven FIFO, Cloudflare staging, GitHub Pages production and exact SHA checks.
- Korea CV Maker with its own Google login/Drive gateway and worker (not related to article publishing).

## Future

A new authoring experience may be designed from scratch *when explicitly requested*. Do not automatically restore retired source code, live writer credentials or data stores.
