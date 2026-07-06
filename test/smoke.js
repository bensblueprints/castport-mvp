// Smoke test — exercises the real server end-to-end against a throwaway SQLite db
// and real generated fixtures (no mocks):
//   1. login, create a show with a real 1400x1400 PNG artwork fixture (sharp)
//   2. generate a real 3s MP3 fixture (ffmpeg-static), upload it as an episode
//      with markdown notes + 2 chapters; assert file stored + duration probed
//   3. fetch /feed/:slug.xml, parse with fast-xml-parser, assert required
//      RSS 2.0 + itunes tags (enclosure length/type, guid, itunes:duration, pubDate)
//   4. Range-request the audio file, assert 206 + Content-Range + a downloads row;
//      re-request from the same IP/day (still 1 unique); different X-Forwarded-For (2)
//   5. scheduled (future) episode is absent from the feed and the public show page
//   6. embed page returns 200 and contains <audio
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { XMLParser } = require('fast-xml-parser');
const { createApp } = require('../server/app');

const CACHE = path.join(__dirname, '.cache');
fs.mkdirSync(CACHE, { recursive: true });

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'castport-test-'));
const app = createApp({ dataDir, adminPassword: 'test-pass-123', baseUrl: 'http://127.0.0.1:59999' });

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

(async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  let cookie = '';
  const jf = (url, opts = {}) =>
    fetch(base + url, {
      ...opts,
      redirect: 'manual',
      headers: { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), cookie, ...(opts.headers || {}) }
    });

  try {
    console.log('Smoke test: Castport\n');

    // --- auth ---
    let r = await jf('/api/shows');
    assert.strictEqual(r.status, 401, 'admin API requires auth');
    ok('admin API rejects unauthenticated requests');

    r = await jf('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) });
    assert.strictEqual(r.status, 401);
    r = await jf('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test-pass-123' }) });
    assert.strictEqual(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    ok('login sets session cookie');

    // --- create show ---
    r = await jf('/api/shows', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Smoke Test Cast',
        slug: 'smoke-test-cast',
        description: 'A podcast about testing podcasts.',
        author: 'Smoke Tester',
        owner_email: 'smoke@example.com',
        category: 'Technology',
        language: 'en',
        explicit: false,
        link: 'https://example.com/show'
      })
    });
    assert.strictEqual(r.status, 201);
    const show = await r.json();
    assert.strictEqual(show.slug, 'smoke-test-cast');
    ok('created show');

    // --- real 1400x1400 PNG artwork fixture via sharp ---
    const artworkPath = path.join(CACHE, 'artwork-1400.png');
    if (!fs.existsSync(artworkPath)) {
      await sharp({ create: { width: 1400, height: 1400, channels: 3, background: { r: 100, g: 50, b: 200 } } })
        .png()
        .toFile(artworkPath);
    }
    const artworkBuf = fs.readFileSync(artworkPath);
    let fd = new FormData();
    fd.append('file', new Blob([artworkBuf], { type: 'image/png' }), 'artwork.png');
    r = await fetch(`${base}/api/shows/${show.id}/artwork`, { method: 'POST', headers: { cookie }, body: fd });
    assert.strictEqual(r.status, 200);
    const artworkResult = await r.json();
    assert.strictEqual(artworkResult.warning, null, 'valid 1400x1400 RGB artwork gets no warning: ' + artworkResult.warning);
    ok('uploaded valid 1400x1400 show artwork, no validation warning');

    // --- real 3s MP3 fixture via ffmpeg-static ---
    const fixtureMp3 = path.join(CACHE, 'fixture-3s.mp3');
    if (!fs.existsSync(fixtureMp3)) {
      console.log('  generating 3s audio fixture via ffmpeg-static...');
      const gen = spawnSync(ffmpegPath, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', '3', '-c:a', 'libmp3lame', fixtureMp3
      ], { encoding: 'utf8' });
      assert.strictEqual(gen.status, 0, 'ffmpeg fixture generation failed: ' + gen.stderr);
    }
    const mp3Buf = fs.readFileSync(fixtureMp3);
    assert.ok(mp3Buf.length > 1000, 'fixture mp3 has content');

    // --- create episode + upload audio + chapters ---
    r = await jf('/api/shows/' + show.id + '/episodes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Episode One: The Beginning',
        notes_md: '# Show notes\n\nThis is **markdown** with a [link](https://example.com).',
        episode_no: 1,
        season_no: 1,
        type: 'full',
        explicit: false
      })
    });
    assert.strictEqual(r.status, 201);
    const ep = await r.json();
    ok('created episode metadata');

    fd = new FormData();
    fd.append('file', new Blob([mp3Buf], { type: 'audio/mpeg' }), 'episode.mp3');
    r = await fetch(`${base}/api/episodes/${ep.id}/audio`, { method: 'POST', headers: { cookie }, body: fd });
    assert.strictEqual(r.status, 200);
    const epWithAudio = await r.json();
    assert.ok(epWithAudio.audio_path, 'audio_path stored');
    assert.strictEqual(epWithAudio.audio_bytes, mp3Buf.length, 'audio_bytes matches uploaded file size exactly');
    assert.ok(Math.abs(epWithAudio.audio_duration_sec - 3) <= 1, 'probed duration ~3s, got ' + epWithAudio.audio_duration_sec);
    const storedAudioPath = path.join(dataDir, epWithAudio.audio_path.replace(/^\//, ''));
    assert.ok(fs.existsSync(storedAudioPath), 'stored audio file exists on disk');
    ok('uploaded episode audio; file stored on disk, duration probed (~3s), byte size exact');

    r = await jf(`/api/episodes/${ep.id}/chapters`, {
      method: 'PUT',
      body: JSON.stringify({ chapters: [{ start_sec: 0, title: 'Intro' }, { start_sec: 1.5, title: 'Main topic' }] })
    });
    assert.strictEqual(r.status, 200);
    const chapters = await r.json();
    assert.strictEqual(chapters.length, 2);
    ok('saved 2 chapters');

    // --- feed validation ---
    r = await fetch(`${base}/feed/smoke-test-cast.xml`);
    assert.strictEqual(r.status, 200);
    const xml = await r.text();
    assert.ok(r.headers.get('content-type').includes('application/rss+xml'), 'feed content-type is application/rss+xml');
    assert.ok(xml.includes('<rss version="2.0"'), 'RSS 2.0 root element');
    assert.ok(xml.includes('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"'), 'itunes namespace declared');

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    const channel = parsed.rss.channel;
    assert.ok(channel['itunes:category'], 'channel has itunes:category');
    assert.strictEqual(channel['itunes:category']['@_text'], 'Technology');
    assert.ok(channel['itunes:image']['@_href'], 'channel has itunes:image href');
    assert.ok(channel['itunes:owner']['itunes:email'], 'channel has itunes:owner email');

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    assert.strictEqual(items.length, 1, 'exactly one published episode in feed');
    const item = items[0];
    assert.strictEqual(item.title, 'Episode One: The Beginning');
    assert.strictEqual(item.enclosure['@_type'], 'audio/mpeg');
    assert.strictEqual(Number(item.enclosure['@_length']), mp3Buf.length, 'enclosure length matches exact byte size');
    assert.ok(item.enclosure['@_url'].startsWith('http'), 'enclosure url is absolute');
    assert.ok(item.guid, 'item has guid');
    assert.strictEqual(item.guid['@_isPermaLink'], 'false');
    assert.ok(item['itunes:duration'], 'item has itunes:duration');
    // pubDate should parse as a valid RFC-2822-ish date
    assert.ok(!isNaN(new Date(item.pubDate).getTime()), 'pubDate parses as a valid date: ' + item.pubDate);
    assert.ok(item['content:encoded'], 'content:encoded present (CDATA-wrapped HTML)');
    ok('feed is RSS 2.0 + itunes namespace with required channel/item tags, exact enclosure length, valid pubDate');

    // --- Range requests + download logging ---
    r = await fetch(`${base}/audio/${ep.id}.mp3`, { headers: { Range: 'bytes=0-99' } });
    assert.strictEqual(r.status, 206, 'range request returns 206');
    assert.strictEqual(r.headers.get('content-range'), `bytes 0-99/${mp3Buf.length}`);
    assert.strictEqual(Number(r.headers.get('content-length')), 100);
    const db = app.locals.db;
    let dlCount = db.prepare('SELECT COUNT(*) AS n FROM downloads WHERE episode_id = ?').get(ep.id).n;
    assert.strictEqual(dlCount, 1, 'one download row after first range request');
    ok('audio Range request returns 206 + correct Content-Range, logs a download row');

    // same IP, same day -> still 1 unique download
    r = await fetch(`${base}/audio/${ep.id}.mp3`, { headers: { Range: 'bytes=100-199' } });
    assert.strictEqual(r.status, 206);
    dlCount = db.prepare('SELECT COUNT(*) AS n FROM downloads WHERE episode_id = ?').get(ep.id).n;
    assert.strictEqual(dlCount, 1, 'repeat range request from same IP/day does not add a new unique download');
    ok('repeat request from same IP+day stays at 1 unique download');

    // different X-Forwarded-For -> 2 uniques
    r = await fetch(`${base}/audio/${ep.id}.mp3`, { headers: { Range: 'bytes=0-49', 'X-Forwarded-For': '203.0.113.42' } });
    assert.strictEqual(r.status, 206);
    dlCount = db.prepare('SELECT COUNT(*) AS n FROM downloads WHERE episode_id = ?').get(ep.id).n;
    assert.strictEqual(dlCount, 2, 'different X-Forwarded-For IP counts as a second unique download');
    ok('different client IP (via X-Forwarded-For) is counted as a second unique download');

    // --- scheduled episode hidden from feed + public page ---
    r = await jf('/api/shows/' + show.id + '/episodes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Future Episode',
        notes_md: 'Not out yet.',
        episode_no: 2,
        published_at: new Date(Date.now() + 86400000).toISOString()
      })
    });
    const futureEp = await r.json();
    fd = new FormData();
    fd.append('file', new Blob([mp3Buf], { type: 'audio/mpeg' }), 'future.mp3');
    await fetch(`${base}/api/episodes/${futureEp.id}/audio`, { method: 'POST', headers: { cookie }, body: fd });

    r = await fetch(`${base}/feed/smoke-test-cast.xml`);
    const xml2 = await r.text();
    assert.ok(!xml2.includes('Future Episode'), 'scheduled episode absent from feed');

    r = await fetch(`${base}/p/smoke-test-cast`);
    const html = await r.text();
    assert.strictEqual(r.status, 200);
    assert.ok(html.includes('Episode One: The Beginning'), 'published episode listed on public show page');
    assert.ok(!html.includes('Future Episode'), 'scheduled episode absent from public show page');
    ok('scheduled (future-dated) episode is hidden from both the feed and the public show page');

    // --- embed page ---
    r = await fetch(`${base}/embed/${ep.id}`);
    assert.strictEqual(r.status, 200);
    const embedHtml = await r.text();
    assert.ok(embedHtml.includes('<audio'), 'embed page contains an <audio> element');
    ok('embed page returns 200 and contains an <audio> element');

    // --- episode page + chapters json ---
    r = await fetch(`${base}/p/smoke-test-cast/${ep.slug}`);
    assert.strictEqual(r.status, 200);
    const epHtml = await r.text();
    assert.ok(epHtml.includes('Intro') && epHtml.includes('Main topic'), 'chapters rendered on episode page');
    ok('episode page renders chapters');

    r = await fetch(`${base}/chapters/${ep.id}.json`);
    assert.strictEqual(r.status, 200);
    const chaptersJson = await r.json();
    assert.strictEqual(chaptersJson.chapters.length, 2);
    assert.strictEqual(chaptersJson.chapters[0].title, 'Intro');
    ok('podcast:chapters JSON endpoint serves the chapter list');

    console.log(`\nAll ${passed} smoke checks passed.`);
    process.exitCode = 0;
  } catch (e) {
    console.error('\nSMOKE TEST FAILED:', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    server.close();
    try {
      app.locals.db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  }
})();
