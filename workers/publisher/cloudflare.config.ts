import { defineConfig, bindings, exports } from 'cf/config';

// Separate admin service. Never automatically deploy it from public blog CI.
export default defineConfig({
  worker: {
    name: 'techblogtip-publisher-dev',
    entrypoint: './src/worker.mjs',
    compatibilityDate: '2026-11-20',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    env: {
      SOURCE_LOCKS: bindings.durableObject({
        worker: 'techblogtip-publisher-dev',
        exportName: 'SourceWriteLock',
      }),
    },
    exports: {
      SourceWriteLock: exports.durableObject({ storage: 'sqlite' }),
    },
    observability: {
      enabled: true,
      headSamplingRate: 0.1,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
