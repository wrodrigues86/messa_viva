import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(here, '../../data/mesa-viva.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'platform_admin', establishment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(establishment_id) REFERENCES establishments(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);
CREATE TABLE IF NOT EXISTS establishments (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT DEFAULT '',
  address TEXT DEFAULT '', phone TEXT DEFAULT '', logo_url TEXT DEFAULT '', cover_url TEXT DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#176b52', accent_color TEXT NOT NULL DEFAULT '#e7a83e',
  published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, establishment_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
  image_url TEXT DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(establishment_id) REFERENCES establishments(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, establishment_id TEXT NOT NULL, category_id TEXT NOT NULL,
  name TEXT NOT NULL, description TEXT DEFAULT '', price REAL NOT NULL CHECK(price >= 0),
  promotional_price REAL CHECK(promotional_price IS NULL OR promotional_price >= 0),
  image_url TEXT DEFAULT '', available INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(establishment_id) REFERENCES establishments(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_categories_establishment ON categories(establishment_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_establishment ON products(establishment_id, category_id);
`);

// Migrate older databases safely as optional columns are added over time.
const columns = db.prepare('PRAGMA table_info(establishments)').all().map((row) => row.name);
for (const [name, definition] of [['logo_url', "TEXT DEFAULT ''"], ['cover_url', "TEXT DEFAULT ''"], ['primary_color', "TEXT NOT NULL DEFAULT '#176b52'"], ['accent_color', "TEXT NOT NULL DEFAULT '#e7a83e'"], ['published', 'INTEGER NOT NULL DEFAULT 0']]) {
  if (!columns.includes(name)) db.exec(`ALTER TABLE establishments ADD COLUMN ${name} ${definition}`);
}

