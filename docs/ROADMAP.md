# TechBlogTip delivery roadmap

| Milestone | Scope | Gate |
|---|---|---|
| A (P0–P4) | Astro, responsive editorial UI, content collection, tags/categories/series, static search, RSS, SEO, CI, Cloudflare staging | Build and checks pass on exact PR SHA; manual review; staging URL returns matching release SHA |
| B · P5a | Sheets Publisher source schema, normalization, fingerprinting, unit tests | Draft PR CI and security PASS; no live writes |
| B · P5b | Authorized Google Sheets API + Worker + Draft PR + verified production writeback | Full end-to-end with pinned new TechBlogTip sheet |
| B · P6–P8 | Notion editorial adapter, Obsidian selected-note importer, Drive media import | Source identity, replay protection, draft PR, no private data exposure |
| C | Knowledge graph and editorial dashboard | Accessible, low-JS, event-driven |
| D | Brand, domain, SEO launch, Search Console | Indexability/canonical verified with domain |

Milestone A **accepted on staging** on 20/11/2026. PR #15 merged at `d907346041cb4d74cdc69541e765805288e23eca`, and [Cloudflare deploy #44770658345](https://github.com/duykhang68/techblogtip/actions/runs/44770658345) verified the public SHA. Browser tests at 360/390/430/768/1440px all passed; [ops issue #5](https://github.com/duykhang68/techblogtip/issues/5) closed.

Current focus: B/P5b authenticated Google Sheets Publisher Worker. P5a contract is merged; production/editor credentials and live integration are not yet configured. P0 product/keyword research remains an open editorial activity; do not present keyword traffic without a trusted source.

## A acceptance
- [x] Astro build, strict TypeScript, Node 24 CI green
- [x] Homepage and article route; category/tag/series filtering
- [x] Search generated at build, RSS, sitemap, robots, release marker
- [x] Responsive 360/390/430px, tablet and desktop visual acceptance
- [x] Content + output tests; WebP policy
- [x] Dependabot and Draft PR review process
- [x] Cloudflare staging deployed, publicly verified for exact SHA
- [ ] Production domain, brand and secrets finalized before SEO launch
