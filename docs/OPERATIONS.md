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

After the retirement PR merges, the scoped `cleanup-retired-deployments.yml` action will delete GitHub deployment **records** only for three retired environments. It cannot delete the Cloudflare Worker services or the GitHub Environment settings. If the cleanup action fails, rerun it manually, then manage any remaining environments under GitHub repository Settings → Environments. Do not delete the `github-pages` production environment. Environment deletion also removes environment-specific secrets and protection rules; review these before deletion.
