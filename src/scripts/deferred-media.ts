// Native SSG markup stays crawlable; defer only large media network transfers.
function initDeferredMedia(): void {
  const media = document.querySelectorAll<HTMLImageElement | HTMLIFrameElement>(
    'img[data-defer-src], iframe[data-defer-src]'
  );
  const load = (element: HTMLImageElement | HTMLIFrameElement): void => {
    const src = element.dataset.deferSrc;
    if (!src) return;
    const srcset = element.getAttribute('data-defer-srcset');
    if (srcset && element instanceof HTMLImageElement) {
      element.srcset = srcset;
      element.removeAttribute('data-defer-srcset');
    }
    element.src = src;
    element.removeAttribute('data-defer-src');
  };
  if (!('IntersectionObserver' in window)) {
    media.forEach(load);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLImageElement | HTMLIFrameElement;
      observer.unobserve(element);
      load(element);
    }
  }, { rootMargin: '160px 0px', threshold: 0.01 });
  media.forEach(element => observer.observe(element));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDeferredMedia, { once: true });
} else {
  initDeferredMedia();
}
