# TechBlogTip engineering rules

- Scope is exclusively `duykhang68/techblogtip`. Never use OneBlog content, secrets, workers, domains or Sheet IDs.
- New changes to source, configuration and workflows go through **Open / Ready for review Pull Requests** (`draft: false`), never Draft by default. Only README.md and AGENTS.md documentation updates may be directly committed if explicitly requested.
- **FIFO merge policy:** merge in PR creation order, one active merge at a time. Require current head-SHA CI/security gates, no conflicts, and verified production SHA before advancing when delivery depends on it. Keep other queued PRs Open; Open does not mean approved to merge.
- **Draft exception:** only convert the specific PR being merged to Draft if an actual merge-time error occurs (failed required CI, conflict, merge protection, or deployment verification failure). Record the failure reason, fix it, then restore Open and resume FIFO. Do not preemptively draft later queued PRs.
- Do not merge a Draft PR, bypass quality checks or claim deployed just because CI passed.
- Deployment only from validated `main` commit via GitHub Actions, serialized; the public `/release.json` SHA must equal the deployed SHA.
- Staging must remain `noindex` and must never be treated as a production SEO launch.
- Static pages must not call GitHub API from the browser. Retired search, RSS, knowledge-map and public branding routes must not be reintroduced without an explicit product decision.
- Editorial images: WebP, descriptive alt, no hotlinked Google Drive URLs or JPG/PNG content assets.
- Do not expose OAuth credentials, GitHub tokens, service account keys or API secrets in the repo.
- Preserve trailing-slash paths and canonical URLs. Redirects are required before changing public URLs after launch.
- Minimize CI/Cloudflare operations. No polling or cron for ordinary delivery; avoid redundant API calls.
- **Retired:** DO NOT re-enable article writing/publishing through Google Sheets/Excel, Visual Editor/Studio, Notion or Obsidian or recreate the dedicated Publisher DEV Worker unless explicitly requested again in a future task. Keep only the explicitly approved PageSpeed, GitHub CLI safety, iOS roadmap and 2026 app-economics research articles (`src/content/articles/techblogtip-100-diem-google-pagespeed-insights.md`, `src/content/articles/xoa-nhieu-repository-github-cli-an-toan.md`, `src/content/articles/lo-trinh-hoc-lap-trinh-ios-tu-con-so-0.md`, `src/content/articles/vibe-code-app-ios-macos-kiem-tien-2026.md`) as published blog content; do not restore the removed older posts. Keep Korea CV Maker intact. Do not restore deleted posts without an explicit new request.
- Do not reintroduce retired Publisher secrets, workflows, dependencies, source import APIs, Media Library or dashboard as an incidental change.
- **G-CMS new explicit product (2026-11-22):** The new `/gcms/` admin app and isolated `apps/gcms/` API are allowed by a new user request and do not restore any retired Visual CMS files, routes, Workers or data. Keep G-CMS public admin route noindex, D1/R2 separated, and release through FIFO with exact SHA.
- **Retired (2026-11-22):** Do not restore the old Visual CMS, its route `/tools/cms/`, footer link, Worker `techblogtip-visual-cms`, or `apps/visual-cms/` in future PRs. The user intends a new CMS architecture later. Keep legacy CMS D1/R2 data untouched unless separately requested for deletion.

## Branding contract (mandatory for all UI/UX changes)

- Read `docs/BRANDING.md` before changing UI, layout, colors, typography, components or interaction patterns.
- Keep the internal Markdown branding contract current when design rules change. Reuse existing design tokens and preserve accessibility, mobile-first layouts and site branding. The public branding route is intentionally retired.

## No decorative hero / banner (mandatory, site-wide)

- **Absolute default: never add or reintroduce a decorative hero on ANY TechBlogTip route**, including homepage, branding, archives, tools, editor, search, categories and article pages. No oversized display headlines, split-screen marketing mastheads, large decorative brand cards, slogan/illustration covers, gratuitous above-the-fold empty space or banner-like promotional blocks.
- Page openings must be compact and content-first: an accessible, naturally wrapping H1, a short description only where needed, then primary navigation, controls or actual content. Reuse existing page headings rather than inserting a new visual intro.
- Illustrations, diagrams and pastel panels remain allowed **inside substantive article/content sections** when they communicate information; do not turn them into a top-of-page hero. Do not remove site-wide navigation or functional controls when removing a hero.
- For each UI PR, review both mobile and desktop first viewport and reject added decorative hero/banner structures. Keep this rule synchronized with `docs/BRANDING.md`.

## Typography & reading layout (mandatory)

- Body prose paragraphs use editorial text-align: justify with natural last-line alignment. Never justify the last line, force word spacing, or insert spaces through JavaScript.
- Never split Vietnamese words: disallow word-break: break-all, overflow-wrap: anywhere and automatic hyphenation on prose. Prefer word-break: normal, overflow-wrap: normal, hyphens: none, word-spacing: normal and letter-spacing: normal. Only code, URLs and genuinely unbroken tokens may have scoped emergency overflow handling.
- Short snippets, navigation, buttons, metadata, headings, code, blockquotes, lists and tables must not be stretched to achieve justification. Use natural alignment on compact/mobile layouts where justification would produce excessive gaps.
- Full article headings use the entire article-header width (up to the 1440px site container), responsive font sizes and `text-wrap: wrap` for natural line packing; do not use balance, justify headings, insert manual line breaks, nowrap or truncate full titles. Article tagline uses that same width with natural desktop justification and a left-aligned final line, reverting to left alignment on mobile.
- Test 320px mobile and wide desktop for horizontal overflow, broken Vietnamese diacritics, excessive word gaps and abrupt one-word title lines; use the retained PageSpeed 100 article as the regression sample.

## Automatic editorial visualization gate

- Every new long-form blog post must receive a meaningful visualization before production. The shared ArticleVisualMap component is generated automatically from H2 headings for all eligible articles, without manual prompts or external APIs.
- When a post describes a pipeline, architecture, comparison or sequence, add a topic-specific original pastel Astro/SVG diagram like PublisherStoryVisual or EngineeringRulesVisual; the generic map is a baseline, not a substitute for meaningful engineering diagrams.
- Keep visuals responsive, semantically labeled, keyboard-accessible and static-first. Use locally rendered inline Lucide-style vector iconography and do not hotlink third-party assets or expose secrets.
- The existing Quality build verification must reject published articles with multiple H2 sections if their automatic visual story map is missing. Reuse existing event-triggered CI rather than introducing polling or periodic workflows.
- Ensure visual callouts, headings, tables and code remain naturally aligned and never justify with artificial word spacing. Follow the mandatory Typography & reading layout rules above; keep all visual callouts naturally aligned.
