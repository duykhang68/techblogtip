# TechBlogTip delivery roadmap

| Milestone | Scope | Gate |
|---|---|---|
| A (P0–P4) | Astro, responsive editorial UI, content collection, tags/categories/series, static search, RSS, SEO, CI, Cloudflare staging | Build and checks pass on exact PR SHA; manual review; staging URL returns matching release SHA |
| B · P5a | Sheets Publisher source schema, normalization, fingerprinting, unit tests | Draft PR CI and security PASS; no live writes |
| B · P5b | Authorized Google Sheets API + Worker + Draft PR + verified production writeback | Full end-to-end with pinned new TechBlogTip sheet |
| B · P5c | Visual editorial workflow: on-demand PR/CI feedback, WYSIWYG, Drive→WebP, conflict protection, and verified production release writeback | Review each P5c sub-phase on exact SHA; never claim published based on PR merge alone |
| B · P6–P8 | Notion editorial adapter, Obsidian selected-note importer, Drive media import | Source identity, replay protection, draft PR, no private data exposure |
| C | Knowledge graph and editorial dashboard | Accessible, low-JS, event-driven |
| D | Brand, domain, SEO launch, Search Console | Indexability/canonical verified with domain |

Milestone A **accepted on staging** on 20/11/2026. PR #15 merged at `d907346041cb4d74cdc69541e765805288e23eca`, and [Cloudflare deploy #44770658345](https://github.com/duykhang68/techblogtip/actions/runs/44770658345) verified the public SHA. Browser tests at 360/390/430/768/1440px all passed; [ops issue #5](https://github.com/duykhang68/techblogtip/issues/5) closed.

Current focus: B/P5b live READY→Draft PR→Sheet K:L acceptance (Issue #19) and B/P5c Editorial Studio. P5a is merged; OAuth, dedicated service account, and Publisher DEV are configured. The real Google Sheets/GitHub **read-only** integration passed, but the actual Github PR write path has not been verified. P0 product/keyword research remains an open editorial activity; do not present keyword traffic without a trusted source.

## A acceptance
- [x] Astro build, strict TypeScript, Node 24 CI green
- [x] Homepage and article route; category/tag/series filtering
- [x] Search generated at build, RSS, sitemap, robots, release marker
- [x] Responsive 360/390/430px, tablet and desktop visual acceptance
- [x] Content + output tests; WebP policy
- [x] Dependabot and Draft PR review process
- [x] Cloudflare staging deployed, publicly verified for exact SHA
- [ ] Production domain, brand and secrets finalized before SEO launch

## Verified 21/11/2026 checkpoint

- Milestone A verified on Cloudflare staging. PR #23 / main `a3c44a015d980d56d5a2c2210b3243c78d948793` passed Quality, Workflow Security Audit and staging exact-SHA deployment.
- Milestone B P5a is complete. P5b Worker DEV deployed at `2446cb94e38175ef61de55c5fbc8575eb44d88ce` (PR #20–#22), including seven-day session, readonly preflight and duplicate-click prevention.
- [Live integration check #44830236907](https://github.com/duykhang68/techblogtip/actions/runs/44830236907) passed against the dedicated Sheet VN, Github read-only main and Publisher DEV. It does **not** test Github PR write permissions.
- **Pending P5b:** authorized editor submits a real READY article → exactly one Draft PR → verify Sheet K:L. Keep [Issue #19](https://github.com/duykhang68/techblogtip/issues/19) open until verified.
- **P5c.1:** on-demand PR/CI tracker using authenticated Worker; CI checks always pinned to PR head SHA, optional GitHub Checks:Read; failed/unavailable check data is never treated as PASS. Manual separate Publisher DEV deployment required after merge.
- **P5c.2 (phased):** First visual editor for IDEA/DRAFT/REVIEW (simple headings, lists, emphasis, metadata; Sheets B:H + J only) is being implemented, with 409 conflict detection and locked READY/PR rows. Advanced Markdown and Drive→WebP, multi-editor transactional locking and recovery are still not implemented.
- **P5c.3:** verified production release writeback M:O requires a production domain, deployed public URL and exact release SHA; not implemented.
- **P6–P8/C/D:** Notion, Obsidian, Drive adapter, knowledge graph and public SEO launch remain planned.

## P5c.2 — Visual editor (first slice)

- Only authorized editors with active Google sessions may open and save a draft by stable source ID. The server re-reads the source and compares SHA-256 snapshot of all A:O fields before saving.
- The visual editor supports basic headings, lists, bold/italic, paragraphs and metadata. Advanced Markdown (code blocks, tables, images, links) is display-only and must be edited in Google Sheets until lossless conversion is available.
- Atomic Google Sheets values:batchUpdate modifies only B:H and J. Column I status and A/K:O system fields are never written by this editor. READY, PR-submitted or published rows are locked.
- Note the Google Sheets API does not provide a transaction-level compare-and-swap. Keep single-editor use until per-source locking is implemented; a concurrent edit between compare and write remains a known limitation.
- No auto-publish, auto-merge, browser GitHub API, cron, or secret exposure.

- **P5c.2 write coordination:** a Durable Object lease is required for Writer APIs (allocate source ID, save draft, create Draft PR). The Worker fails closed without the binding; this feature needs a separate manual Publisher DEV deployment and exact SHA verification. Google Sheets direct editing outside the Worker is not serialized.


## P5b live E2E checkpoint — 21/11/2026

An authorized editor approved a dedicated test row (VN row 3, source ID
\`TBT-ed3fa834-d43c-4852-ad7b-1128cd4486c0\`). Publisher DEV generated
[Draft PR #35](https://github.com/duykhang68/techblogtip/pull/35),
recorded the independently matching SHA-256 source fingerprint in K and the PR
URL in L. Release columns M:O stayed blank. The Quality workflow
[#44837806420](https://github.com/duykhang68/techblogtip/actions/runs/44837806420)
passed on exact PR head \`b3f9712ac482d7df88bbe408f96e951178bbfe32\`.
PR #35 was then **closed unmerged** to prevent a test article with
\`draft: false\` from entering main. Core READY → Draft PR → K:L is verified;
live replay of an identical POST and failure injection have not been tested.
The optional read-only audit can now recheck the cross-system result by source ID.
