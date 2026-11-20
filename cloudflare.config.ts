import { defineConfig } from 'cf/config';

// Staging only. A separate production hostname is a post-brand-decision task.
export default defineConfig({
  worker: {
    name: 'techblogtip-staging',
    compatibilityDate: '2026-11-20',
    workersDev: true,
    assets: {
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
});
