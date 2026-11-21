import { defineConfig } from 'cf/config';

// Explicit modes keep the existing staging deploy unchanged. Production is a
// separate Worker name and requires the protected, manual release workflow.
export default defineConfig(({ mode }) => ({
  worker: {
    name: mode === 'techblogtip-production' ? 'techblogtip-production' : 'techblogtip-staging',
    compatibilityDate: '2026-11-20',
    workersDev: true,
    assets: {
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
}));
