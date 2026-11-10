# Where your library can come from

[← README](../README.md)

Imports *merge*. New metadata replaces old, but tempo, key and analysis are kept, so
re-importing never redoes work. The same song from two sources becomes **one track**, linked
whichever source was imported first. Matching is by artist and title, and understands "feat.",
"- X Remix" vs "(X Remix)", and radio, extended and original mixes. Remixes stay separate.

Imports run as a visible step-by-step job: *Read → Save → Find previews → Analyse*, with
progress for each step. You can close the sheet at any point; the job keeps going, with
progress in the header.

## Serato (one click)

*Library → Serato library* (or ⇧⌘I in the Mac app) finds `_Serato_` in `~/Music` and on every
connected drive, then reads Serato's binary `database V2` and `.crate` files. You don't need to
locate or export anything.

- **Tracks:** title, artist, album, genre, BPM, key, length, file path, plus Serato's missing
  and corrupt flags.
- **BPM and key:** Serato analysed the whole file, so its values replace estimates from
  previews. Your own corrections and full-length local analysis are never replaced.
- **Crates** appear read-only and nested as in Serato, and re-sync on every import.
- **Playback** comes from your own file, at full length with a full waveform. Analysis uses two
  minutes of the file rather than a 30-second preview.

## Spotify

**Liked Songs or your playlists** (needs [sign-in](setup.md#connecting-spotify-optional)):
full length, with no 100-track cap.

**Any link.** Paste a Spotify or Deezer playlist, album or track link into the Library sheet,
or anywhere in the app. On Android, you can also *Share* it into the installed app.

- **Deezer links** need no sign-in and arrive with Deezer IDs and ISRCs.
- **Spotify albums and tracks, and playlists you own or collaborate on,** come through the Web
  API.
- **Other Spotify playlists** are read from Spotify's public embed page via a small proxy: the
  Vite dev server locally, the Mac app natively, or a Cloudflare Worker in production (`proxy/`).
  This is **unofficial** and can break without notice; the UI says so.
- **The embed page stops at 100 tracks**, and it has no paging. For a longer playlist you don't
  own, open it in the Spotify desktop app, select all (⌘A), copy (⌘C), and paste into Spotify
  Sort. Every track link is imported.

## Past mixtapes

Import a spreadsheet of your old mixes from *File → Import Past Mixtapes* in the Mac app, or
from *Past mixtapes* in the Library sheet. The file can be .xlsx or CSV, or you can paste the
rows. The format is column A artist, column B song, and column C the mix number on each mix's
first row. The import creates a folder of crates, one per mix.

Every song in those mixes is flagged as **used** (a "Used in Mix 3" pill) and is suggested
last. *Hide tracks used in past mixtapes* removes them entirely. Songs not in your library yet
stay listed, and link up when you import them later.

## DJ software files

Rekordbox (`.xml`), Traktor (`.nml`), CSV from Serato, Mixed In Key or Exportify, and the Music
app's `Library.xml` (*File → Import Music Library* reads it directly). These tools analysed the
whole file, so their BPM and key are trusted and skip analysis.

## Audio files

Drop MP3/AAC/WAV/AIFF/FLAC files to analyse whole tracks locally. This gives far better key
estimates than a 30-second preview, plus a full-length waveform. Nothing is uploaded; only the
results are stored.

## Artwork

Serato's database has no artwork. *Find artwork for N* (in the analysis popover, or *File →
Find Missing Artwork*) fills it in:

1. A **Deezer cover**, accepted only when the title and artist match. Only the link is stored.
2. Otherwise, the **art embedded in your own file** (ID3 in MP3/AIFF/WAV, MP4 `covr`, FLAC
   `PICTURE`), shrunk to a 200 px thumbnail of about 13 KB.

Progress is saved every 25 tracks. Tracks with no art anywhere are remembered and skipped next
time; tracks that hit network errors are tried again on the next run.

## Backup and restore

*Library → Backup → Back up now* writes your tracks, analysis, crates and corrections to one
file in `~/Documents/Spotify Sort Backups`. *Restore* merges a backup into the library.

## The sample library

The bundled 1,065-track sample is shown until you import something.
