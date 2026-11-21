# TechBlogTip — Branding & UI/UX Guidelines

> Canonical machine-readable design contract · Version 1.0 · 2026-11-21  
> Internal engineering and design reference; no public branding page is generated.  
> **AI agents: read this file before changing ANY UI, UX, layout, typography or visual content.** Existing implementation files remain the source of truth for current CSS values; do not silently replace tokens.

## Brand positioning
- Name: **TechBlogTip**. Vietnamese technology learning, approachable technical guidance, factual engineering narratives.
- Personality: editorial clarity, quiet confidence, helpfulness, precision, light visual playfulness. Avoid glossy SaaS dashboards, gratuitous gradients, neon. Decorative hero/banner sections are prohibited site-wide.
- Voice: Vietnamese, clear and specific, concise interface copy, concrete verbs, never claim an unverified production deployment.
- Source of truth: `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro`, then this guideline. If a deviation is desired, update this internal document in the same PR; do not reintroduce the retired public branding route.

## Color tokens (current site baseline)
| Role | CSS token | Hex | Usage |
|---|---|---|---|
| Text | `--ink` | `#191b20` | Main text, brand mark |
| Muted | `--muted` | `#667078` | Subtitles, descriptions |
| Paper | `--paper` | `#fbfaf8` | Site canvas |
| White | `--white` | `#ffffff` | Cards/surfaces |
| Divider | `--line` | `#e6e5e1` | Thin boundaries |
| Accent | `--accent` | `#ad492c` | Links, emphasis, active items |
| Soft | `--soft` | `#f3f1eb` | Subtle section backing |
| Sunny | fallback-art | `#fce6ad` | Illustration, panels |
| Lavender | fallback-art | `#dfdcfa` | Illustration, panels |
| Mint | fallback-art | `#d5efd9` | Illustration, panels |
| Sky | fallback-art | `#d6e9fb` | Illustration, panels |
| Peach | fallback-art | `#f7d8ca` | Illustration, panels |
| Steel | fallback-art | `#e2e6e8` | Illustration, panels |

**Contrast contract:** pastel fills are backgrounds, never low-contrast text. Use `--ink` for body text; validate readable links, metadata, buttons and focus against their actual backgrounds. Do not use pastel-on-pastel for information-bearing UI.

