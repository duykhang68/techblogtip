# Milestone A · responsive browser acceptance

## Why this exists

A real staging screenshot at 390px and 1440px on 20/11/2026 showed an over-tall introductory hero. On 390px the article list did not start within the first 844px viewport; mobile-first discoverability was insufficient.

This PR replaces the large intro with compact search-first navigation and adds reproducible Chromium-based QA. **Only visual acceptance of the new commit on staging completes Milestone A.**

## Run locally

```sh
npm install
npm run quality
npm run qa:visual
```

`qa:visual` launches locally preinstalled Chrome/Chromium with `playwright-core`; it does not download browsers. It checks viewports 360, 390, 430, 768 and 1440px, including:
- Horizontal scrolling and clipping at page root, main, header, and search field.
- Homepage eight cards, desktop four-column vs tablet/mobile responsive grid.
- First article card appears in initial mobile viewport.
- Article layout and desktop-only TOC.
- Search with accented title, category, series and tag pages.
- Keyboard-accessible skip navigation.
- Static SEO endpoints and artifacts.

CI uploads screenshots as short-lived GitHub Actions artifacts; inspect the screenshots for the typography, tap-target and readability acceptance. Tests and screenshots are evidence only for this exact commit, not prior production deployments.

## Follow-up manual browser acceptance

- [ ] No clipping/truncated UI at 360, 390, 430, 768, 1440.
- [ ] Site typography readable at default zoom.
- [ ] Touch search and navigation usable, logical focus order.
- [ ] Article reading and related content work with scrolling.
- [ ] Staging URL `release.json` matches current `main` SHA after merge.

Do not mark checked until the exact deployed version is verified.
