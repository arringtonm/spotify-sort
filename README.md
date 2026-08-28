# Spotify Sort

A DJ tool for harmonic mixing: load a library, filter it by tempo and key, audition tracks,
and build sets where every track mixes into the next.

Vue 3.5 · Vuetify 4.1 · Vite 8 · Pinia · Vue Router · ESLint 10 · `node:test`

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
| `npm test` | 42 tests, `node:test`, no framework |
| `npm run lint` / `lint:fix` | ESLint flat config |
| `node scripts/validate-analyzer.mjs [n]` | Re-measure analyser accuracy |

Requires Node `^20.19.0 || >=22.12.0`.

The dev server binds `127.0.0.1`, not `localhost`, deliberately — Spotify stopped accepting
`localhost` redirect URIs on 27 Nov 2025, so the dev origin must match what is registered.

## Where your library can come from

**1. DJ software — the best source, and no login needed.**
Rekordbox (`.xml`), Traktor (`.nml`), or CSV (which is how Serato and Mixed In Key export).
These tools analysed the whole file offline, so their BPM and key beat anything derivable
from a 30-second preview. Imported values are trusted outright and skip analysis entirely.

**2. Spotify — Liked Songs, your playlists, or a pasted playlist link.**
Capped at 5 allowlisted accounts by Spotify's development mode.

**3. The bundled 1,065-track sample**, shown when signed out.

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

Keys at or above `0.90` show `~` and can seed a mix. Below it they show `?`, render dimmed,
and **cannot** seed a mix. `KEY_CONFIDENCE_THRESHOLD` lives in `src/lib/analyzeAudio.js`.

**And you can always overrule it.** The pencil on any row sets the key, mode or BPM by hand.
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
- **The table is virtualised.** Rendering every row put 1,065 tracks into the DOM as
  ~32,000 elements and 3,195 button components, costing ~350ms to repaint on any filter
  change. Only the visible window renders now — ~13 rows, ~370 elements, ~33ms.
- **The BPM slider commits on release.** It drives a local draft while dragging so the
  thumbs track the pointer, and filters once the gesture ends rather than on every
  pointer move.
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

## Features

| | |
|---|---|
| Filter by key (Camelot), BPM range, genre, free text | Search is debounced |
| Keys shown in Camelot throughout | One column, one chip per wheel position; note name on hover |
| **Mix** | Harmonically compatible next tracks, adjustable BPM tolerance |
| **Build a set** | A chained path where every step mixes into the next; ramp up, hold or wind down |
| Half/double-time marking | `½×` / `2×` so a 64 BPM match against 128 reads as intended |
| 30s preview playback | Via Deezer — Spotify removed previews, Deezer did not |
| Manual key/BPM correction | Authoritative and permanent |
| Artwork, genre, duration columns | Shown only when the loaded source has the data |
| Export | CSV (opens in Excel and Sheets) or straight to a new Spotify playlist |

## Architecture

```
src/
├── router.js                  /  and  /callback
├── lib/          pure, testable, no I/O
│   ├── musicalKey.js          pitch-class normalisation
│   ├── tracks.js              filtering predicate
│   ├── camelot.js             compatibility, set building, tempo relations
│   ├── analyzeAudio.js        Essentia wrapper, confidence, ANALYZER_VERSION
│   ├── djLibrary.js           Rekordbox / Traktor / CSV parsers
│   └── exportFormats.js       CSV
├── stores/       Pinia
│   ├── library.js             tracks, imports, enrichment, exports
│   ├── filters.js             filter state, mix seed, derived rows
│   ├── overrides.js           manual corrections
│   └── player.js              preview playback
├── services/     I/O
│   ├── spotifyAuth.js         PKCE, token lifecycle
│   ├── spotifyApi.js          pagination, genres, playlist export
│   ├── deezer.js              JSONP transport
│   ├── enrich.js              orchestration
│   ├── workerPool.js          sized to hardwareConcurrency
│   ├── analysis.worker.js     Essentia off-thread
│   └── cache.js               IndexedDB: enrichment + overrides
├── views/                     LibraryView, CallbackView
└── components/                LibraryImport, TrackFilters, MixPanel,
                               TrackTable, KeyOverrideDialog
```

`lib/` is pure functions over plain data, which is why 42 tests run with no component
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
| Playlist `items` only for playlists you own | Pasting someone else's link returns no tracks |
| `popularity` removed from dev-mode track objects | Column omitted |

This is why DJ-software import matters: it has none of these limits.

## Roadmap

- [x] Vue 3 + Vuetify 4 + Vite; Pinia + Router
- [x] Spotify login (PKCE), library and playlist import
- [x] Tempo and key enrichment via Deezer + local analysis
- [x] Camelot mix suggestions and set building
- [x] Manual key/BPM override
- [x] Rekordbox / Traktor / CSV import
- [x] Preview playback, artwork, genre, duration
- [x] CSV and Spotify playlist export
- [ ] Match imported DJ libraries back to Spotify IDs so both sources merge
- [ ] Persist named sets between sessions
