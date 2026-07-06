const { XMLBuilder } = require('fast-xml-parser');
const { renderMarkdown } = require('./markdown');

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  format: true,
  suppressEmptyNode: true
});

function absUrl(baseUrl, p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return baseUrl.replace(/\/$/, '') + (p.startsWith('/') ? p : `/${p}`);
}

function rfc2822(dateStr) {
  const d = dateStr ? new Date(dateStr.includes(' ') ? dateStr.replace(' ', 'T') + 'Z' : dateStr) : new Date();
  return d.toUTCString();
}

function itunesDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/**
 * Build an Apple/Spotify-valid RSS 2.0 + itunes namespace feed for a show.
 * `episodes` must already be filtered to published (published_at <= now).
 */
async function buildFeedXml({ show, episodes, baseUrl }) {
  const showImage = absUrl(baseUrl, show.artwork_path || '/docs/default-artwork.png');
  const showLink = show.link ? show.link : absUrl(baseUrl, `/p/${show.slug}`);
  const feedSelf = absUrl(baseUrl, `/feed/${show.slug}.xml`);

  const channel = {
    title: show.title,
    description: { __cdata: show.description || '' },
    link: showLink,
    language: show.language || 'en',
    'itunes:author': show.author || '',
    'itunes:explicit': show.explicit ? 'true' : 'false',
    'itunes:image': { '@_href': showImage },
    image: {
      url: showImage,
      title: show.title,
      link: showLink
    },
    'itunes:owner': {
      'itunes:name': show.author || '',
      'itunes:email': show.owner_email || ''
    },
    'itunes:category': show.subcategory
      ? { '@_text': show.category, 'itunes:category': { '@_text': show.subcategory } }
      : { '@_text': show.category },
    'atom:link': { '@_href': feedSelf, '@_rel': 'self', '@_type': 'application/rss+xml' },
    generator: 'Castport (github.com/bensblueprints/podcast-host)',
    item: await Promise.all(episodes.map((ep) => buildItem({ ep, show, baseUrl })))
  };

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    rss: {
      '@_version': '2.0',
      '@_xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      '@_xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
      '@_xmlns:atom': 'http://www.w3.org/2005/Atom',
      '@_xmlns:podcast': 'https://podcastindex.org/namespace/1.0',
      channel
    }
  };

  return builder.build(doc);
}

async function buildItem({ ep, show, baseUrl }) {
  const enclosureUrl = absUrl(baseUrl, `/audio/${ep.id}.mp3`);
  const chaptersUrl = absUrl(baseUrl, `/chapters/${ep.id}.json`);
  const html = await renderMarkdown(ep.notes_md);

  const item = {
    title: ep.title,
    description: { __cdata: html },
    'content:encoded': { __cdata: html },
    link: absUrl(baseUrl, `/p/${show.slug}/${ep.slug}`),
    guid: { '#text': ep.id, '@_isPermaLink': 'false' },
    pubDate: rfc2822(ep.published_at),
    enclosure: {
      '@_url': enclosureUrl,
      '@_length': String(ep.audio_bytes || 0),
      '@_type': ep.mime || 'audio/mpeg'
    },
    'itunes:duration': itunesDuration(ep.audio_duration_sec),
    'itunes:explicit': ep.explicit ? 'true' : 'false',
    'itunes:episodeType': ep.type || 'full',
    'podcast:chapters': { '@_url': chaptersUrl, '@_type': 'application/json+chapters' }
  };

  if (ep.episode_no) item['itunes:episode'] = ep.episode_no;
  if (ep.season_no) item['itunes:season'] = ep.season_no;
  if (ep.artwork_path) item['itunes:image'] = { '@_href': absUrl(baseUrl, ep.artwork_path) };

  return item;
}

module.exports = { buildFeedXml, rfc2822, itunesDuration, absUrl };
