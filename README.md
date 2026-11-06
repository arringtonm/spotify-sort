# Spotify Sort

A DJ tool for harmonic mixing: load a library, filter it by tempo and key, audition tracks,
and build sets where every track mixes into the next.

Vue 3.5 · Reka UI · Tailwind 4 · Vite 8 · Pinia · Vue Router · vite-plugin-pwa · ESLint 10 · `node:test`

Installable as an app (PWA), works offline for your stored library, dark by default.

## Quick start

```sh
npm install
cp .env.example .env      # add your Spotify client ID
npm run dev               # http://127.0.0.1:5173
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server, binds `127.0.0.1` |
| `npm run build` | → `dist/` |
| `npm run preview` | Serve the build |
| `npm test` | 96 tests, `node:test`, no framework |
| `npx pwa-assets-generator` | Regenerate icons from `public/logo.svg` |
| `npm run lint` / `lint:fix` | ESLint flat config |
| `node scripts/validate-analyzer.mjs [n]` | Re-measure analyser accuracy |

Requires Node `^20.19.0 || >=22.12.0`.

The dev server binds `127.0.0.1`, not `localhost`, deliberately — Spotify stopped accepting
`localhost` redirect URIs on 27 Nov 2025, so the dev origin must match what is registered.

### Connecting Spotify (optional)

Links, DJ files and audio files work without it. To import Liked Songs and your own
playlists:

1. Create an app at <https://developer.spotify.com/dashboard> (Web API).
2. Add the redirect URI `http://127.0.0.1:5173/callback` exactly.
3. Under **User Management**, add the Spotify account(s) that will sign in (max 5). The app
   owner's account must have Premium.
4. Put the client ID in `.env` as `VITE_SPOTIFY_CLIENT_ID` and restart `npm run dev`.
   No client secret is needed (or wanted) — sign-in is Authorization Code + PKCE in the
   browser.

If Spotify shows *INVALID_CLIENT: Invalid redirect URI*, step 2 doesn't match; if it says
the user isn't registered, step 3 is missing.

## Where your library can come from

**1. DJ software — the best source, and no login needed.**
Rekordbox (`.xml`), Traktor (`.nml`), or CSV (which is how Serato and Mixed In Key export;
Exportify CSVs work too).
These tools analysed the whole file offline, so their BPM and key beat anything derivable
from a 30-second preview. Imported values are trusted outright and skip analysis entirely.

**2. A link — Spotify or Deezer playlists, albums and tracks.**
Paste a share link into the Library sheet, paste it anywhere in the app, or (installed on
Android) *Share* it from the Spotify or Deezer app straight into Spotify Sort.

- **Deezer links** need no sign-in and arrive with Deezer IDs and ISRCs.
- **Spotify albums and tracks**, and **playlists you own or collaborate on**, come through
  the Web API.
- **Other Spotify playlists** (someone else's, Spotify's editorial lists, or any Spotify link
  while signed out) are read from Spotify's public embed page via a small proxy — the Vite
  dev server locally, a Cloudflare Worker in production (`proxy/`, see its README). This is
  **unofficial**: it can break without notice, and the UI says so.
- **The embed page stops at 100 tracks.** That's Spotify's page, not this app, and it has
  no paging. For longer playlists you don't own: open the playlist in the Spotify desktop
  app, select all tracks (⌘A / Ctrl+A), copy (⌘C), and paste into Spotify Sort. Every track
  link is imported; signed in, each is looked up individually (Spotify removed the batch
  endpoint), so a few hundred tracks take a minute or two. Playlists you own have no limit.

Imports run as a visible step-by-step job — *Read → Save → Find previews → Analyse* — with
progress per step. The sheet can be closed at any point (the job keeps going, with progress
in the header) and closes itself when the import finishes.

**3. Spotify — Liked Songs or your playlists.** Full length, no 100-track cap. Capped at 5
allowlisted accounts by Spotify's development mode; see *Connecting Spotify* above.

