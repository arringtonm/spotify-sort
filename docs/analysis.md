# Audio analysis: tempo, key and confidence

[← README](../README.md)

## Why the app measures audio itself

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
Manual corrections outrank Serato, Spotify, Deezer and the analyser, persist in IndexedDB, and
survive re-imports and analyser upgrades.

## Implementation notes

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

## Order of preference

For each track, BPM and key come from the best source available:

1. **Your correction** (*Correct tempo or key*).
2. **Serato or other DJ software**, which analysed the whole file.
3. **Full-length local analysis** of your own file (Serato tracks in the Mac app, or dropped
   audio files), using two minutes from the middle.
4. **A 30-second preview** (Deezer, or Spotify's embed preview).

Energy and danceability are measured in the same pass; see [mixing](mixing.md#energy-and-danceability).
