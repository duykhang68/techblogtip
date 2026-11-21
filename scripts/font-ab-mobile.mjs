// Isolated mobile font A/B audit. Does not alter site source or production branding.
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';

const SITE = process.env.FONT_AB_URL || 'https://duykhang68.github.io/techblogtip/';
const RUNS = Math.max(1, Math.min(10, Number(process.env.FONT_AB_RUNS || 3)));
const OUTPUT = 'artifacts/font-ab';
const googleCss = 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..800&display=optional';
const variants = [
  { name: 'be-vietnam-pro', family: 'Be Vietnam Pro' },
  { name: 'google-sans-flex', family: 'Google Sans Flex' },
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];

const median = values => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  return ordered.length ? ordered[Math.floor(ordered.length / 2)] : null;
};
const round = value => value === null ? null : Math.round(value * 100) / 100;

try {
  for (let sample = 0; sample < RUNS; sample++) {
    // Alternate order to reduce timing bias. Each run has an isolated cold cache.
    for (const variant of (sample % 2 ? [...variants].reverse() : variants)) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: 'vi-VN',
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 1_600_000 / 8,
        uploadThroughput: 750_000 / 8, connectionType: 'cellular4g',
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const requests = new Map();
      const fonts = [];
      cdp.on('Network.responseReceived', ({ requestId, response, type }) => {
        requests.set(requestId, { url: response.url, mime: response.mimeType, status: response.status, type });
      });
      cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
        const response = requests.get(requestId);
        if (!response) return;
        if (/woff2?|font|octet-stream/i.test(response.mime) || /\.(woff2?|ttf)(\?|$)/i.test(response.url)) {
          fonts.push({ url: response.url, bytes: Math.round(encodedDataLength), status: response.status, mime: response.mime });
        }
      });
      // Register observers before any page scripts or media execute.
      await page.addInitScript(() => {
        window.__fontAB = { lcp: null, cls: 0 };
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__fontAB.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__fontAB.cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      if (variant.name === 'google-sans-flex') {
        // Substitute stylesheet in the HTML navigation response, before parsing.
        // No be-vietnam font request and no typography change committed to site.
        await page.route('**/*', async route => {
          const req = route.request();
          if (!req.isNavigationRequest() || !req.isMainFrame()) return route.continue();
          const response = await route.fetch();
          const contentType = response.headers()['content-type'] || '';
          if (!contentType.includes('text/html')) return route.fulfill({ response });
          let html = await response.text();
          // Remove existing Be Vietnam Pro Google Fonts stylesheet and noscript fallback.
          html = html.replace(/<noscript>\s*<link[^>]*Be\+Vietnam\+Pro[^>]*>\s*<\/noscript>/gi, '');
          html = html.replace(/<link\b[^>]*Be\+Vietnam\+Pro[^>]*>/gi, '');
          const injection = '<link rel="stylesheet" href="' + googleCss + '">' +
            '<style>html,body,main,article,header,nav,footer,h1,h2,h3,h4,h5,h6,p,a,span,small,strong,button,input,select,textarea,li {font-family:"Google Sans Flex",system-ui,sans-serif!important}</style>';
          html = html.replace('</head>', injection + '</head>');
          return route.fulfill({ response, body: html, headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' } });
        });
      }
      let error = null;
      try {
        const response = await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });
        if (!response?.ok()) throw new Error('Navigation returned ' + (response?.status() ?? 'no response'));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(3000);
      } catch (e) { error = String(e); }
      const metrics = await page.evaluate(family => ({
        lcpMs: window.__fontAB?.lcp ?? null,
        cls: window.__fontAB?.cls ?? null,
        actualFamily: getComputedStyle(document.body).fontFamily,
        fontLoaded: [...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === family && face.status === 'loaded'),
        fontResources: performance.getEntriesByType('resource')
          .filter(e => /fonts\.(googleapis|gstatic)\.com/.test(e.name))
          .map(e => ({ url: e.name, transferSize: e.transferSize || null })),
      }), variant.family).catch(e => ({ error: String(e) }));
      const record = {
        variant: variant.name, sample: sample + 1,
        lcpMs: metrics.lcpMs ?? null, cls: metrics.cls ?? null,
        actualFamily: metrics.actualFamily, fontLoaded: metrics.fontLoaded ?? false,
        fontRequests: fonts.length, fontTransferBytes: fonts.reduce((sum, f) => sum + f.bytes, 0),
        woff2Requests: fonts.filter(f => /woff2/i.test(f.mime) || /\.woff2/i.test(f.url)).length,
        resources: fonts, cssResources: metrics.fontResources, error: error || metrics.error || null,
      };
      results.push(record);
      console.log(JSON.stringify({ variant: record.variant, sample: record.sample, lcpMs: record.lcpMs, cls: record.cls, fontRequests: record.fontRequests, fontTransferBytes: record.fontTransferBytes, fontLoaded: record.fontLoaded, error: record.error }));
      await context.close();
    }
  }
} finally { await browser.close(); }

const summary = variants.map(variant => {
  const records = results.filter(r => r.variant === variant.name);
  return {
    variant: variant.name,
    lcpMedianMs: round(median(records.map(r => r.lcpMs))),
    clsMedian: round(median(records.map(r => r.cls))),
    fontRequestsMedian: median(records.map(r => r.fontRequests)),
    woff2RequestsMedian: median(records.map(r => r.woff2Requests)),
    fontTransferBytesMedian: median(records.map(r => r.fontTransferBytes)),
    validSamples: records.filter(r => !r.error && r.fontLoaded && r.lcpMs !== null).length,
  };
});
await mkdir(OUTPUT, { recursive: true });
await writeFile(OUTPUT + '/report.json', JSON.stringify({ target: SITE, runs: RUNS, emulation: '390x844 mobile / 4x CPU / 150ms RTT / 1.6Mbps down / cold cache', summary, results }, null, 2));
const rows = summary.map(r => '| ' + r.variant + ' | ' + (r.lcpMedianMs ?? 'N/A') + ' | ' + (r.clsMedian ?? 'N/A') + ' | ' + (r.fontRequestsMedian ?? 'N/A') + ' | ' + (r.woff2RequestsMedian ?? 'N/A') + ' | ' + (r.fontTransferBytesMedian ?? 'N/A') + ' | ' + r.validSamples + '/' + RUNS + ' |').join('\n');
const markdown = '# TechBlogTip mobile font A/B\n\nTarget: ' + SITE +
  '\n\nMobile emulation: 390×844, CPU 4×, RTT 150ms, downlink 1.6Mbps, fresh context/cache per trial. Median across ' + RUNS + ' repetitions. Measurements from Chromium CDP and PerformanceObserver; **not** Lighthouse field Core Web Vitals. CSS requests excluded from font file bytes; JSON includes details.\n\n' +
  '| Variant | LCP median (ms) | CLS median | Font requests | WOFF2 requests | Font bytes | Valid samples |\n|---|---:|---:|---:|---:|---:|---:|\n' + rows +
  '\n\nA variant with valid samples below ' + RUNS + ' is **inconclusive**. Compare only if both fonts genuinely loaded. No automatic production font switch.\n';
await writeFile(OUTPUT + '/report.md', markdown);
console.log(markdown);
if (summary.some(r => r.validSamples !== RUNS)) process.exitCode = 1;