**4. Audio files on your device.** Drop MP3/AAC/WAV/AIFF/FLAC files to analyse whole tracks
locally: far better key estimates than a 30s preview, plus a full-length waveform. Nothing
is uploaded or stored except the results.

**5. The bundled 1,065-track sample**, shown until you import something.

## Why the analysis pipeline exists

Every tempo and key here originally came from Spotify's `/v1/audio-features`. Spotify
[restricted that endpoint on 27 Nov 2024](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api),
along with `audio-analysis`, `recommendations`, `related-artists` and `preview_url`. Only
apps holding extended quota access before that date kept it, and this project had never
registered a client ID. No free API returns musical key at all.

So the app computes it:

```
Spotify ──► ISRC ──► Deezer ──► 30s preview ──► decodeAudioData ──► worker pool ──► Essentia
(library)           (match)     (mp3)          (main thread)      (transfer)     (BPM + key)
```

Measured, not assumed:

| Stage | Result |
|---|---|
| Deezer catalogue match | **93%** (84% strict, +9% via fuzzy fallback) |
| Deezer's own `bpm` | ~30% populated; accurate where present (0.13 median error) |
| Deezer key | Does not exist |
| Analyser tempo | **91–95% usable** |
| Analyser key | **22% exact** — see confidence below |

**Tempo is trustworthy. Key is not**, and the UI says so rather than pretending otherwise.
What rescues key is that Essentia's `strength` predicts correctness:

| `keyStrength` | n | key correct | mode correct |
|---|---|---|---|
| 0.70–0.80 | 13 | 23% | 54% |
| 0.80–0.90 | 64 | 34% | 61% |
| **≥ 0.90** | **25** | **64%** | **88%** |

Keys at or above `0.90` show `~`. Below it the key pill renders dashed and dimmed, with its
calibrated chance of being exactly right printed *beside* the pill (`12B` `34%`) — the pill
is the key, the number is how far to trust it. A `?` means no strength was stored. Every track with a tempo and a key can start a mix; uncertain
keys are still suggested, but ranked behind confident ones (a key-risk penalty added to the
tempo distance, `keyRisk` in `src/lib/trackInfo.js`), and the mix card says how sure the
starting key is. `KEY_CONFIDENCE_THRESHOLD` lives in `src/lib/analyzeAudio.js`.

**And you can always overrule it.** “Correct tempo or key” in any row's menu sets them by hand.
Manual corrections outrank Spotify, Deezer and the analyser, persist in IndexedDB, and
survive re-imports and analyser upgrades.

### Implementation notes

- **Deezer has no CORS.** `api.deezer.com` sends every CORS header except
  `Access-Control-Allow-Origin`, so browser `fetch` is blocked. JSONP still works.
- **Search runs twice.** Deezer's `artist:"x" track:"y"` syntax needs an exact title, so
  anything with a version suffix silently misses. A fuzzy second pass recovers ~9%.
- **Web Audio is main-thread only.** Decoding happens on the main thread; PCM transfers
  zero-copy to a pool of workers sized to the machine.
- **Cache entries are versioned.** Each carries the `ANALYZER_VERSION` that produced it;
  bumping it transparently recomputes rather than serving stale numbers forever.
- **Preview URLs are signed and short-lived**, so they are fetched at press time.
- **The list is virtualised against the window.** Only visible rows render, and the page
  has a single scroll context (no table-in-a-box), which matters on touch screens.
- **Filtering is live.** The BPM slider updates results once per animation frame while
  dragging; filtering is a single pass, so this stays smooth on large libraries.
- **Analysis results are merged through an index and flushed in batches.** Per-track
  `findIndex` made the merge O(n^2) (~850ms of pure lookup on a 20k import), and assigning
  into the array per track repainted the table hundreds of times per import.
- **Storage is local-first, per track.** The library lives in IndexedDB as individual
  records, not one blob — so a single analysis result is a single small write, and a reload
  restores everything (tracks, artwork, genres, ISRC, analysis) rather than falling back to
  the bundled sample. Anything written is stripped of Vue reactivity first; structured clone
  throws `DataCloneError` on a Proxy.
