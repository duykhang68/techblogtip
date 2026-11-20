import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'https://techblogtip-staging.tamsudev-com.workers.dev/';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
