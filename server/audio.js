const fs = require('fs');
const crypto = require('crypto');

// Daily salt so ip_hash cannot be correlated across days or reversed to an IP.
function dailySalt(day) {
  return crypto.createHash('sha256').update(`castport-salt-${day}`).digest('hex').slice(0, 16);
}

function hashIp(ip, day) {
  return crypto.createHash('sha256').update(`${dailySalt(day)}:${ip || 'unknown'}`).digest('hex');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req) {
  // honor the first hop of X-Forwarded-For when behind a reverse proxy
  // (app must set `app.set('trust proxy', true)` for req.ip to reflect this too)
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function classifyUa(ua) {
  if (!ua) return 'unknown';
  ua = ua.toLowerCase();
  if (/itunes|applecoremedia|applepodcasts/.test(ua)) return 'apple';
  if (/spotify/.test(ua)) return 'spotify';
  if (/overcast/.test(ua)) return 'overcast';
  if (/pocketcasts/.test(ua)) return 'pocketcasts';
  if (/mozilla|chrome|safari|firefox/.test(ua)) return 'browser';
  return 'other';
}

// Records one unique-per-episode-per-day-per-ip download row. Safe to call on
// every request (byte-range re-requests from the same IP/day are deduped by
// the UNIQUE(episode_id, day, ip_hash) constraint + INSERT OR IGNORE).
function logDownload(db, episodeId, req) {
  const day = todayStr();
  const ip = clientIp(req);
  const ipHash = hashIp(ip, day);
  const uaClass = classifyUa(req.headers['user-agent']);
  db.prepare(
    'INSERT OR IGNORE INTO downloads (episode_id, day, ip_hash, ua_class) VALUES (?, ?, ?, ?)'
  ).run(episodeId, day, ipHash, uaClass);
}

// Explicit HTTP Range support — Apple Podcasts and most players require this
// on audio enclosures. `res.sendFile` doesn't reliably negotiate ranges for
// custom-mounted routes, so we implement it by hand.
function serveAudioRange(req, res, filePath, mime) {
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const stat = fs.statSync(filePath);
  const total = stat.size;
  res.set('Accept-Ranges', 'bytes');
  res.set('Content-Type', mime || 'audio/mpeg');

  const range = req.headers.range;
  if (!range) {
    res.set('Content-Length', String(total));
    if (req.method === 'HEAD') return res.status(200).end();
    return fs.createReadStream(filePath).pipe(res);
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    res.set('Content-Range', `bytes */${total}`);
    return res.status(416).end();
  }
  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : total - 1;
  if (isNaN(start) || isNaN(end) || start > end || end >= total) {
    res.set('Content-Range', `bytes */${total}`);
    return res.status(416).end();
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.set('Content-Range', `bytes ${start}-${end}/${total}`);
  res.set('Content-Length', String(chunkSize));
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

module.exports = { hashIp, logDownload, serveAudioRange, clientIp, todayStr };
