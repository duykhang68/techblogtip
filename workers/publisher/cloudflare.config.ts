import { defineConfig } from 'cf/config';

// Separate admin service. No deployment automatically from the public blog CI.
export default defineConfig({
  worker: {
    name: 'techblogtip-publisher-dev',
    entrypoint: './src/index.mjs',
    compatibilityDate: '2026-11-20',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    observability: {
      enabled: true,
      headSamplingRate: 0.1,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
