const { renderMarkdown } = require('./markdown');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout({ title, description, image, url, body, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta property="og:type" content="website">
${url ? `<meta property="og:url" content="${esc(url)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${extraHead}
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f7fb; color: #1a1a1f; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }
  header.show { display: flex; gap: 20px; align-items: center; margin-bottom: 28px; }
  header.show img { width: 120px; height: 120px; border-radius: 16px; object-fit: cover; box-shadow: 0 6px 24px rgba(0,0,0,.12); }
  h1 { font-size: 1.7rem; margin: 0 0 6px; }
  .byline { color: #6b6b76; font-size: .9rem; margin: 0; }
  .subscribe { display: flex; gap: 10px; margin: 18px 0 28px; flex-wrap: wrap; }
  .subscribe a, .subscribe button { font-size: .85rem; padding: 8px 14px; border-radius: 999px; border: 1px solid #d8d8e0; background: #fff; color: #333; text-decoration: none; cursor: pointer; }
  .subscribe a:hover, .subscribe button:hover { background: #f0f0f6; }
  ul.episodes { list-style: none; padding: 0; margin: 0; }
  ul.episodes li { padding: 16px 0; border-bottom: 1px solid #e6e6ee; }
  ul.episodes a.title { font-weight: 600; color: #1a1a1f; text-decoration: none; font-size: 1.05rem; }
  ul.episodes a.title:hover { text-decoration: underline; }
  .meta { color: #8a8a94; font-size: .8rem; margin-top: 4px; }
  audio { width: 100%; margin: 14px 0; }
  .notes { line-height: 1.6; }
  .notes h1, .notes h2, .notes h3 { margin-top: 1.4em; }
  .chapters { margin: 24px 0; padding: 0; list-style: none; }
  .chapters li { padding: 6px 0; border-bottom: 1px dashed #e2e2ea; font-size: .9rem; }
  .chapters .t { color: #8a8a94; font-variant-numeric: tabular-nums; margin-right: 10px; }
  .back { display: inline-block; margin-bottom: 18px; color: #6b6b76; text-decoration: none; font-size: .85rem; }
  footer.credit { text-align: center; color: #b0b0ba; font-size: .75rem; margin-top: 48px; }
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
</body>
</html>`;
}

function fmtSec(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// published_at is stored as 'YYYY-MM-DD HH:MM:SS' UTC — normalize before parsing.
function parseUtc(s) {
  return new Date(String(s).includes(' ') ? s.replace(' ', 'T') + 'Z' : s);
}

function subscribeButtons(feedUrl) {
  const apple = `https://podcasts.apple.com/podcast/id?url=${encodeURIComponent(feedUrl)}`;
  const spotify = `https://open.spotify.com/search/${encodeURIComponent(feedUrl)}`;
  return `<div class="subscribe">
    <a href="${apple}" target="_blank" rel="noopener">🍎 Apple Podcasts</a>
    <a href="${spotify}" target="_blank" rel="noopener">🟢 Spotify</a>
    <a href="${feedUrl}" target="_blank" rel="noopener">📡 RSS</a>
  </div>`;
}

function renderShowPage({ show, episodes, baseUrl }) {
  const feedUrl = `${baseUrl}/feed/${show.slug}.xml`;
  const image = show.artwork_path ? `${baseUrl}${show.artwork_path}` : '';
  const items = episodes
    .map(
      (ep) => `<li>
        <a class="title" href="/p/${show.slug}/${ep.slug}">${esc(ep.title)}</a>
        <div class="meta">${parseUtc(ep.published_at).toDateString()} · ${fmtSec(ep.audio_duration_sec)}${ep.type !== 'full' ? ' · ' + ep.type : ''}</div>
      </li>`
    )
    .join('\n');

  const body = `
    <header class="show">
      ${image ? `<img src="${image}" alt="${esc(show.title)} artwork">` : ''}
      <div>
        <h1>${esc(show.title)}</h1>
        <p class="byline">by ${esc(show.author)}</p>
      </div>
    </header>
    <p>${esc(show.description)}</p>
    ${subscribeButtons(feedUrl)}
    <ul class="episodes">${items || '<li>No episodes published yet.</li>'}</ul>
    <footer class="credit">Powered by Castport — self-hosted podcast hosting</footer>
  `;

  return layout({
    title: show.title,
    description: show.description,
    image,
    url: `${baseUrl}/p/${show.slug}`,
    body
  });
}

async function renderEpisodePage({ show, ep, chapters, baseUrl }) {
  const image = ep.artwork_path ? `${baseUrl}${ep.artwork_path}` : show.artwork_path ? `${baseUrl}${show.artwork_path}` : '';
  const audioUrl = `${baseUrl}/audio/${ep.id}.mp3`;
  const chaptersHtml = chapters.length
    ? `<ul class="chapters">${chapters.map((c) => `<li><span class="t">${fmtSec(c.start_sec)}</span>${esc(c.title)}</li>`).join('')}</ul>`
    : '';
  const notesHtml = await renderMarkdown(ep.notes_md);

  const body = `
    <a class="back" href="/p/${show.slug}">&larr; ${esc(show.title)}</a>
    <h1>${esc(ep.title)}</h1>
    <p class="byline">${parseUtc(ep.published_at).toDateString()} · ${fmtSec(ep.audio_duration_sec)}</p>
    <audio controls preload="none" src="${audioUrl}"></audio>
    ${chaptersHtml}
    <div class="notes">${notesHtml}</div>
    <footer class="credit">Powered by Castport — self-hosted podcast hosting</footer>
  `;

  return layout({
    title: `${ep.title} — ${show.title}`,
    description: show.description,
    image,
    url: `${baseUrl}/p/${show.slug}/${ep.slug}`,
    body
  });
}

function renderEmbedPage({ show, ep, baseUrl }) {
  const audioUrl = `${baseUrl}/audio/${ep.id}.mp3`;
  const image = ep.artwork_path ? `${baseUrl}${ep.artwork_path}` : show.artwork_path ? `${baseUrl}${show.artwork_path}` : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(ep.title)}</title>
<style>
  body { margin: 0; font-family: -apple-system, sans-serif; background: #12121a; color: #fff; }
  .player { display: flex; align-items: center; gap: 14px; padding: 14px; }
  img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .info { flex: 1; min-width: 0; }
  .info .t { font-weight: 600; font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  audio { width: 100%; margin-top: 6px; }
</style></head>
<body>
<div class="player">
  ${image ? `<img src="${image}" alt="">` : ''}
  <div class="info">
    <div class="t">${esc(ep.title)}</div>
    <audio controls preload="none" src="${audioUrl}"></audio>
  </div>
</div>
</body></html>`;
}

module.exports = { renderShowPage, renderEpisodePage, renderEmbedPage };
