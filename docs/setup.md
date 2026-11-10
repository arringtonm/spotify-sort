# Setup, scripts and deploying

[← README](../README.md)

## Quick start

```sh
npm install
cp .env.example .env      # add your Spotify client ID
npm run dev               # http://127.0.0.1:5173
```

| Script | Does |
|---|---|
| `npm run desktop` | Mac app in development (Tauri; needs Rust: `brew install rustup`) |
| `npm run desktop:build` | → `src-tauri/target/release/bundle/macos/Spotify Sort.app` |
| `npm run dev` | Dev server, bound to `127.0.0.1` |
| `npm run build` | → `dist/` |
| `npm run preview` | Serve the build |
| `npm test` | 140 tests, `node:test`, no framework |
| `npx pwa-assets-generator` | Regenerate icons from `public/logo.svg` |
| `npm run lint` / `lint:fix` | ESLint flat config |
| `node scripts/validate-analyzer.mjs [n]` | Re-measure analyser accuracy |

Requires Node `^20.19.0 || >=22.12.0`.

The dev server binds to `127.0.0.1` rather than `localhost` on purpose. Spotify stopped accepting
`localhost` redirect URIs on 27 Nov 2025, so the dev origin must match the registered URI.

## Connecting Spotify (optional)

Links, DJ files and audio files work without it. To import Liked Songs and your own
playlists:

1. Create an app at <https://developer.spotify.com/dashboard> (Web API).
2. Add the redirect URI `http://127.0.0.1:5173/callback` exactly.
3. Under **User Management**, add the Spotify account(s) that will sign in (up to 5). The app
   owner's account must have Premium.
4. Put the client ID in `.env` as `VITE_SPOTIFY_CLIENT_ID` and restart `npm run dev`.
   No client secret is needed (or wanted), because sign-in uses Authorization Code + PKCE.

If Spotify shows *INVALID_CLIENT: Invalid redirect URI*, the URI from step 2 doesn't match. If it
says the user isn't registered, step 3 is missing.

The Mac app opens sign-in in its own window and catches the redirect to the same URI, so nothing
extra needs registering.

## Spotify API constraints

| Constraint | Effect |
|---|---|
| Extended Quota Mode needs a registered company + 250k MAU | A public app is not possible |
| Development mode allows **5** authenticated users | Cut from 25 in Feb 2026 |
| App owner must hold **Premium** | If it lapses, the app stops working |
| Implicit Grant removed 27 Nov 2025 | Authorization Code + PKCE only |
| `localhost` redirect URIs rejected | Use `http://127.0.0.1:PORT` |
| Refresh tokens expire after 6 months | `400 invalid_grant` prompts re-auth |
| Playlist `items` only for playlists you own | Other playlists go through the embed proxy (unofficial) |
| `popularity` removed from dev-mode track objects | Column omitted |
| `audio-features`, `recommendations`, `related-artists` closed to new apps | Tempo, key and energy are measured locally; discovery uses Deezer |

None of these limits apply to DJ-software and Serato imports.

## Deploying the web build

The service worker needs a fixed base path. The app builds for `/` by default. For a subpath
(e.g. GitHub Pages), build with `BASE_PATH=/spotify-sort/ npm run build`. Serve `index.html` for
unknown routes (SPA fallback). To import Spotify links you don't own in production, deploy
`proxy/` and set `VITE_EMBED_PROXY_URL`.

On iPhone and iPad, an installed web app can lose a Spotify sign-in mid-redirect. To survive
this, the PKCE verifier is stored in localStorage under the `state` value. If sign-in still
fails, sign in once in Safari, then reopen the app.
