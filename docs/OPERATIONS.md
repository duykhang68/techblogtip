# TechBlogTip — Static site operations

- **Production:** GitHub Pages `https://duykhang68.github.io/techblogtip/`.
- **Retired deployment automation:** Cloudflare `techblogtip-staging` (formerly auto-deployed on `main`) and `techblogtip-korea-cv-dev` (formerly manual-only). Their GitHub Actions deployment workflows were removed on 2026-11-22 by request.
- **Quality:** exact-SHA testing, Astro build, visual QA, Gitleaks, workflow security and FIFO merge remain active.
- **SEO:** sitemap, RSS, Search Console and canonical verification stay active.
- **Korea CV Maker:** application source remains in this repository; retiring the DEV deployment workflow does **not** delete the app or an already-deployed Cloudflare Worker. The production build may still point to the DEV Worker through `PUBLIC_KOREA_CV_API_URL`; inspect that dependency before deleting the Worker.
- **Removed previously:** Google Sheets/Excel article publisher, Visual Editor, Notion/Obsidian import, Publisher DEV Worker, Sheets M:O writeback.

```bash
npm install
npm run quality
npm run dev
```

No old Publisher credentials or Drive editorial spreadsheet are needed for static site deployment. Historical public articles are unchanged.

On 2026-11-22, [cleanup run 44931238961](https://github.com/duykhang68/techblogtip/actions/runs/44931238961) deleted **135 GitHub deployment records**: Publisher DEV 36, Korea CV DEV 1, staging 98. The Cloudflare `techblogtip-staging` Worker was then removed and verified absent. The Publisher DEV Worker was already absent. The Korea CV DEV Worker remains deployed because the production site's Korea CV code can still depend on its API URL.

`cleanup-retired-deployments.yml` is now **manual-only** for recovery; it does not consume Actions runs on every push. GitHub Environment settings are a separate resource: review and optionally remove obsolete environments under Settings → Environments. Never delete `github-pages`. Deleting an environment also deletes its environment-scoped secrets and protection rules.
