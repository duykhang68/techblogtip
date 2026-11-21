import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG 2.2 AA: normal-size text should reach 4.5:1 against its actual surface.
const css=readFileSync('src/styles/global.css','utf8');
const layout=readFileSync('src/layouts/BaseLayout.astro','utf8');

function color(rule, property='color') {
  const escaped=rule.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const body=css.match(new RegExp(escaped + '\\{([^}]*)\\}'))?.[1];
  assert.ok(body,'Missing CSS rule '+rule);
  const match=body.match(new RegExp('(?:^|;)'+property.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':(#[0-9a-fA-F]{6})'));
  assert.ok(match,'Missing '+property+' in '+rule);
  return match[1];
}
function luminance(hex) {
  const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255);
  const linear=channels.map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4);
  return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function contrast(foreground,background) {
  const first=luminance(foreground),second=luminance(background);
  return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);
}
test('small text colors on homepage and articles meet WCAG AA contrast',()=>{
  const paper='#fbfaf8',white='#ffffff';
  const cases=[
    {label:'Accent headings/links on white',foreground:color(':root','--accent'),background:white},
    {label:'Accent headings/links on paper',foreground:color(':root','--accent'),background:paper},
    ...[
      ['.issue-label',paper],
      ['.card-meta',paper],
      ['.breadcrumb',paper],
      ['.article-byline',paper],
      ['.toc-link',paper],
      ['.topic-chips a span',white],
    ].map(([selector,background])=>({label:selector,foreground:color(selector),background}))
  ];
  for (const item of cases) {
    assert.ok(contrast(item.foreground,item.background)>=4.5,
      item.label+' has insufficient WCAG AA contrast: '+contrast(item.foreground,item.background).toFixed(2)+':1');
  }
});
test('Google Fonts is non-render-blocking with a fallback for visitors without JavaScript',()=>{
  assert.doesNotMatch(css,/@import\s+url\(.*fonts.googleapis/);
  assert.match(layout,/fonts.googleapis.com[^"]*" media="print" onload="this.media='all'"/);
  assert.match(layout,/<noscript><link rel="stylesheet" href="https:\/\/fonts.googleapis.com/);
  assert.match(layout,/fonts.gstatic.com" crossorigin/);
});
