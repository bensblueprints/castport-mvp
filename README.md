# 🎙️ Castport

## Demo

VIDEO-PLACEHOLDER

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Host your own podcast. Pay once. Own it forever. No subscription.**

A self-hosted podcast host — upload episodes, get an Apple/Spotify-valid RSS feed, clean public show/episode pages, an embeddable player, and download stats. Everything Transistor charges $19/month ($228/year) for, running on your own $5 VPS (or your desktop), with your audio files **never held hostage**.

![Screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged installer (Windows desktop app + guided VPS deploy) here:

**→ [https://whop.com/onetime-suite](https://whop.com/onetime-suite)** — one-time purchase, lifetime updates.

## Features

- **Unlimited shows, unlimited episodes** — each show has its own title, description, author, owner email, artwork, iTunes category/subcategory, language, explicit flag, site link, and custom feed slug
- **Apple/Spotify-valid RSS** at `/feed/:showSlug.xml` — RSS 2.0 + full `itunes:*` namespace, `content:encoded` (CDATA-wrapped HTML rendered from your markdown notes), exact enclosure byte length, permanent GUIDs, valid RFC-2822 `pubDate`
- **Episode uploads** — MP3 or M4A, streamed straight to disk (no buffering giant files in memory), markdown show notes with live preview, episode/season numbers, type (full/trailer/bonus), explicit flag, optional per-episode artwork, and a **chapters editor** (start time + title) that also emits a Podcasting-2.0 `podcast:chapters` JSON endpoint
- **Scheduling** — set a future publish date and the episode stays hidden from the feed and public pages until then, no cron job needed
- **Clean public pages** — show homepage with subscribe buttons (Apple/Spotify/RSS), episode page with player + notes + chapters, proper OG/meta tags — no auth required, no framework payload
- **Embeddable player** — `/embed/:episodeId` iframe page with a copyable `<iframe>` snippet
- **Download stats** — unique downloads per episode per day, dashboard chart (30-day trend + per-episode totals). IPs are **hashed with a rotating daily salt** — nothing personal is ever stored
- **Real HTTP Range support** on audio delivery — required by Apple Podcasts and virtually every podcast app
- **100% local & private** — one SQLite file + an audio/artwork folder, no telemetry, no external services

## Quick start

```bash
npm i
npm run build   # builds the admin UI
npm start       # → http://localhost:5329
```

- **Admin panel:** `http://localhost:5329/admin` (default password `admin` — change via `ADMIN_PASSWORD`)
- **Public show page:** `http://localhost:5329/p/:showSlug`
- **RSS feed:** `http://localhost:5329/feed/:showSlug.xml`

> **Before submitting your feed to Apple Podcasts or Spotify:** set `BASE_URL` in `.env` to your real `https://` domain. Feeds pointing at `localhost` will be rejected.

### Desktop mode

Run it as a desktop app, or deploy to a $5 VPS when you need it public:

```bash
npm run desktop   # Electron window, auto-logged-in, data stored per-user
```

`npm run dist` packages a Windows installer (NSIS) via electron-builder.

### Docker (VPS deploy)

```bash
cp .env.example .env   # set ADMIN_PASSWORD and BASE_URL!
docker compose up -d   # persists SQLite + audio + artwork in a named volume
```

Point your domain at the box, put Caddy/nginx/Traefik in front for TLS, submit `https://yourdomain.com/feed/your-show.xml` to Apple Podcasts Connect and Spotify for Podcasters. Done.

## Castport vs Transistor

| | **Castport (this)** | Transistor |
|---|---|---|
| Price | **$39 once** | $19–$99/mo, forever |
| Shows | **Unlimited** | 1–unlimited depending on tier |
| Episodes | **Unlimited** | Unlimited on paid tiers |
| Downloads | **Unlimited** | Metered on lower tiers |
| Your own domain | ✅ Yes, natively | Paid plan only |
| Audio files | **Always yours, on your disk** | Hosted on their infra |
| Download analytics | ✅ Yours, in your SQLite | Theirs, on their servers |
| Podcasting 2.0 chapters | ✅ Built in | Limited |
| Cost over 3 years | **$39** | $684–$3,564 |

## Tech stack

- **Server:** Node 20+, Express, better-sqlite3 (WAL) — single process serves API + admin + RSS + public pages + audio
- **RSS:** `fast-xml-parser` (RSS 2.0 + itunes + podcast namespaces), `marked` (markdown → `content:encoded` HTML)
- **Audio:** hand-rolled HTTP Range handling, `music-metadata` for duration probing, `multer` disk streaming for uploads
- **Admin UI:** React 18, Vite, Tailwind CSS 4, Framer Motion, Lucide icons
- **Public pages:** server-rendered plain HTML/CSS — instant load, zero external requests
- **Desktop:** thin Electron wrapper reusing the exact same server on a free local port
- **Storage:** one SQLite file + an audio folder + an artwork folder. Back up = copy three things.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `5329` | Server port |
| `ADMIN_PASSWORD` | `admin` | Admin panel password |
| `DATA_DIR` | `./data` | SQLite db + audio + artwork |
| `BASE_URL` | `http://localhost:5329` | Absolute base URL used in the RSS feed — **set this to your real domain before submitting to Apple/Spotify** |

## Development

```bash
npm start        # API + public site + feed on :5329
npm run dev      # Vite dev server for the admin UI on :5330 (proxies /api, /audio, /artwork)
npm test         # end-to-end smoke test against a throwaway db + real generated MP3/PNG fixtures
```

## License

MIT © 2026 Ben ([bensblueprints](https://github.com/bensblueprints))
