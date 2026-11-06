/**
 * Spotify embed proxy — a Cloudflare Worker.
 *
 * Spotify's Web API only returns the tracks of playlists the signed-in user owns
 * (development mode, Feb 2026), but the public embed page for any playlist or
 * album lists its tracks. That page sends no CORS headers, so the app reads it
 * through this Worker, which returns just the track list as JSON.
 *
 * Unofficial: Spotify can change the page at any time. Deliberately narrow so it
 * can't be used as an open proxy: one host, two path shapes, a strict ID check,
 * and an origin allowlist.
 */
import { extractEmbedTracks } from '../../src/lib/spotifyEmbed.js';

const PATH = /^\/spotify-embed\/(playlist|album|track)\/([A-Za-z0-9]{22})$/;
const CACHE_SECONDS = 3600;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const corsOrigin = allowed.includes(origin) ? origin : null;
    const cors = corsOrigin
      ? { 'Access-Control-Allow-Origin': corsOrigin, Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: corsOrigin ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' },
      });
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);
    if (!corsOrigin) return json({ error: 'Origin not allowed' }, 403, cors);

    const url = new URL(request.url);
    const match = PATH.exec(url.pathname);
    if (!match) return json({ error: 'Not found' }, 404, cors);
    const [, type, id] = match;

    const cache = caches.default;
    const cacheKey = new Request(`https://cache.internal/${type}/${id}`);
    const hit = await cache.match(cacheKey);
    if (hit) return withHeaders(hit, cors);

    const upstream = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; spotify-sort-embed-proxy)' },
    });
    if (upstream.status === 404) return json({ error: 'Not found on Spotify' }, 404, cors);
    if (!upstream.ok) return json({ error: `Spotify returned ${upstream.status}` }, 502, cors);

    let body;
    try {
      body = extractEmbedTracks(await upstream.text());
    } catch (error) {
      return json({ error: error.message }, 502, cors);
    }

    const response = json(body, 200, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return withHeaders(response, cors);
  },
};

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function withHeaders(response, headers) {
  const next = new Response(response.body, response);
  Object.entries(headers).forEach(([k, v]) => next.headers.set(k, v));
  return next;
}
