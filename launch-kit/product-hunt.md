# Product Hunt Launch — Castport

## Name
Castport

## Tagline (60 chars)
Own your podcast feed — hosting you pay for once

## Description (260 chars)
Self-hosted podcast host: upload episodes, get an Apple/Spotify-valid RSS feed, public show pages, an embeddable player, and download stats. Pay $39 once instead of Transistor's $19/mo. Your audio files, your database, your domain, forever.

## Full description

Castport is a self-hosted podcast host you run yourself — on a $5 VPS or right on your desktop.

**What you get:**
- Unlimited shows, unlimited episodes, unlimited downloads
- A real Apple/Spotify-valid RSS feed (RSS 2.0 + full itunes namespace, exact enclosure byte lengths, permanent GUIDs — the stuff that actually gets rejected if you get it wrong)
- Clean public show and episode pages with subscribe buttons
- An embeddable `<iframe>` player for your blog or newsletter
- A markdown editor for show notes, with a chapters editor that emits Podcasting 2.0 `podcast:chapters`
- Download stats — unique downloads per episode per day, IPs hashed with a rotating daily salt so nothing personal is ever stored
- Scheduled episodes — set a future publish date, no cron job needed

Two ways to run it: as a native desktop app (double-click, done), or deployed via Docker to your own VPS when you want it public on your own domain.

MIT-licensed source is free forever on GitHub. The $39 one-time price on Whop just buys you the packaged installer and skips the terminal.

## Maker first comment

Hey PH 👋

I built this because I got tired of paying $19/month for Transistor just to host a podcast that gets maybe 400 downloads a month. That's $228/year for what is, under the hood, an RSS feed and a folder of MP3 files.

So I built Castport: upload your episode, it validates against Apple's actual RSS requirements (byte-exact enclosure length, real itunes:duration, permanent GUIDs — the stuff that silently breaks feeds), and you get a feed URL you can paste straight into Apple Podcasts Connect and Spotify for Podcasters.

It's not going to replace a network-scale hosting platform with dynamic ad insertion and a dedicated CDN. If you're pulling 100k downloads/episode you probably want that. But for the other 99% of podcasters paying monthly for something that's fundamentally "store a file, serve an XML doc" — this is $39, once, and you own it.

Happy to answer anything — architecture, RSS gotchas, whatever.

## Gallery shots (5)

1. **Shows list** — grid of show cards with artwork thumbnails and a "New show" button, dark admin theme.
2. **Episode editor** — audio dropzone mid-upload with a progress bar, markdown notes editor with live preview toggle, chapters table below.
3. **Public show page** — light-theme podcast homepage with artwork, description, Apple/Spotify/RSS subscribe buttons, and an episode list.
4. **Stats dashboard** — 30-day downloads bar chart plus a per-episode downloads table, violet accent on dark background.
5. **RSS feed source view** — a browser tab showing the raw validated XML feed with itunes namespace tags visible, proving the "Apple/Spotify-valid" claim.
