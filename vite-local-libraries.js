import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { homedir } from 'node:os';

/**
 * Dev-server twin of the desktop app's native commands (src-tauri/src/lib.rs):
 * read-only access to this Mac's Serato and Music libraries, so they can be
 * imported while running `npm run dev` in a browser. The dev server binds
 * 127.0.0.1, and only folders found by scanning (never a path from the URL) or
 * audio files under home or /Volumes are served.
 */
const AUDIO = new Set(['.mp3', '.m4a', '.aac', '.mp4', '.wav', '.aif', '.aiff', '.flac', '.ogg', '.alac']);

function seratoRoots() {
  const found = [];
  const music = join(homedir(), 'Music', '_Serato_');
  if (existsSync(join(music, 'database V2'))) found.push({ root: music, volume: '/', label: 'Music folder' });
  try {
    for (const name of readdirSync('/Volumes')) {
      const root = join('/Volumes', name, '_Serato_');
      if (existsSync(join(root, 'database V2'))) found.push({ root, volume: join('/Volumes', name), label: name });
    }
  } catch {
    /* no /Volumes */
  }
  const seen = new Set();
  return found.filter((f) => {
    const key = realpathSync(f.root);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function crateBlob(root) {
  const dir = join(root, 'Subcrates');
  const parts = [];
  if (!existsSync(dir)) return Buffer.alloc(0);
  for (const file of readdirSync(dir)) {
    if (extname(file) !== '.crate') continue;
    const name = Buffer.from(basename(file, '.crate'), 'utf8');
    const data = readFileSync(join(dir, file));
    const head = Buffer.alloc(4);
    head.writeUInt32BE(name.length);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    parts.push(head, name, len, data);
  }
  return Buffer.concat(parts);
}

const MUSIC_XML = [
  'Music/Music/Library.xml',
  'Music/iTunes/iTunes Music Library.xml',
  'Music/iTunes/iTunes Library.xml',
  'Music/Library.xml',
].map((p) => join(homedir(), p));

export default function localLibraries() {
  return {
    name: 'local-libraries',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local', (req, res) => {
        const url = new URL(req.url, 'http://local');
        const send = (status, body, type = 'text/plain') => {
          res.statusCode = status;
          res.setHeader('Content-Type', type);
          res.end(body);
        };
        try {
          if (url.pathname === '/serato') {
            const list = seratoRoots().map(({ root, volume, label }) => {
              const db = join(root, 'database V2');
              const crates = existsSync(join(root, 'Subcrates'))
                ? readdirSync(join(root, 'Subcrates')).filter((f) => f.endsWith('.crate')).length
                : 0;
              return { root, volume, label, databaseBytes: statSync(db).size, modifiedMs: statSync(db).mtimeMs, crateCount: crates };
            });
            return send(200, JSON.stringify(list), 'application/json');
          }
          if (url.pathname === '/serato/database' || url.pathname === '/serato/crates') {
            const root = seratoRoots().find((r) => r.root === url.searchParams.get('root'))?.root;
            if (!root) return send(404, "That isn't a Serato library on this Mac.");
            const body = url.pathname.endsWith('database') ? readFileSync(join(root, 'database V2')) : crateBlob(root);
            return send(200, body, 'application/octet-stream');
          }
          if (url.pathname === '/audio') {
            const path = url.searchParams.get('path') || '';
            if (!AUDIO.has(extname(path).toLowerCase())) return send(400, 'Not an audio file.');
            const real = realpathSync(path);
            if (!real.startsWith('/Volumes/') && !real.startsWith(homedir() + '/')) return send(403, 'Not allowed.');
            return send(200, readFileSync(real), 'application/octet-stream');
          }
          if (url.pathname === '/music') {
            const file = MUSIC_XML.find((p) => existsSync(p));
            if (!file) return send(404, 'No Music/iTunes Library.xml found. In Music: File → Library → Export Library…');
            return send(200, readFileSync(file, 'utf8'), 'application/xml');
          }
          return send(404, 'Unknown');
        } catch (error) {
          return send(500, error.message);
        }
      });
    },
  };
}
