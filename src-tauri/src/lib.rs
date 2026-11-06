//! Spotify Sort's native shell.
//!
//! The app itself is the same Vue web app that runs in a browser. This shell adds
//! what a web page can't do on its own:
//!   * a real macOS menu bar (menu clicks are forwarded to the page as events);
//!   * read-only access to the DJ's own libraries — Serato's `_Serato_` folders
//!     and the Music/iTunes `Library.xml` — found automatically, no file picker;
//!   * reading local audio files the libraries point at (full-length playback
//!     and analysis);
//!   * Spotify sign-in in a separate window, so the redirect back to the
//!     registered loopback URI is caught without running a local server.
//!
//! Everything here reads; nothing writes outside the app's own data.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::ipc::Response;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

// ------------------------------------------------------------------ Serato

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SeratoLibrary {
    /// The `_Serato_` folder.
    root: String,
    /// Track paths in this database are relative to this volume root.
    volume: String,
    /// Human name: "Music folder" or the drive's name.
    label: String,
    database_bytes: u64,
    modified_ms: u64,
    crate_count: usize,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// Every Serato database on this Mac: the one in ~/Music, plus one per external
/// drive (Serato keeps a separate database at the root of each drive).
fn serato_roots() -> Vec<(PathBuf, PathBuf, String)> {
    let mut found: Vec<(PathBuf, PathBuf, String)> = Vec::new();
    if let Some(home) = home() {
        let root = home.join("Music").join("_Serato_");
        if root.join("database V2").is_file() {
            found.push((root, PathBuf::from("/"), "Music folder".into()));
        }
    }
    if let Ok(entries) = fs::read_dir("/Volumes") {
        for entry in entries.flatten() {
            let volume = entry.path();
            let root = volume.join("_Serato_");
            if root.join("database V2").is_file() {
                let label = volume
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Drive".into());
                found.push((root, volume, label));
            }
        }
    }
    // /Volumes/Macintosh HD is the boot volume again; drop duplicates.
    let mut seen = std::collections::HashSet::new();
    found.retain(|(root, _, _)| {
        let key = fs::canonicalize(root).unwrap_or_else(|_| root.clone());
        seen.insert(key)
    });
    found
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
fn find_serato_libraries() -> Vec<SeratoLibrary> {
    serato_roots()
        .into_iter()
        .map(|(root, volume, label)| {
            let db = root.join("database V2");
            let crate_count = fs::read_dir(root.join("Subcrates"))
                .map(|it| {
                    it.flatten()
                        .filter(|e| e.path().extension().is_some_and(|x| x == "crate"))
                        .count()
                })
                .unwrap_or(0);
            SeratoLibrary {
                root: root.to_string_lossy().into_owned(),
                volume: volume.to_string_lossy().into_owned(),
                label,
                database_bytes: fs::metadata(&db).map(|m| m.len()).unwrap_or(0),
                modified_ms: modified_ms(&db),
                crate_count,
            }
        })
        .collect()
}

/// Only folders we found ourselves can be read — the page can't name any path.
fn checked_root(root: &str) -> Result<PathBuf, String> {
    serato_roots()
        .into_iter()
        .map(|(r, _, _)| r)
        .find(|r| r.to_string_lossy() == root)
        .ok_or_else(|| "That isn't a Serato library on this Mac.".to_string())
}

#[tauri::command]
fn read_serato_database(root: String) -> Result<Response, String> {
    let root = checked_root(&root)?;
    fs::read(root.join("database V2"))
        .map(Response::new)
        .map_err(|e| format!("Couldn't read Serato's database: {e}"))
}

/// All crate files in one binary blob, framed as repeated
/// `[u32 name length][name, UTF-8][u32 data length][data]`, big-endian.
/// One round trip instead of one per crate.
#[tauri::command]
fn read_serato_crates(root: String) -> Result<Response, String> {
    let root = checked_root(&root)?;
    let mut out = Vec::new();
    let dir = root.join("Subcrates");
    let entries = match fs::read_dir(&dir) {
        Ok(it) => it,
        Err(_) => return Ok(Response::new(out)),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.extension().is_some_and(|x| x == "crate") {
            continue;
        }
        let Some(stem) = path.file_stem().map(|s| s.to_string_lossy().into_owned()) else {
            continue;
        };
        let Ok(data) = fs::read(&path) else { continue };
        let name = stem.into_bytes();
        out.extend_from_slice(&(name.len() as u32).to_be_bytes());
        out.extend_from_slice(&name);
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(&data);
    }
    Ok(Response::new(out))
}

// ------------------------------------------------------------------ iTunes / Music

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicLibraryFile {
    path: String,
    modified_ms: u64,
}

fn music_library_candidates() -> Vec<PathBuf> {
    let Some(home) = home() else { return vec![] };
    vec![
        home.join("Music/Music/Library.xml"),
        home.join("Music/iTunes/iTunes Music Library.xml"),
        home.join("Music/iTunes/iTunes Library.xml"),
        home.join("Music/Library.xml"),
    ]
}

#[tauri::command]
fn find_music_library() -> Option<MusicLibraryFile> {
    music_library_candidates()
        .into_iter()
        .find(|p| p.is_file())
        .map(|p| MusicLibraryFile {
            modified_ms: modified_ms(&p),
            path: p.to_string_lossy().into_owned(),
        })
}

#[tauri::command]
fn read_music_library() -> Result<String, String> {
    let path = music_library_candidates()
        .into_iter()
        .find(|p| p.is_file())
        .ok_or("No Music/iTunes Library.xml found. In Music: File → Library → Export Library…")?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ local audio

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "m4a", "aac", "mp4", "wav", "aif", "aiff", "flac", "ogg", "alac",
];

/// Read an audio file a library points at. Limited to audio files in the home
/// folder or on mounted drives.
#[tauri::command]
fn read_audio_file(path: String) -> Result<Response, String> {
    let path = PathBuf::from(&path);
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if !AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        return Err("Not an audio file.".into());
    }
    let real = fs::canonicalize(&path).map_err(|_| "File not found — it may have moved.".to_string())?;
    let allowed = real.starts_with("/Volumes") || home().is_some_and(|h| real.starts_with(h));
    if !allowed {
        return Err("Only files in your home folder or on a drive can be read.".into());
    }
    fs::read(real).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
fn files_exist(paths: Vec<String>) -> Vec<bool> {
    paths.iter().map(|p| Path::new(p).is_file()).collect()
}

// ------------------------------------------------------------------ backups

/// Library backups live in ~/Documents/Spotify Sort Backups, so moving between
/// the browser and the desktop app (or to a new Mac) is a file you can see.
fn backup_dir() -> Result<PathBuf, String> {
    home()
        .map(|h| h.join("Documents").join("Spotify Sort Backups"))
        .ok_or_else(|| "No home folder.".to_string())
}

#[tauri::command]
fn write_backup(name: String, contents: String) -> Result<String, String> {
    if name.contains('/') || !name.ends_with(".json") {
        return Err("Bad backup name.".into());
    }
    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    name: String,
    path: String,
    modified_ms: u64,
    bytes: u64,
}

#[tauri::command]
fn latest_backup() -> Option<BackupFile> {
    let dir = backup_dir().ok()?;
    fs::read_dir(&dir)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .max_by_key(|p| modified_ms(p))
        .map(|p| BackupFile {
            name: p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
            modified_ms: modified_ms(&p),
            bytes: fs::metadata(&p).map(|m| m.len()).unwrap_or(0),
            path: p.to_string_lossy().into_owned(),
        })
}

#[tauri::command]
fn read_backup(name: String) -> Result<String, String> {
    if name.contains('/') {
        return Err("Bad backup name.".into());
    }
    fs::read_to_string(backup_dir()?.join(name)).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ Spotify sign-in

/// Open Spotify's consent page in its own window and catch the redirect.
///
/// The redirect URI registered with Spotify is the loopback dev address; we
/// never need anything to answer there — the navigation is intercepted, its URL
/// (code + state) handed to the page, and the window closed.
#[tauri::command]
async fn spotify_sign_in(app: AppHandle, url: String, redirect: String) -> Result<(), String> {
    let parsed: Url = url.parse().map_err(|e| format!("Bad sign-in URL: {e}"))?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("accounts.spotify.com") {
        return Err("Unexpected sign-in address.".into());
    }
    if !redirect.starts_with("http://127.0.0.1") {
        return Err("Redirect must be a loopback address.".into());
    }
    if let Some(existing) = app.get_webview_window("spotify-auth") {
        let _ = existing.close();
    }
    let handle = app.clone();
    WebviewWindowBuilder::new(&app, "spotify-auth", WebviewUrl::External(parsed))
        .title("Sign in to Spotify")
        .inner_size(480.0, 760.0)
        .on_navigation(move |target| {
            if target.as_str().starts_with(&redirect) {
                let _ = handle.emit("spotify-callback", target.to_string());
                let h = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(w) = h.get_webview_window("spotify-auth") {
                        let _ = w.close();
                    }
                });
                return false;
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ------------------------------------------------------------------ menu

fn build_menu(app: &AppHandle) -> tauri::Result<()> {
    let item = |id: &str, text: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, text);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    let app_menu = SubmenuBuilder::new(app, "Spotify Sort")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&item("import-serato", "Sync Serato Library", Some("CmdOrCtrl+Shift+I"))?)
        .item(&item("import-music", "Import Music Library", None)?)
        .item(&item("import", "Import…", Some("CmdOrCtrl+I"))?)
        .separator()
        .item(&item("new-crate", "New Crate…", Some("CmdOrCtrl+N"))?)
        .item(&item("import-mixtapes", "Import Past Mixtapes…", None)?)
        .separator()
        .close_window()
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item("find", "Find…", Some("CmdOrCtrl+F"))?)
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&item("all-tracks", "All Tracks", Some("CmdOrCtrl+0"))?)
        .item(&item("browse-crates", "Browse Crates…", Some("CmdOrCtrl+K"))?)
        .separator()
        .item(&item("density-comfortable", "Comfortable Rows", Some("CmdOrCtrl+1"))?)
        .item(&item("density-compact", "Compact Rows", Some("CmdOrCtrl+2"))?)
        .separator()
        .item(&item("source-all", "All Sources", None)?)
        .item(&item("source-spotify", "Spotify", None)?)
        .item(&item("source-serato", "Serato", None)?)
        .item(&item("source-both", "In Both", None)?)
        .item(&item("source-spotify-only", "Not in Serato", None)?)
        .item(&item("toggle-hide-used", "Hide/Show Tracks Used in Past Mixtapes", Some("CmdOrCtrl+Shift+H"))?)
        .separator()
        .item(&item("reset-filters", "Reset Filters", Some("CmdOrCtrl+Shift+R"))?)
        .separator()
        .fullscreen()
        .build()?;

    let mix = SubmenuBuilder::new(app, "Mix")
        .item(&item("mix-playing", "Mix From Playing Track", Some("CmdOrCtrl+E"))?)
        .item(&item("mix-back", "Back to Previous Track", Some("CmdOrCtrl+["))?)
        .item(&item("discover", "Find New Tracks…", Some("CmdOrCtrl+Shift+F"))?)
        .separator()
        .item(&item("mix-next", "Next Track Mode", Some("CmdOrCtrl+Shift+N"))?)
        .item(&item("mix-set", "Build a Set Mode", Some("CmdOrCtrl+Shift+B"))?)
        .separator()
        .item(&item("mix-stop", "Stop Mixing", Some("CmdOrCtrl+."))?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &view, &mix, &window])
        .build()?;
    app.set_menu(menu)?;

    // Every custom item becomes a "menu" event the page handles.
    app.on_menu_event(|app, event| {
        let _ = app.emit_to("main", "menu", event.id().as_ref().to_string());
    });
    Ok(())
}

// ------------------------------------------------------------------ app

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_menu(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            find_serato_libraries,
            read_serato_database,
            read_serato_crates,
            find_music_library,
            read_music_library,
            read_audio_file,
            files_exist,
            write_backup,
            latest_backup,
            read_backup,
            spotify_sign_in,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Spotify Sort");
}