- **Re-importing never redoes work.** Imports *merge*: fresh metadata wins, but tempo, key
  and analysis state are preserved, so only genuinely new tracks enter the queue. Genres are
  only fetched for artists not already known.
- **Analysis is a resumable queue.** Every track carries its own state — `pending`, `done`,
  `failed`, `unavailable` — indexed so "what is left?" is a cursor, not a scan. Results
  flush every 10 tracks, so killing the tab mid-run costs at most a batch. A track is
  retried up to 3 times before being parked as `failed`; **Resume** picks up where it
  stopped and **Retry failed** re-queues the parked ones. This matters at several thousand
  tracks, where third-party lookups failing is normal rather than exceptional.
- **Import counts are explained.** Rows Spotify counts but that carry no usable track —
  local files, region-unavailable items — are reported rather than silently dropped, and a
  failed page keeps everything fetched so far instead of discarding the import.

## Waveforms

Every analysed or played track gets a Serato-style overview waveform: height is loudness,
colour is the mix of **bass (red), mids (green) and treble (blue)**, so kicks, vocals,
breakdowns and drops are visible at a glance.

- Linkwitz-Riley 4th-order crossovers at 250 Hz and 4 kHz; RMS per band at 150 slices/s.
- Each band is normalised on its own, otherwise treble's small amplitude makes every
  waveform red.
- Computed in the analysis worker from PCM it already has (~50 ms per preview), or by a
  lightweight worker the first time an unanalysed track is played. Stored as ~18 KB of
  binary per track in IndexedDB, versioned separately from key analysis.
