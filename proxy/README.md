# Spotify embed proxy

A ~70-line Cloudflare Worker that lets Spotify Sort import Spotify playlists the
signed-in user doesn't own (and lets signed-out users import Spotify links).

Spotify's Web API only returns playlist tracks for playlists you own or
collaborate on in development mode. The public embed page
(`open.spotify.com/embed/playlist/<id>`) lists the tracks of any public playlist,
but sends no CORS headers, so the browser can't read it directly. This Worker
fetches the page, extracts the track list with the same code the app uses
(`src/lib/spotifyEmbed.js`), and returns JSON.

**This is unofficial.** It reads a page Spotify does not document as an API, it
may break without notice, long playlists may be cut short, and it may not sit
well with Spotify's terms of use. The app labels results from it as unofficial.

## Local development

Nothing to deploy: `npm run dev` proxies `/spotify-embed/*` through Vite
(`vite.config.js`).

## Deploy

```sh
cd proxy
npx wrangler deploy
```

Then set `ALLOWED_ORIGINS` in `wrangler.toml` (or the dashboard) to your app's
origin, and build the app with:

```sh
VITE_EMBED_PROXY_URL=https://spotify-sort-embed-proxy.<you>.workers.dev/spotify-embed npm run build
```

Without `VITE_EMBED_PROXY_URL`, production builds hide this route and explain
the ownership limit instead.

## Limits

- Accepts only `GET /spotify-embed/{playlist|album|track}/{22-char id}`.
- Requests from origins not in `ALLOWED_ORIGINS` are refused.
- Responses are cached for an hour.
