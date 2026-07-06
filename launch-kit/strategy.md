## Positioning

Self-hosted podcast hosting for indie podcasters and small networks who are tired of paying monthly for what's fundamentally file storage + an XML feed. Price anchor: Transistor $19–$99/mo ($228–$1,188/yr) vs Castport's $39 one-time.

## Target communities (rules-aware angles)

| Community | Angle |
|---|---|
| r/podcasting | Post as "I built a self-hosted alternative to Transistor/Buzzsprout" — this sub explicitly allows self-promo in a dedicated thread structure; lead with the RSS-validation technical detail (byte-exact enclosure length, permanent GUIDs) since this audience knows exactly what breaks feeds. Avoid hard-selling; frame as "here's what I learned building podcast RSS." |
| r/selfhosted | Frame purely as a self-hosted app — Docker one-liner, SQLite, no external dependencies. This sub cares about data ownership and will ask about backup/restore; have the "one SQLite file + two folders" answer ready. |
| r/audiodrama | Fiction podcasters often run tiny shows on expensive hosting tiers because Buzzsprout/Transistor's free tiers cap episode count. Angle: unlimited episodes for serialized fiction at a flat one-time cost. Check sub rules for self-promo cadence (usually 1:9 ratio with other participation) before posting. |
| r/podcastsformarketing / r/DigitalMarketing | Pitch to marketers running branded podcasts who want feed data staying in-house rather than on a third-party dashboard. |
| Indie Hackers | Post as a build-in-public "shipped a $39 alternative to a $19/mo SaaS" story — this community responds well to transparent revenue/pricing reasoning. |
| Hacker News | See Show HN draft below. |
| Product Hunt | Standard launch — see product-hunt.md. |

## Hacker News — Show HN draft

**Title:** Show HN: Castport – self-hosted podcast host with an Apple/Spotify-valid RSS feed

**Body:**
I got tired of paying $19/mo for podcast hosting that's, under the hood, a file server plus an RSS feed. So I built Castport — self-hosted, Node + Express + SQLite, single process, one-time $39.

The interesting part was getting the RSS feed actually valid for Apple Podcasts and Spotify. A lot of "just generate an RSS feed" tutorials skip the parts that get you rejected: enclosure `length` has to be the exact byte count of the file (not an estimate), GUIDs need to be permanent (`isPermaLink="false"` + a UUID, not the URL), `itunes:duration` needs real probed audio duration (I use `music-metadata`), and Range requests on the audio endpoint are mandatory — a lot of naive `res.sendFile` implementations silently don't support them, and Apple's crawler notices.

Design decisions: single SQLite file with WAL mode (no separate Postgres to run), sessions are an in-memory Set (single-admin tool, didn't want to add Redis for this), audio is streamed straight to disk via multer's diskStorage rather than buffered in memory (needed for 200MB+ files), and download IPs are hashed with a rotating daily salt rather than stored raw.

It ships two ways: `npm run desktop` for an Electron wrapper if you just want to run it locally, or a Dockerfile + compose file for a $5 VPS deploy.

Source is MIT on GitHub. Happy to talk through the RSS validation details or the Range-request implementation if anyone's curious — that part had more edge cases than I expected.

## SEO keywords (10)

1. self-hosted podcast hosting
2. podcast RSS feed generator
3. Transistor alternative
4. Buzzsprout alternative
5. one-time payment podcast host
6. Apple Podcasts RSS validator
7. podcast hosting no subscription
8. self hosted podcast platform
9. podcast download analytics self hosted
10. open source podcast hosting

## AppSumo / PitchGround pitch

Castport is a self-hosted podcast host for indie podcasters, agencies, and networks who want out of the monthly-hosting treadmill. Upload an episode, get a feed that's already valid for Apple Podcasts and Spotify (byte-exact enclosures, permanent GUIDs, probed durations, Podcasting 2.0 chapters), plus public show/episode pages, an embeddable player, and privacy-safe download stats — all running on infrastructure the buyer controls. It replaces $19–$99/mo hosting tools with a single $39 one-time license (source-available, MIT), deployable via Docker to any $5 VPS or run natively as a desktop app. Ideal AppSumo audience: podcast networks managing multiple shows who feel the per-show/per-download pricing of incumbent hosts, and privacy-conscious creators who don't want listener IPs sitting on a third party's servers.

## Pricing

**$39 one-time** vs Transistor's $19/mo (Starter, 1 show) or $49/mo (Growth, unlimited shows) — pays for itself in **2.1 months** against Starter, or **0.8 months** against Growth. Over 3 years: Castport $39 total vs Transistor Starter $684 or Growth $1,764 — a **17x-45x** savings. Future paid tier idea: a hosted-for-you option at $9/mo for people who want zero server management, positioned above the one-time self-hosted license.
