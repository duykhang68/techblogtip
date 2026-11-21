-- G-CMS isolated D1 schema. Never share or migrate Visual CMS / Google Sheets Publisher data.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS gcms_entries (
 id TEXT PRIMARY KEY,
 type TEXT NOT NULL CHECK(type IN ('post','page')),
 title TEXT NOT NULL,
 slug TEXT NOT NULL,
 excerpt TEXT NOT NULL DEFAULT '',
 body_json TEXT NOT NULL DEFAULT '[]',
 tags_json TEXT NOT NULL DEFAULT '[]',
 seo_json TEXT NOT NULL DEFAULT '{}',
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members','paid')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published')),
 revision INTEGER NOT NULL DEFAULT 1,
 author TEXT NOT NULL,
 scheduled_at TEXT,
 published_at TEXT,
 published_json TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(type,slug)
);
CREATE INDEX IF NOT EXISTS gcms_entries_status ON gcms_entries(type,status,updated_at);
CREATE INDEX IF NOT EXISTS gcms_entries_schedule ON gcms_entries(status,scheduled_at);
CREATE TABLE IF NOT EXISTS gcms_versions (
 entry_id TEXT NOT NULL REFERENCES gcms_entries(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(entry_id,revision)
);
CREATE TABLE IF NOT EXISTS gcms_members (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
 labels_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'free' CHECK(status IN ('free','complimentary','inactive')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gcms_newsletters (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gcms_tiers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 monthly_cents INTEGER NOT NULL DEFAULT 0, yearly_cents INTEGER NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'USD',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gcms_media (
 id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gcms_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL,
 resource_id TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gcms_audit_created ON gcms_audit(created_at);
