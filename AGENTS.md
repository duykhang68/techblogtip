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
