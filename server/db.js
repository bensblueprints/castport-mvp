const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node')
    .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  return fs.existsSync(p) ? p : null;
}

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'artwork'), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(path.join(dataDir, 'app.db'), nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      artwork_path TEXT DEFAULT NULL,
      category TEXT NOT NULL DEFAULT 'Technology',
      subcategory TEXT DEFAULT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      explicit INTEGER NOT NULL DEFAULT 0,
      link TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      show_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      notes_md TEXT NOT NULL DEFAULT '',
      audio_path TEXT DEFAULT NULL,
      audio_bytes INTEGER DEFAULT 0,
      audio_duration_sec REAL DEFAULT 0,
      mime TEXT DEFAULT 'audio/mpeg',
      episode_no INTEGER DEFAULT NULL,
      season_no INTEGER DEFAULT NULL,
      type TEXT NOT NULL DEFAULT 'full',        -- full | trailer | bonus
      explicit INTEGER NOT NULL DEFAULT 0,
      artwork_path TEXT DEFAULT NULL,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
      UNIQUE(show_id, slug)
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id TEXT NOT NULL,
      start_sec REAL NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      url TEXT DEFAULT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id TEXT NOT NULL,
      day TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      ua_class TEXT DEFAULT NULL,
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(episode_id, day, ip_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_published ON episodes(published_at);
    CREATE INDEX IF NOT EXISTS idx_chapters_episode ON chapters(episode_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_episode_day ON downloads(episode_id, day);
  `);

  return db;
}

module.exports = { openDb };
