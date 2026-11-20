# Content contract · Milestone A

Directory: `src/content/articles/<slug>.md`. `slug` is a lowercase ASCII filename and is stable once published.

Required frontmatter: `title`, `description` (25–200 chars), `published` (ISO date), `category`. Optional: `updated`, `tags`, `series`, `author`, `cover`, `coverAlt`, `draft`.

- `draft: true` excludes a post from public routes, RSS, sitemap and search index.
- Cover must be WebP with descriptive alt text; no JPG/PNG editorial assets.
- Keep title and description original; no invented citations or screenshots.
- Dates are content metadata, not deploy timestamps.
- Article URL format: `/bai-viet/<slug>/`, canonical based on `SITE_URL`.
- Notion/Obsidian/Sheets source metadata will be added in Milestone B with stable `content_id`, provenance and idempotency.

This repository ships a small demo set. Replace or review all demo material before enabling indexing.
