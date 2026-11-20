# Security baseline

- No third-party admin API, token or OAuth in the public UI.
- GitHub actions use read-only permissions by default; deploy secret is only available to protected deployment context.
- Staging has noindex and disallow robots; neither is access control. Use Cloudflare Access for private content.
- Never reuse OneBlog credentials, media folder IDs, OAuth clients, Workers or tokens.
- Secrets must be in GitHub Actions secrets, never in source, README or browser state.
- Limit external font and tracking dependencies before public launch.
- Dependabot raises dependency PRs with throttling; review security PRs separately and do not auto-merge without CI.
- When real ingestion is built, validate webhook signatures and source revisions on the server and create Draft PR only.
