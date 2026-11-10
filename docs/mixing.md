# Mixing tools

[← README](../README.md)

## Mix from a track

Press **Mix** on any row (or Enter, or ⌘E for what's playing). That track becomes the *seed*:
the sidebar shows it, and the list turns into suggestions that mix with it. Click the seed's
artwork to play it, so you can compare it against each suggestion.

- **Best match** ranks tracks by tempo fit, the key move (same, relative or ±1 on the Camelot
  wheel), key confidence, shared genre words and the energy step. It shows the reasons on each
  row, e.g. "Same key · Same genre · Energy +1".
- **Best match favours** *Balance*, *Key*, *Tempo* or *Vibe* (genre and energy), which shifts
  the weights.
- **BPM tolerance** is adjustable. Half and double time count as matches and are marked `½×` /
  `2×`, so a 64 BPM track reads correctly against one at 128.
- **The trail.** Mixing from a suggestion keeps a trail of earlier seeds, with *Back* (⌘[).
  Clearing filters doesn't end the mix.
- **Scope.** Mixing from inside a crate suggests from that crate by default; switch to the
  whole library at any time.
- **Add to crate** on the seed builds a mixtape hop by hop.

## Build a set

Switch the seed card to *Build a set* to get a chained path where every step mixes into the
next. Choose whether the set builds up, holds level or winds down. *Save set as crate* keeps it.

**Transitions** are marked at every step of a set or crate: smooth, rough or clash. A crate's
header says how many steps clash.

## Energy and danceability

Spotify's audio features are closed to new apps, so these are measured locally from the
audio. Energy (1–10) combines onset rate, loudness, tempo and Essentia's danceability, and is
calibrated on a real disco/house library. Energy has a column, a sort and a range filter. The
raw measurements are stored, so the scale can be retuned without re-analysing
(`src/lib/energy.js`).

## Find new tracks

This rebuilds Spotify's playlist *Enhance*, which has no public API. Starting from a track or a
crate (F, or ⇧⌘F):

1. It pulls candidates from Deezer's artist radio and similar artists.
2. It drops what you already have.
3. It measures each preview's tempo and key.
4. It keeps only tracks that mix, best first, with near misses listed separately.

From the results, you can keep tracks in the library, add them straight to a crate, or open them
on Spotify.

## Crates

- **Your crates:** drag rows in, or use the row menu. Reorder them by dragging or with ⌥↑/↓,
  with Undo. Nest them, and export them to CSV or a Spotify playlist.
- **Serato's crates:** mirrored, read-only.
- **Past mixtapes:** an archive folder whose songs count as used (see
  [importing](importing.md#past-mixtapes)).
- **Navigation:** *Browse crates* (⌘K) searches the whole tree, and recently opened crates
  appear as one-click chips.

## Filters

- **Key:** a Camelot wheel showing how many tracks each key holds. *Mixable* selects
  compatible keys, and Shift-click selects a key plus its neighbours.
- **BPM range**, with an optional ½×/2× match.
- **Genre and free text.**
- **Source:** All · Spotify · Serato · In both · Not in Serato, with counts. Icons on every
  row show where a track lives.
- **Energy range** and **Repeats** (hide songs used in past mixtapes).

Applied filters show as removable chips, and the result count is always on screen. Filter
preferences persist between sessions.

## Waveforms

Every analysed or played track gets a Serato-style overview waveform. Height is loudness, and
colour shows the mix of **bass (red), mids (green) and treble (blue)**, so kicks, vocals,
breakdowns and drops are visible at a glance.

- It uses Linkwitz-Riley 4th-order crossovers at 250 Hz and 4 kHz, with RMS per band at 150
  slices/s.
- Each band is normalised on its own. Otherwise treble's small amplitude would make every
  waveform red.
- It's computed in the analysis worker from PCM it already has (~50 ms per preview), or by a
  lightweight worker the first time an unanalysed track is played. Each waveform is stored as
  ~18 KB of binary in IndexedDB.
- Tap or drag to seek. It also works as a keyboard slider.

## Correcting tempo and key

*Correct tempo or key* in any row's menu sets them by hand, on the wheel, with ½×/2×
shortcuts. Corrections outrank Serato, Spotify, Deezer and the analyser, and survive
re-imports and analyser upgrades.

## Export

Export to CSV (opens in Excel and Sheets) or straight to a new Spotify playlist.
