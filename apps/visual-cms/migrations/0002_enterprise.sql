-- Upgrade preserves cms_pages, media, comments and revisions.
-- Existing pages and assets belong to workspace "default".
ALTER TABLE cms_pages ADD COLUMN space_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE cms_assets ADD COLUMN space_id TEXT NOT NULL DEFAULT 'default';
CREATE TABLE IF NOT EXISTS cms_spaces (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO cms_spaces(id,title,created_by,created_at,updated_at)
 VALUES ('default','TechBlogTip','migration',datetime('now'),datetime('now'));
CREATE TABLE IF NOT EXISTS cms_space_members (
 space_id TEXT NOT NULL REFERENCES cms_spaces(id) ON DELETE CASCADE,
 email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','editor','reviewer')),
 created_at TEXT NOT NULL,
 PRIMARY KEY(space_id,email)
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_space ON cms_pages(space_id,updated_at);
CREATE INDEX IF NOT EXISTS idx_cms_assets_space ON cms_assets(space_id,created_at);
CREATE TABLE IF NOT EXISTS cms_components (
 id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES cms_spaces(id),
 name TEXT NOT NULL, slug TEXT NOT NULL, blocks_json TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(space_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_cms_components_space ON cms_components(space_id);
CREATE TABLE IF NOT EXISTS cms_workflows (
 id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES cms_spaces(id),
 name TEXT NOT NULL, stages_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_workflows_active ON cms_workflows(space_id,active);
CREATE TABLE IF NOT EXISTS cms_page_stages (
 page_id TEXT PRIMARY KEY REFERENCES cms_pages(id) ON DELETE CASCADE,
 workflow_id TEXT REFERENCES cms_workflows(id), stage TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_schedules (
 id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES cms_spaces(id),
 page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('publish','unpublish')),
 execute_at TEXT NOT NULL, expected_revision INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','failed','canceled')),
 error TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cms_schedules_due ON cms_schedules(state,execute_at);
CREATE TABLE IF NOT EXISTS cms_audit (
 id TEXT PRIMARY KEY, space_id TEXT NOT NULL, actor TEXT NOT NULL,
 action TEXT NOT NULL, resource TEXT NOT NULL, details TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_audit ON cms_audit(space_id,created_at);
CREATE TABLE IF NOT EXISTS cms_ai_usage (
 date TEXT NOT NULL, email TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(date,email)
);
