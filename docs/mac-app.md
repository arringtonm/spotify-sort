# The Mac app

[← README](../README.md)

`npm run desktop:build` produces an ~8 MB `Spotify Sort.app` built with Tauri 2, which uses
the system WebKit rather than a bundled browser. Copy it to Applications. It isn't notarised,
so the first launch needs right-click → Open. It's the same app as the web version, plus:

- **Direct, read-only access to your libraries.** It reads `~/Music/_Serato_`, every drive's
  `_Serato_`, the Music/iTunes `Library.xml`, and the audio files they point at. Serato tracks
  play at full length from your own files.
- **No browser limits.** Spotify playlist pages are read without the proxy, and the Deezer and
  Spotify token requests use the native HTTP client.
- **Spotify sign-in in its own window**, which catches the redirect to the registered
  `http://127.0.0.1:5173/callback`.
- **Its own storage.** To move a browser library into the app, use *Library → Backup → Back up
  now* in the browser, then *Restore* in the app. A fresh install offers to restore the newest
  backup automatically. Backups are saved in `~/Documents/Spotify Sort Backups`.

Native file access lives in `src-tauri/src/lib.rs`. Every command only reads from fixed
locations: the Serato folders it finds itself, audio files under your home folder or
`/Volumes`, and the backups folder. Under `npm run dev`, a dev endpoint bound to 127.0.0.1
(`vite-local-libraries.js`) serves the same reads, so everything also works in a browser on
this Mac.

Serato files stored in the Music app's folder (`~/Music/Music/Media.localized`) need macOS
permission. Allow it when asked, or add the app under *Privacy & Security → Media & Apple
Music*.

## Menus and shortcuts

| Menu | Items |
|---|---|
| **File** | Sync Serato Library ⇧⌘I · Import Music Library · Find Missing Artwork · Import… ⌘I · New Crate ⌘N · Import Past Mixtapes |
| **Edit** | Find ⌘F |
| **View** | All Tracks ⌘0 · Browse Crates ⌘K · Comfortable / Compact rows ⌘1 / ⌘2 · Source · Hide Used ⇧⌘H · Reset Filters ⇧⌘R |
| **Mix** | Mix From Playing Track ⌘E · Back ⌘[ · Play Mixing-From Track ⇧⌘P · Find New Tracks ⇧⌘F · Next Track / Build a Set · Stop Mixing ⌘. |

## Keyboard in the track list

These shortcuts work in the browser too.

| Key | Does |
|---|---|
| ↑ / ↓, Home / End | Move between rows |
| Space | Play / pause the row |
| Enter or M | Mix from the row |
| F | Find new tracks like it |
| ⌫ | Remove from the open crate (your own crates) |
| ⌥↑ / ⌥↓ | Move within the open crate |
| Shift-click a key on the wheel | Select it and its mixable neighbours |
