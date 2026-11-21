# P8 → P6 → P7 import adapters — implementation checkpoint

This branch contains **backend building blocks, not a completed end-to-end import UI**.

- P8 Drive image metadata checking and server-only WebP conversion through a provisioned Cloudflare Images binding. Requires separate Drive read-only credential. Media Library, Picker, batch selection and Draft PR media staging are outstanding.
- P6 Notion read-only page and paginated block extraction with visible unsupported-block markers. Notion database selector, account connection and WYSIWYG import action remain outstanding.
- P7 selected Markdown note parser with scalar frontmatter, wikilinks and missing-media inventory. Obsidian multi-file upload and visual editor import action remain outstanding.

Do not reuse Google Sheets OAuth token as Drive scope. Never expose credentials to browser, hotlink private assets or auto-publish imported content. Import must eventually allocate stable source IDs, deduplicate by content revision and enter Draft PR + exact-SHA checks before release.
