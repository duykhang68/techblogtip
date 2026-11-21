# TechBlogTip engineering rules

- Scope is exclusively `duykhang68/techblogtip`. Never use OneBlog content, secrets, workers, domains or Sheet IDs.
- New changes to source, configuration and workflows go through **Draft Pull Requests**. Only README.md and AGENTS.md documentation updates may be directly committed if explicitly requested.
- Do not merge a Draft PR, bypass quality checks or claim deployed just because CI passed.
- Deployment only from validated `main` commit via GitHub Actions, serialized; the public `/release.json` SHA must equal the deployed SHA.
- Staging must remain `noindex` and must never be treated as a production SEO launch.
- Static pages must not call GitHub API from the browser; search is generated at build.
- Editorial images: WebP, descriptive alt, no hotlinked Google Drive URLs or JPG/PNG content assets.
- Do not expose OAuth credentials, GitHub tokens, service account keys or API secrets in the repo.
- Preserve trailing-slash paths and canonical URLs. Redirects are required before changing public URLs after launch.
- Minimize CI/Cloudflare operations. No polling or cron for ordinary delivery; avoid redundant API calls.
- Notion/Obsidian/Sheets integrations belong to later milestones and must never directly mutate live content.

## Branding contract (mandatory for all UI/UX changes)

- Read `docs/BRANDING.md` and the public `/branding/` guidelines before changing UI, layout, colors, typography, components or interaction patterns.
- Keep the Markdown and Astro branding page synchronized when design rules change. Reuse existing design tokens and preserve accessibility, mobile-first layouts and site branding.

## Typography & reading layout (mandatory)

- Body prose paragraphs use editorial text-align: justify with natural last-line alignment. Never justify the last line, force word spacing, or insert spaces through JavaScript.
- Never split Vietnamese words: disallow word-break: break-all, overflow-wrap: anywhere and automatic hyphenation on prose. Prefer word-break: normal, overflow-wrap: normal, hyphens: none, word-spacing: normal and letter-spacing: normal. Only code, URLs and genuinely unbroken tokens may have scoped emergency overflow handling.
- Short snippets, navigation, buttons, metadata, headings, code, blockquotes, lists and tables must not be stretched to achieve justification. Use natural alignment on compact/mobile layouts where justification would produce excessive gaps.
- Full article headings use available content width, responsive font sizes and text-wrap: balance. Do not insert manual line breaks, nowrap or truncation for full article titles.
- Test 320px mobile and wide desktop for horizontal overflow, broken Vietnamese diacritics, excessive word gaps and abrupt one-word title lines; use the Google Sheets Publisher story as the regression sample.

## Automatic editorial visualization gate

- Every new long-form blog post must receive a meaningful visualization before production. The shared ArticleVisualMap component is generated automatically from H2 headings for all eligible articles, without manual prompts or external APIs.
- When a post describes a pipeline, architecture, comparison or sequence, add a topic-specific original pastel Astro/SVG diagram like PublisherStoryVisual or EngineeringRulesVisual; the generic map is a baseline, not a substitute for meaningful engineering diagrams.
- Keep visuals responsive, semantically labeled, keyboard-accessible and static-first. Use locally rendered inline Lucide-style vector iconography and do not hotlink third-party assets or expose secrets.
- The existing Quality build verification must reject published articles with multiple H2 sections if their automatic visual story map is missing. Reuse existing event-triggered CI rather than introducing polling or periodic workflows.
- Ensure visual callouts, headings, tables and code remain naturally aligned and never justify with artificial word spacing. Follow the mandatory Typography & reading layout rules above; keep all visual callouts naturally aligned.
