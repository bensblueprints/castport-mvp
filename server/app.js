const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const sharp = require('sharp');
const { openDb } = require('./db');
const { CATEGORIES, DEFAULT_CATEGORY, isValidCategory, isValidSubcategory } = require('./itunes-categories');
const { buildFeedXml } = require('./rss');
const { renderShowPage, renderEpisodePage, renderEmbedPage } = require('./public-pages');
const { logDownload, serveAudioRange } = require('./audio');

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'show';
}

// Store timestamps in SQLite's datetime format ('YYYY-MM-DD HH:MM:SS', UTC) so
// string comparison against datetime('now') works for scheduled-publish filtering.
function toSqlDate(v) {
  const d = v ? new Date(v) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  return safe.toISOString().replace('T', ' ').slice(0, 19);
}

async function probeDuration(filePath) {
  try {
    const mm = await import('music-metadata');
    const meta = await mm.parseFile(filePath);
    return meta.format.duration || 0;
  } catch (e) {
    return 0;
  }
}

function createApp(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD || 'admin';
  const autologinToken = opts.autologinToken || process.env.AUTOLOGIN_TOKEN || null;
  const baseUrl = (opts.baseUrl || process.env.BASE_URL || `http://localhost:${process.env.PORT || 5329}`).replace(/\/$/, '');

  const db = openDb(dataDir);
  const audioDir = path.join(dataDir, 'audio');
  const artworkDir = path.join(dataDir, 'artwork');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---- sessions (in-memory, simple by design — single-admin tool) ----
  const sessions = new Set();
  function newSession(res) {
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.add(sid);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    return sid;
  }
  function requireAuth(req, res, next) {
    if (req.cookies.sid && sessions.has(req.cookies.sid)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- uploads ----
  const artworkStorage = multer.diskStorage({
    destination: artworkDir,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  });
  const artworkUpload = multer({
    storage: artworkStorage,
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g)$/.test(file.mimetype))
  });

  const audioStorage = multer.diskStorage({
    destination: audioDir,
    filename: (req, file, cb) => {
      const ext = /m4a|mp4/i.test(file.mimetype) ? '.m4a' : '.mp3';
      cb(null, `${req.params.id}${ext}`);
    }
  });
  const audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^audio\/(mpeg|mp4|x-m4a|m4a)$/.test(file.mimetype) || /\.(mp3|m4a)$/i.test(file.originalname))
  });

  app.use('/artwork', express.static(artworkDir, { maxAge: '7d' }));

  // ================= AUTH =================

  app.post('/api/login', (req, res) => {
    const pw = String(req.body?.password || '');
    const a = Buffer.from(pw);
    const b = Buffer.from(adminPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    newSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    sessions.delete(req.cookies.sid);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: !!(req.cookies.sid && sessions.has(req.cookies.sid)) });
  });

  if (autologinToken) {
    app.get('/auth/auto', (req, res) => {
      if (req.query.token !== autologinToken) return res.status(403).send('Forbidden');
      newSession(res);
      res.redirect('/admin');
    });
  }

  app.get('/api/meta', requireAuth, (req, res) => {
    res.json({ categories: CATEGORIES, defaultCategory: DEFAULT_CATEGORY });
  });

  // ================= SHOWS (admin) =================

  const showRow = (s) => s;

  app.get('/api/shows', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM shows ORDER BY created_at DESC').all());
  });

  app.get('/api/shows/:id', requireAuth, (req, res) => {
    const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(req.params.id);
    if (!show) return res.status(404).json({ error: 'Not found' });
    res.json(show);
  });

  app.post('/api/shows', requireAuth, (req, res) => {
    const b = req.body || {};
    const title = String(b.title || 'Untitled Show');
    let slug = slugify(b.slug || title);
    const exists = (s) => db.prepare('SELECT 1 FROM shows WHERE slug = ?').get(s);
    let base = slug,
      n = 1;
    while (exists(slug)) slug = `${base}-${++n}`;

    const category = isValidCategory(b.category) ? b.category : DEFAULT_CATEGORY;
    const subcategory = isValidSubcategory(category, b.subcategory) ? b.subcategory || null : null;

    const info = db
      .prepare(
        `INSERT INTO shows (slug, title, description, author, owner_email, category, subcategory, language, explicit, link)
         VALUES (@slug, @title, @description, @author, @owner_email, @category, @subcategory, @language, @explicit, @link)`
      )
      .run({
        slug,
        title,
        description: String(b.description || ''),
        author: String(b.author || ''),
        owner_email: String(b.owner_email || ''),
        category,
        subcategory,
        language: String(b.language || 'en'),
        explicit: b.explicit ? 1 : 0,
        link: String(b.link || '')
      });
    res.status(201).json(db.prepare('SELECT * FROM shows WHERE id = ?').get(info.lastInsertRowid));
  });

  app.put('/api/shows/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM shows WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = { ...existing, ...req.body };
    const category = isValidCategory(b.category) ? b.category : DEFAULT_CATEGORY;
    const subcategory = isValidSubcategory(category, b.subcategory) ? b.subcategory || null : null;
    db.prepare(
      `UPDATE shows SET title=@title, description=@description, author=@author, owner_email=@owner_email,
       category=@category, subcategory=@subcategory, language=@language, explicit=@explicit, link=@link WHERE id=@id`
    ).run({
      id: existing.id,
      title: String(b.title || ''),
      description: String(b.description || ''),
      author: String(b.author || ''),
      owner_email: String(b.owner_email || ''),
      category,
      subcategory,
      language: String(b.language || 'en'),
      explicit: b.explicit ? 1 : 0,
      link: String(b.link || '')
    });
    res.json(db.prepare('SELECT * FROM shows WHERE id = ?').get(existing.id));
  });

  app.delete('/api/shows/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM episodes WHERE show_id = ?').run(req.params.id);
    db.prepare('DELETE FROM shows WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/shows/:id/artwork', requireAuth, artworkUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image received (png/jpg, max 12MB)' });
    const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(req.params.id);
    if (!show) return res.status(404).json({ error: 'Not found' });

    let warning = null;
    try {
      const meta = await sharp(req.file.path).metadata();
      const { width, height } = meta;
      if (width !== height) warning = `Artwork is ${width}x${height} — Apple requires a perfectly square image.`;
      else if (width < 1400 || width > 3000) warning = `Artwork is ${width}x${height} — Apple requires 1400-3000px square.`;
      if (meta.space && meta.space !== 'srgb' && meta.space !== 'rgb') {
        warning = (warning ? warning + ' ' : '') + `Color space is ${meta.space}, Apple requires RGB.`;
      }
    } catch {
      warning = 'Could not read image metadata.';
    }

    const url = `/artwork/${req.file.filename}`;
    db.prepare('UPDATE shows SET artwork_path = ? WHERE id = ?').run(url, show.id);
    res.json({ url, warning });
  });

  // ================= EPISODES (admin) =================

  app.get('/api/shows/:id/episodes', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM episodes WHERE show_id = ? ORDER BY published_at DESC').all(req.params.id));
  });

  app.post('/api/shows/:id/episodes', requireAuth, (req, res) => {
    const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(req.params.id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    const b = req.body || {};
    const id = crypto.randomUUID();
    const title = String(b.title || 'Untitled Episode');
    let slug = slugify(b.slug || title);
    const exists = (s) => db.prepare('SELECT 1 FROM episodes WHERE show_id = ? AND slug = ?').get(show.id, s);
    let base = slug,
      n = 1;
    while (exists(slug)) slug = `${base}-${++n}`;

    db.prepare(
      `INSERT INTO episodes (id, show_id, slug, title, notes_md, episode_no, season_no, type, explicit, published_at)
       VALUES (@id, @show_id, @slug, @title, @notes_md, @episode_no, @season_no, @type, @explicit, @published_at)`
    ).run({
      id,
      show_id: show.id,
      slug,
      title,
      notes_md: String(b.notes_md || ''),
      episode_no: b.episode_no ? Number(b.episode_no) : null,
      season_no: b.season_no ? Number(b.season_no) : null,
      type: ['full', 'trailer', 'bonus'].includes(b.type) ? b.type : 'full',
      explicit: b.explicit ? 1 : 0,
      published_at: toSqlDate(b.published_at)
    });
    res.status(201).json(db.prepare('SELECT * FROM episodes WHERE id = ?').get(id));
  });

  app.get('/api/episodes/:id', requireAuth, (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!ep) return res.status(404).json({ error: 'Not found' });
    const chapters = db.prepare('SELECT * FROM chapters WHERE episode_id = ? ORDER BY position ASC, start_sec ASC').all(ep.id);
    res.json({ ...ep, chapters });
  });

  app.put('/api/episodes/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = { ...existing, ...req.body };
    db.prepare(
      `UPDATE episodes SET title=@title, notes_md=@notes_md, episode_no=@episode_no, season_no=@season_no,
       type=@type, explicit=@explicit, published_at=@published_at WHERE id=@id`
    ).run({
      id: existing.id,
      title: String(b.title || ''),
      notes_md: String(b.notes_md || ''),
      episode_no: b.episode_no ? Number(b.episode_no) : null,
      season_no: b.season_no ? Number(b.season_no) : null,
      type: ['full', 'trailer', 'bonus'].includes(b.type) ? b.type : 'full',
      explicit: b.explicit ? 1 : 0,
      published_at: b.published_at ? toSqlDate(b.published_at) : existing.published_at
    });
    res.json(db.prepare('SELECT * FROM episodes WHERE id = ?').get(existing.id));
  });

  app.delete('/api/episodes/:id', requireAuth, (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (ep?.audio_path) {
      const p = path.join(dataDir, ep.audio_path.replace(/^\//, ''));
      fs.rm(p, { force: true }, () => {});
    }
    db.prepare('DELETE FROM chapters WHERE episode_id = ?').run(req.params.id);
    db.prepare('DELETE FROM episodes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/episodes/:id/audio', requireAuth, audioUpload.single('file'), async (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!ep) return res.status(404).json({ error: 'Episode not found' });
    if (!req.file) return res.status(400).json({ error: 'No audio file received (mp3/m4a)' });

    const mime = /\.m4a$/i.test(req.file.filename) ? 'audio/mp4' : 'audio/mpeg';
    const duration = await probeDuration(req.file.path);

    db.prepare('UPDATE episodes SET audio_path=?, audio_bytes=?, audio_duration_sec=?, mime=? WHERE id=?').run(
      `/audio/${req.file.filename}`,
      req.file.size,
      duration,
      mime,
      ep.id
    );
    res.json(db.prepare('SELECT * FROM episodes WHERE id = ?').get(ep.id));
  });

  app.put('/api/episodes/:id/chapters', requireAuth, (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!ep) return res.status(404).json({ error: 'Not found' });
    const list = Array.isArray(req.body?.chapters) ? req.body.chapters : [];
    const tx = db.transaction((chapters) => {
      db.prepare('DELETE FROM chapters WHERE episode_id = ?').run(ep.id);
      const stmt = db.prepare('INSERT INTO chapters (episode_id, start_sec, title, url, position) VALUES (?, ?, ?, ?, ?)');
      chapters.forEach((c, i) => stmt.run(ep.id, Number(c.start_sec) || 0, String(c.title || ''), c.url || null, i));
    });
    tx(list);
    res.json(db.prepare('SELECT * FROM chapters WHERE episode_id = ? ORDER BY position ASC').all(ep.id));
  });

  app.post('/api/episodes/:id/artwork', requireAuth, artworkUpload.single('file'), (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    if (!ep) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'No image received' });
    const url = `/artwork/${req.file.filename}`;
    db.prepare('UPDATE episodes SET artwork_path = ? WHERE id = ?').run(url, ep.id);
    res.json({ url });
  });

  // ================= STATS (admin) =================

  function seriesForDays(rows, days) {
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r.n]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ date: d, downloads: byDay[d] || 0 });
    }
    return out;
  }

  app.get('/api/stats/show/:id', requireAuth, (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const episodeIds = db.prepare('SELECT id FROM episodes WHERE show_id = ?').all(req.params.id).map((r) => r.id);
    if (!episodeIds.length) return res.json({ total: 0, series: seriesForDays([], days), perEpisode: [] });
    const placeholders = episodeIds.map(() => '?').join(',');
    const total = db.prepare(`SELECT COUNT(*) AS n FROM downloads WHERE episode_id IN (${placeholders})`).get(...episodeIds).n;
    const rows = db
      .prepare(
        `SELECT day, COUNT(*) AS n FROM downloads WHERE episode_id IN (${placeholders}) AND day >= date('now', '-${days} days') GROUP BY day`
      )
      .all(...episodeIds);
    const perEpisode = db
      .prepare(
        `SELECT e.id, e.title, COUNT(d.id) AS downloads FROM episodes e LEFT JOIN downloads d ON d.episode_id = e.id
         WHERE e.show_id = ? GROUP BY e.id ORDER BY e.published_at DESC`
      )
      .all(req.params.id);
    res.json({ total, series: seriesForDays(rows, days), perEpisode });
  });

  app.get('/api/stats/episode/:id', requireAuth, (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const total = db.prepare('SELECT COUNT(*) AS n FROM downloads WHERE episode_id = ?').get(req.params.id).n;
    const rows = db
      .prepare(`SELECT day, COUNT(*) AS n FROM downloads WHERE episode_id = ? AND day >= date('now', '-${days} days') GROUP BY day`)
      .all(req.params.id);
    res.json({ total, series: seriesForDays(rows, days) });
  });

  // ================= PUBLIC: RSS FEED =================

  app.get('/feed/:slug.xml', async (req, res) => {
    const show = db.prepare('SELECT * FROM shows WHERE slug = ?').get(req.params.slug);
    if (!show) return res.status(404).send('Not found');
    const episodes = db
      .prepare("SELECT * FROM episodes WHERE show_id = ? AND published_at <= datetime('now') ORDER BY published_at DESC")
      .all(show.id);
    const xml = await buildFeedXml({ show, episodes, baseUrl });
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  });

  // ================= PUBLIC: pages =================

  app.get('/p/:showSlug', (req, res) => {
    const show = db.prepare('SELECT * FROM shows WHERE slug = ?').get(req.params.showSlug);
    if (!show) return res.status(404).send('Show not found');
    const episodes = db
      .prepare("SELECT * FROM episodes WHERE show_id = ? AND published_at <= datetime('now') ORDER BY published_at DESC")
      .all(show.id);
    res.type('html').send(renderShowPage({ show, episodes, baseUrl }));
  });

  app.get('/p/:showSlug/:episodeSlug', async (req, res) => {
    const show = db.prepare('SELECT * FROM shows WHERE slug = ?').get(req.params.showSlug);
    if (!show) return res.status(404).send('Show not found');
    const ep = db
      .prepare("SELECT * FROM episodes WHERE show_id = ? AND slug = ? AND published_at <= datetime('now')")
      .get(show.id, req.params.episodeSlug);
    if (!ep) return res.status(404).send('Episode not found');
    const chapters = db.prepare('SELECT * FROM chapters WHERE episode_id = ? ORDER BY position ASC, start_sec ASC').all(ep.id);
    res.type('html').send(await renderEpisodePage({ show, ep, chapters, baseUrl }));
  });

  app.get('/embed/:episodeId', (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.episodeId);
    if (!ep) return res.status(404).send('Not found');
    const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(ep.show_id);
    res.set('X-Frame-Options', 'ALLOWALL');
    res.type('html').send(renderEmbedPage({ show, ep, baseUrl }));
  });

  app.get('/chapters/:episodeId.json', (req, res) => {
    const chapters = db
      .prepare('SELECT start_sec, title, url FROM chapters WHERE episode_id = ? ORDER BY position ASC, start_sec ASC')
      .all(req.params.episodeId);
    res.type('application/json+chapters').json({
      version: '1.2.0',
      chapters: chapters.map((c) => ({ startTime: c.start_sec, title: c.title, ...(c.url ? { url: c.url } : {}) }))
    });
  });

  // ================= PUBLIC: audio (Range + download logging) =================

  app.get('/audio/:episodeId.mp3', (req, res) => {
    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.episodeId);
    if (!ep || !ep.audio_path) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(dataDir, ep.audio_path.replace(/^\//, ''));
    logDownload(db, ep.id, req);
    serveAudioRange(req, res, filePath, ep.mime);
  });

  // ================= ADMIN SPA =================
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use('/admin', express.static(distDir));
    app.get('/admin/*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/admin', (req, res) =>
      res.status(503).type('html').send('<h1>Admin UI not built</h1><p>Run <code>npm run build</code> first.</p>')
    );
  }

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
