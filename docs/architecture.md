# Architecture

[← README](../README.md)

One Vue app runs in three places: the browser, the installed PWA, and the Mac app (Tauri 2,
system WebKit). Everything the browser can't do (reading the Serato library and your audio
files, writing backups, requests without CORS limits) goes through `src/platform/` and a few
Rust commands in `src-tauri/`. Under `npm run dev`, a dev-server endpoint serves the same reads.

Data is local-first. Tracks, analysis, waveforms and corrections live in IndexedDB as
individual records; crates and preferences live in localStorage.

```
src/
├── router.js                  /, /callback, /import (share target)
├── platform/                  isTauri, native invoke/listen, native fetch, open links
├── lib/          pure, testable, no I/O
│   ├── musicalKey.js          pitch-class normalisation
│   ├── tracks.js              filtering, search, sorting
│   ├── camelot.js             compatibility, set building, tempo relations
│   ├── mixScore.js            best-match scoring with reasons; transition check
│   ├── energy.js              energy 1–10 and danceability from measured features
│   ├── analyzeAudio.js        Essentia wrapper, confidence, ANALYZER_VERSION
│   ├── waveform.js            3-band crossover waveform, colour mapping
│   ├── seratoDb.js            Serato `database V2` and `.crate` parser
│   ├── seratoMerge.js         link Serato files to existing tracks, either import order
│   ├── trackMatch.js          artist/title matching across sources
│   ├── crates.js              crate tree, ordering, past-mixtape usage
│   ├── mixtapeSheet.js, xlsx.js   past-mixtape spreadsheets (no dependency xlsx reader)
│   ├── musicLibrary.js        Music/iTunes Library.xml
│   ├── embeddedArt.js         cover art from ID3 / MP4 / FLAC tags
│   ├── djLibrary.js           Rekordbox / Traktor / CSV parsers
│   ├── sourceLinks.js, spotifyEmbed.js, audioFiles.js
│   └── keyColors.js, trackInfo.js, exportFormats.js
├── stores/       Pinia: library, filters, crates, overrides, player, auth, toasts
├── services/     I/O
│   ├── spotifyAuth.js         PKCE, token lifecycle (own sign-in window in the Mac app)
│   ├── spotifyApi.js          pagination, playlists/albums/tracks, embed proxy, export
│   ├── deezer.js              JSONP transport, matching, covers, artist radio
│   ├── discover.js            "Find new tracks"
│   ├── artwork.js             missing-artwork finder
│   ├── localLibraries.js      Serato / Music / audio-file reads (native or dev endpoint)
│   ├── backup.js              backup file format, restore
│   ├── enrich.js              decode + analysis orchestration
│   ├── analysisQueue.js       resumable per-track queue
│   ├── workerPool.js          sized to hardwareConcurrency
│   ├── analysis.worker.js     Essentia + waveform off-thread
│   ├── waveform.worker.js     waveform only, for playback backfill
│   ├── db.js                  IndexedDB: tracks, enrichment, overrides, waveforms
│   └── storage.js, localFiles.js
├── composables/               app menu, drag and drop, density, mix, theme, UI state
├── components/
│   ├── ui/                    Button, Sheet, Stepper, Switch, RangeSlider, Segmented, …
│   └── TrackList, SeedCard, FilterPanel, CamelotWheel, Crate*, DiscoverSheet,
│       LibrarySheet, NowPlayingBar, WaveformCanvas, …
└── views/                     LibraryView, CallbackView
src-tauri/                     Mac app: Rust commands, native menu, capabilities
vite-local-libraries.js        dev-only twin of the native file commands
proxy/                         Cloudflare Worker for Spotify embed pages
```

`lib/` is pure functions over plain data, which is why the tests need no component framework
and no DOM.

## Musical key representation

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
- **Nothing shifts.** Hints, errors and chips have reserved space, and menus don't lock scroll,
  so state changes never push the layout around.
- **Two densities**: comfortable rows with artwork, or compact one-line rows (⌘1 / ⌘2).
