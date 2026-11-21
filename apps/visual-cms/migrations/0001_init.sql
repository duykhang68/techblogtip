PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS cms_pages (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL, locale TEXT NOT NULL, title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', draft_json TEXT NOT NULL,
 published_json TEXT, status TEXT NOT NULL DEFAULT 'draft',
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, published_at TEXT,
 UNIQUE(slug,locale)
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_updated ON cms_pages(updated_at);
CREATE TABLE IF NOT EXISTS cms_revisions (
 page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, document_json TEXT NOT NULL,
 actor TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(page_id,revision)
);
CREATE TABLE IF NOT EXISTS cms_assets (
 id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL,
 size INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_comments (
 id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
 author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_comments_page ON cms_comments(page_id,created_at);