## Typography
- UI and prose: `'Be Vietnam Pro', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- Body baseline: 15px / 1.65. Article prose: 1rem / 1.88. Titles: fluid sizes with natural wrapping.
- Vietnamese long-form paragraphs: justify naturally where appropriate; on narrow widths use left alignment if word spacing looks stretched. Never use `word-break:break-all`, global `overflow-wrap:anywhere`, automatic hyphenation, artificial spaces or manual `<br>` in titles.
- Headings, links, chips, buttons, compact UI, code, lists, tables and blockquotes: natural left alignment. Article titles use the full shared article-header width (up to 1440px) with `text-wrap: wrap` and natural Vietnamese word boundaries; do not use `text-wrap: balance` on long H1s or justify heading words. Article description/tagline spans the same header width, is justified naturally on desktop with its final line left-aligned, and switches to left alignment at 860px and below. No arbitrary short `max-width`, forced line breaks or stretched words.
- Readability: prioritize text hierarchy and line length; do not rely on font weight alone for state.

## Layout, rhythm and responsive behavior
- Shared site wrapper: `.container { width: min(100% - 32px, 1440px) }`.
- Existing global radius: `--radius:12px`; cards use modest 8–12px corners.
- Editorial rather than app-like. Respect the existing header/footer and content information hierarchy. Every route is content-first: decorative hero sections and oversized introductory banners are prohibited, including homepage, branding, archives, tools, search, categories, editor and article pages. Use compact page titles and functional content immediately.
- Cards: square visual thumbnail `aspect-ratio:1`; use `object-fit:cover`; never stretch images.
- Mobile-first: test 320, 375, 768, 1024 and 1440px; no horizontal overflow, clipped navigation, cramped text, or invisible affordances. Touch targets ~44px where practicable.
- Sections may alternate subtle **distinct** pastel fills to aid scanning, but maintain contrast and generous whitespace. Avoid undifferentiated adjacent panels.
- Breadcrumb: textual links. Desktop article TOC can float/stick; do not squeeze mobile prose with a permanent sidebar.
- Interaction: visible hover, focus-visible and active states; keyboard access; ESC/outside-click to dismiss dialogs or dropdowns when applicable; never create a UI state with no obvious exit.

## Site-wide no-hero rule (non-negotiable)
- Do not add or reintroduce decorative hero banners, split-screen mastheads, giant display headlines, slogan artwork, oversized brand cards, or large empty introductory blocks on any blog route.
- Start pages with a compact semantic H1 and only essential explanatory text followed immediately by navigation, actions or real content. Preserve functional controls when removing decorative headers.
- Keep topic-specific article diagrams and visualizations within the substantive content they explain; these are not decorative page-opening heroes.
- Check the first viewport at 320/375px mobile and desktop during UI review; reject PRs that recreate a hero. This requirement applies to every existing public route.

## Form-based tool UX (Korea CV Maker reference)
- Follow the existing TechBlogTip tokens (`--ink`, `--muted`, `--paper`, `--white`, `--line`, `--accent`, `--soft`). Keep the ink primary CTA, restrained terracotta accent for active/emphasis, and the established Sunny/Lavender/Mint/Sky/Peach backgrounds; do not introduce an unrelated SaaS gradient or new primary hue.
- Render essential controls in the Astro component instead of injecting their markup at runtime: Astro's scoped styles must apply on first paint, avoiding browser-default unstyled buttons.
- For long forms, offer in-page shortcuts by human-readable section name, 44px controls, labels close to inputs and predictable save/return paths. At 320px, section links may scroll horizontally but inputs must not overflow.
- A signed-out state is normal information, not an alarming banner. Show errors only for verified failures (missing public build config, denied OAuth, failed authenticated API read). Never claim Google Drive connected until an authenticated read succeeds; never say saved until the write is acknowledged.
- User-facing previews must use labeled, human-readable fields rather than raw JSON; avoid emitting applicant data to logs or public artifacts.

## Components and imagery
- Reuse `SiteHeader`, `SiteFooter`, `BaseLayout`, `ArticleCard`, `SmartToc` and available visual components before making new variants.
- Icons: Lucide-style, consistent stroke (~1.8–2px), usually 18–24px; use accessible labels for icon-only actions. Prefer self-hosted/inline SVG over runtime icon libraries.
- Images: original, contextual diagrams and WebP editorial media; meaningful `alt`, stable aspect ratios, no hotlinked Google Drive imagery.
- Long-form articles: an automatically generated visual map plus a topic-specific explanatory visual for architecture, comparisons or timelines. Visualization must explain content, not decorate it.
- Branding page is a **reference**, not permission to alter unrelated pages.

## Page implementation contract for agents
1. Read `AGENTS.md`, this Markdown contract, and actual CSS/layout components before coding.
2. Reuse current tokens first; new tokens require documented names, light-background accessibility and a reason.
3. Produce a user-visible responsive page with semantic landmarks, breadcrumbs where appropriate, accessible buttons/links, and no new runtime external dependencies without justification.
4. Keep the public blog static-first and Zero GitHub API on the client. Respect Astro `withBase()`, trailing slashes and correct canonical URLs.
5. Security: never place API keys, session cookies, OAuth tokens, GitHub PATs, private keys, Google service accounts, backups or user-uploaded private artifacts into source or `public/`. Public Google OAuth **client ID** is not a client secret; client secrets remain server-only.
6. After implementation: run `npm run quality`, check mobile/desktop visual QA, inspect the generated route, and require exact-head-SHA green CI before merging.
7. Ship source changes through an **Open / Ready for review PR** (`draft: false`) and FIFO merge queue. Never claim production availability until the public `release.json` is verified.

## Do / Don't
| Do | Don't |
|---|---|
| Muted paper canvas + restrained accent + pastel section differentiation | Saturated competing backgrounds or unreadable pastel labels |
| Content-first responsive editorial layouts | Decorative hero/banner on any route |
| Natural Vietnamese line breaking | Justify every label or split Vietnamese words |
| Functional navigation, escape hatches and focus states | Dead-end interactions or hover-only controls |
| Original explanatory SVG/diagrams | Huge images without alt text or layout dimensions |
| Open/Ready PR, FIFO, CI and verified release | Direct source commits, optimistic release claims |
| Keep secrets in Cloudflare/GitHub secret stores | Commit .env, private exports, tokens or credentials |

## Security / ignore patterns
`.gitignore` prevents **new untracked files** from being accidentally staged; it does not untrack existing committed content and cannot erase leaked Git history. Audit tracked files and rotate/revoke any credential known to have been exposed. Treat `.env.example` as a deliberately non-secret template: placeholders only.

## Single source of truth workflow
Any material visual change must update this file and be tested against the existing styles. AI agents use this Markdown reference to enforce the design contract; do not restore the public branding page or its footer link.

## G-CMS admin interface (2026-11-22)

- G-CMS is a separate Ghost-inspired administrative application under `/techblogtip/gcms/`, **not** a new homepage hero or a Ghost-branded clone.
- Reuse TechBlogTip's current light tokens, typography, clear content-first navigation, compact controls and responsive layout. Use real Cloudflare data only; no misleading demo metrics, data or buttons.
- Static GitHub Pages HTML contains no secrets, member lists, private drafts or media binaries. All private data lives in isolated Cloudflare D1/R2; Google sign-in permissions are verified by the Worker, not the browser.
- The retired Visual CMS under `/techblogtip/tools/cms/` must stay removed; G-CMS is a separate product.
