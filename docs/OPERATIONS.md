# TechBlogTip — Static site operations

- **Production:** GitHub Pages `https://duykhang68.github.io/techblogtip/`.
- **Staging:** Cloudflare `techblogtip-staging`, always `noindex,nofollow`.
- **Quality:** exact-SHA testing, Astro build, visual QA, Gitleaks, workflow security and FIFO merge.
- **SEO:** sitemap, RSS, Search Console and canonical verification stay active.
- **Korea CV Maker:** independent `workers/korea-cv` is preserved.
- **Removed:** Google Sheets/Excel article publisher, Visual Editor, Notion/Obsidian import, Publisher DEV Worker, Sheets M:O writeback.

```bash
npm install
npm run quality
npm run dev
```

No old Publisher credentials or Drive editorial spreadsheet are needed for static site deployment. Historical public articles are unchanged.