- The player downloads each preview once and uses the bytes twice: a Blob for playback
  (a signed URL can't expire mid-listen) and the waveform.
- Tap or drag the waveform to seek; it is a keyboard slider too.

## Design and usability

The interface was rebuilt on Reka UI (headless, accessible primitives) and Tailwind, with
choices drawn from NN/g research on filtering, tables and touch:

- **Filters beside results on desktop; a bottom-sheet tray on phones** with a live
  "Show N tracks" button, so you know what you'll get before closing it.
- **Applied filters as removable chips** with *Clear all*; the result count is always on
  screen.
- **The key filter is a Camelot wheel**: compatible keys are a contiguous arc, each key
  shows how many tracks it holds, and it's fully keyboard-operable.
- **Sliders are paired with number fields**, because sliders are imprecise.
- **One list that adapts**: a sortable table on wide screens, a two-line list on phones.
- **Nothing important hides in a tooltip.** Badge meanings are in a legend and in
  screen-reader text; disabled states say why.
- **44 px touch targets** on touch devices, safe-area aware, visible focus, skip link,
  reduced-motion support.
- **Dark first**, with light and system themes.

## Features

| | |
|---|---|
| Filter by key (Camelot wheel), BPM range (± half/double time), genre, free text | Live, with applied-filter chips |
| **Mix** | Harmonically compatible next tracks, adjustable BPM tolerance |
| **Build a set** | A chained path where every step mixes into the next; build up, hold or wind down |
| Half/double-time marking | `½×` / `2×` so a 64 BPM match against 128 reads as intended |
| Preview playback with waveform | Via Deezer (or Spotify's own preview for embed imports); Media Session controls |
| Manual key/BPM correction | On the wheel, with ½×/2× shortcuts; authoritative and permanent |
| Import from links, Spotify, DJ software, audio files | See *Where your library can come from* |
| Export | CSV (opens in Excel and Sheets) or straight to a new Spotify playlist |
| Installable, offline-capable | PWA; prompts before updating |

## Deploying

The service worker needs a fixed base path. The app builds for `/` by default; for a
subpath (e.g. GitHub Pages) build with `BASE_PATH=/spotify-sort/ npm run build`. Serve
`index.html` for unknown routes (SPA fallback). For Spotify links you don't own in
production, deploy `proxy/` and set `VITE_EMBED_PROXY_URL`.

On iPhone and iPad, an installed web app can lose a Spotify sign-in mid-redirect. The PKCE
verifier is keyed by `state` in localStorage to survive that; if it still fails, sign in
once in Safari, then reopen the app.

## Architecture

```
src/
├── router.js                  /, /callback, /import (share target)
├── lib/          pure, testable, no I/O
│   ├── musicalKey.js          pitch-class normalisation
│   ├── tracks.js              filtering, search, sorting
│   ├── camelot.js             compatibility, set building, tempo relations
│   ├── analyzeAudio.js        Essentia wrapper, confidence, ANALYZER_VERSION
│   ├── waveform.js            3-band crossover waveform, colour mapping
│   ├── sourceLinks.js         Spotify/Deezer link parsing
│   ├── spotifyEmbed.js        embed-page track extraction (shared with proxy/)
│   ├── audioFiles.js          local file naming and limits
│   ├── djLibrary.js           Rekordbox / Traktor / CSV parsers
│   ├── keyColors.js, trackInfo.js, exportFormats.js
├── stores/       Pinia: library, filters, overrides, player, auth, toasts
├── services/     I/O
│   ├── spotifyAuth.js         PKCE, token lifecycle
│   ├── spotifyApi.js          pagination, playlists/albums/tracks, embed proxy, export
│   ├── deezer.js              JSONP transport, matching, collections
│   ├── enrich.js              decode + analysis orchestration
│   ├── analysisQueue.js       resumable per-track queue
│   ├── workerPool.js          sized to hardwareConcurrency
│   ├── analysis.worker.js     Essentia + waveform off-thread
│   ├── waveform.worker.js     waveform only, for playback backfill
│   ├── db.js                  IndexedDB: tracks, enrichment, overrides, waveforms
│   └── storage.js, localFiles.js
├── components/
│   ├── ui/                    Button, Sheet, Field, TextInput, Switch, RangeSlider, …
│   └── CamelotWheel, FilterPanel, TrackList, SeedCard, LibrarySheet,
│       NowPlayingBar, WaveformCanvas, EditTrackSheet, …
└── views/                     LibraryView, CallbackView
proxy/                         Cloudflare Worker for Spotify embed pages
```

`lib/` is pure functions over plain data, which is why the tests run with no component
framework and no DOM.

### Musical key representation

Three components spell keys three ways, so everything normalises through **pitch class
(0–11)**:

| | Spelling |
|---|---|
| Sample data / UI | `C#`, `Ab` + `maj`/`min` |
| Essentia | `C#` *or* `Db` + `major`/`minor` |
| `camelot-wheel` | **flats only** — `getKey({name:'C#'})` returns `undefined` |
| Traktor | integer 0–23 |
| Rekordbox | `Am`, `F#m`, *or* Camelot `8A` |

232 of the 1,065 sample tracks (22%) are spelled `C#`/`F#` and would silently fail a
name-based lookup.

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

This is why DJ-software import matters: it has none of these limits.

## Roadmap

- [x] Vue 3 + Vite; Pinia + Router; UI rebuilt on Reka UI + Tailwind (dark first)
- [x] Spotify login (PKCE), library and playlist import
- [x] Tempo and key enrichment via Deezer + local analysis
- [x] Camelot mix suggestions and set building
- [x] Manual key/BPM override
- [x] Rekordbox / Traktor / CSV import
- [x] Preview playback, artwork, genre, duration
- [x] CSV and Spotify playlist export
- [x] Import any Spotify or Deezer link; share target; paste-anywhere
- [x] Installable PWA with offline library
- [x] Serato-style 3-band waveforms
- [x] Full-length analysis of local audio files
- [x] Mix from uncertain keys, ranked by key risk, with visible confidence
- [ ] Read Serato's `database V2` directly; mark tracks you already own
- [ ] Smarter "best match": genre overlap and energy alongside tempo and key
- [ ] Local energy / danceability from Essentia (Spotify's audio features are gone)
- [ ] Match imported DJ libraries back to Spotify IDs so both sources merge
- [ ] Persist named sets between sessions
- [ ] Mini waveforms in list rows; zoomed, scrolling waveform for full-length files
- [ ] Read ID3/MP4 tags for local files instead of relying on filenames
