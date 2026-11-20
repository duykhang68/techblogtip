# TechBlogTip delivery roadmap

| Milestone | Scope | Gate |
|---|---|---|
| A (P0–P4) | Astro, responsive editorial UI, content collection, tags/categories/series, static search, RSS, SEO, CI, Cloudflare staging | Build and checks pass on exact PR SHA; manual review; staging URL returns matching release SHA |
| B | Sheets Publisher, Notion editorial adapter, Obsidian selected-note importer, Drive media import | Source identity, replay protection, Draft PR, no private data exposure |
| C | Knowledge graph and editorial dashboard | Accessible, low-JS, event-driven |
| D | Brand, domain, SEO launch, Search Console | Indexability/canonical verified with domain |

Current focus: A only. P0 product/keyword research is an open editorial activity; do not present competitor volume/keyword metrics without a trusted source.

## A acceptance
- [ ] Astro build, strict TypeScript, Node 24 CI green
- [ ] Homepage and article route; category/tag/series filtering
- [ ] Search generated at build, RSS, sitemap, robots, release marker
- [ ] Responsive 360/390/430px, tablet and desktop; keyboard navigation
- [ ] Content + output tests; WebP policy
- [ ] Dependabot and Draft PR review process
- [ ] Cloudflare **staging** deployed, publicly verified for exact SHA
- [ ] Production domain, brand and secrets finalized separately before SEO launch
