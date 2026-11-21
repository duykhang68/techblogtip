import { defineConfig } from 'astro/config';

const githubPages = process.env.DEPLOY_TARGET === 'github-pages';
const site = githubPages
  ? 'https://duykhang68.github.io'
  : process.env.SITE_URL || 'https://techblogtip-staging.tamsudev-com.workers.dev/';

export default defineConfig({
  site,
  base: githubPages ? '/techblogtip' : '/',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
