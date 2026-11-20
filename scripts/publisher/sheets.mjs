import { createHash } from 'node:crypto';

/**
 * Pure Google Sheets editorial adapter. This module does NOT call Sheets,
 * GitHub or Cloudflare. Authentication, server-side reread, PR creation,
 * and production writeback require a separate audited Worker integration.
 *
 * All user-provided fields are treated as untrusted input.
 */
export const SHEETS_SOURCE_COLUMNS = Object.freeze({
  sourceId: 'A', title: 'B', body: 'C', author: 'D',
  category: 'E', tags: 'F', summary: 'G', series: 'H',
  status: 'I', slug: 'J',
  sourceHash: 'K', draftPr: 'L', publishedUrl: 'M',
  releaseSha: 'N', publishedAt: 'O',
});

const AUTHOR_FIELDS = Object.freeze(['title', 'body', 'author', 'category', 'tags', 'summary', 'series', 'slug']);
const SYSTEM_FIELDS = Object.freeze(['sourceId', 'sourceHash', 'draftPr', 'publishedUrl', 'releaseSha', 'publishedAt']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeCell(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : String(value ?? '').trim();
}

export function vietnameseSlug(value) {
  return normalizeCell(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseTags(cell) {
  const values = normalizeCell(cell).split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
  return [...new Map(values.map(v => [v.toLocaleLowerCase('vi'), v])).values()];
}

export function sheetValuesToObject(values) {
  if (!Array.isArray(values)) throw new TypeError('Expected one spreadsheet row array');
  const keys = Object.keys(SHEETS_SOURCE_COLUMNS);
  return Object.fromEntries(keys.map((key, i) => [key, values[i] ?? '']));
}

function validateText(label, value, min, max) {
  if (value.length < min || value.length > max)
    throw new Error(label + ' must be between ' + min + ' and ' + max + ' characters');
}

function yamlValue(value) {
  // JSON scalar strings and arrays are valid YAML 1.2 and prevent newline/frontmatter injection.
  return JSON.stringify(value);
}

export function normalizeSheetRow(source, { spreadsheetId, sheetGid, publishedDate } = {}) {
  const row = Array.isArray(source) ? sheetValuesToObject(source) : source;
  if (!row || typeof row !== 'object') throw new TypeError('Expected a Sheets row');
  const location = { spreadsheetId: normalizeCell(spreadsheetId), sheetGid: normalizeCell(sheetGid) };
  if (!location.spreadsheetId || !/^\d+$/.test(location.sheetGid)) throw new Error('Trusted spreadsheetId and numeric sheetGid are required');

  const sourceId = normalizeCell(row.sourceId);
  if (!/^TBT-[A-Za-z0-9-]{8,80}$/.test(sourceId)) throw new Error('Stable system-issued sourceId required (TBT-...)');
  const status = normalizeCell(row.status).toUpperCase();
  if (status !== 'READY') throw new Error('Only READY rows can be prepared for PR review');

  const title = normalizeCell(row.title);
  const body = normalizeCell(row.body);
  const author = normalizeCell(row.author);
  const category = normalizeCell(row.category);
  const summary = normalizeCell(row.summary);
  const series = normalizeCell(row.series);
  const tags = parseTags(row.tags);
  validateText('title', title, 8, 140);
  validateText('body', body, 80, 100000);
  validateText('author', author, 2, 100);
  validateText('category', category, 2, 80);
  validateText('summary', summary, 25, 200);
  if (series) validateText('series', series, 2, 100);
  if (tags.length > 12 || tags.some(t => t.length > 45)) throw new Error('Maximum 12 tags, 45 chars each');
  const slug = normalizeCell(row.slug) || vietnameseSlug(title);
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) throw new Error('Invalid ASCII kebab-case slug');
  if (/<\s*(?:script|iframe|object|embed)\b/i.test(body) || /javascript\s*:/i.test(body))
    throw new Error('Unsupported executable HTML or JavaScript in content');
  if (/!\[[^\]]*\]\([^)]*\.(?:jpe?g|png|gif)(?:[?)])/i.test(body))
    throw new Error('Image attachments must be converted to WebP before publication');
  if (/!\[[^\]]*\]\(https?:\/\/(?:drive|docs)\.google\.com\//i.test(body))
    throw new Error('Google Drive media must be imported, never hotlinked');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeCell(publishedDate)) ||
      !Number.isFinite(Date.parse(publishedDate + 'T00:00:00Z')))
    throw new Error('An explicit publication ISO date is required');

  const authorContent = { title, body, author, category, tags, summary, series, slug };
  // Hash excludes row position, mutable system-owned columns and status.
  const identity = { ...location, sourceId };
  const fingerprint = createHash('sha256').update(JSON.stringify({ identity, authorContent })).digest('hex');
  return {
    ...authorContent, ...identity, fingerprint, status,
    publishedDate, path: 'src/content/articles/' + slug + '.md',
    sourceColumns: AUTHOR_FIELDS, systemColumns: SYSTEM_FIELDS,
  };
}

export function renderArticleFrontmatter(row) {
  const fields = {
    title: row.title, description: row.summary,
    published: row.publishedDate, category: row.category, author: row.author,
    tags: row.tags, ...(row.series ? { series: row.series } : {}),
    sourceType: 'google-sheets', sourceId: row.sourceId, sourceRevision: row.fingerprint,
    draft: false,
  };
  return '---\n' + Object.entries(fields).map(([key, value]) => key + ': ' + yamlValue(value)).join('\n') + '\n---\n\n';
}

export function prepareSheetArticle(raw, context) {
  const row = normalizeSheetRow(raw, context);
  return {
    sourceId: row.sourceId,
    sourceRevision: row.fingerprint,
    source: { spreadsheetId: row.spreadsheetId, sheetGid: row.sheetGid },
    path: row.path,
    markdown: renderArticleFrontmatter(row) + row.body + '\n',
  };
}
