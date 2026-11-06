/**
 * Spotify Authorization Code flow with PKCE.
 *
 * Implicit Grant was removed on 27 Nov 2025, and a browser app cannot hold a client
 * secret, so PKCE is the only option here. Notes that bit in practice:
 *
 *  - The redirect URI must use the loopback IP. Spotify rejects `localhost`.
 *  - Refresh tokens expire 6 months after the *original* authorisation (since
 *    20 Jul 2026). Refreshing does not extend that window, so `invalid_grant` is a
 *    normal condition to handle, not an error state.
 *  - Tokens live in localStorage, which is readable by any XSS on this origin. That is
 *    an accepted trade-off for a locally-run personal tool with no backend.
 */

import { isTauri, invoke, once } from '../platform/index.js';

const AUTH_HOST = 'https://accounts.spotify.com';
const STORAGE_KEY = 'spotify-sort.tokens';
const VERIFIER_KEY = 'spotify-sort.pkce-verifier';
const STATE_KEY = 'spotify-sort.oauth-state';

export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
export const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

export const SCOPES = [
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
];

/** Thrown when the refresh token is dead and the user must log in again. */
export class ReauthRequired extends Error {
  constructor(message = 'Spotify authorisation expired; sign in again.') {
    super(message);
    this.name = 'ReauthRequired';
  }
}

function randomString(bytes = 64) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/**
 * The PKCE verifier is keyed by `state` in localStorage rather than held in
 * sessionStorage. On iOS an installed web app can hand the Spotify login to a
 * separate browser context and get the redirect back in a fresh session, where
 * sessionStorage is empty. Keying by state still binds the response to the
 * request (CSRF), and entries expire after ten minutes.
 */
const PENDING_KEY = 'spotify-sort.pkce-pending';
const PENDING_TTL_MS = 10 * 60 * 1000;

function readPending() {
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_KEY)) || {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(all).filter(([, v]) => now - v.at < PENDING_TTL_MS));
  } catch {
    return {};
  }
}

function savePending(state, verifier) {
  const all = readPending();
  all[state] = { verifier, at: Date.now() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(all));
  // Older builds used sessionStorage; clear any leftovers.
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

function takePending(state) {
  const all = readPending();
  const entry = state ? all[state] : null;
  if (entry) delete all[state];
  localStorage.setItem(PENDING_KEY, JSON.stringify(all));
  return entry?.verifier ?? null;
}

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function writeTokens(payload) {
  // expires_in is seconds from now; store an absolute deadline instead.
  const tokens = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? readTokens()?.refreshToken ?? null,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  return tokens;
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn() {
  return Boolean(readTokens()?.refreshToken);
}

/**
 * Everything needed to diagnose a redirect-URI mismatch, which is by far the most
 * common way this flow fails.
 *
 * The subtle one is the origin check. The PKCE verifier and CSRF state live in
 * localStorage, which is per-origin — and `http://localhost:5173` and
 * `http://127.0.0.1:5173` are *different origins*. Browse to one while the
 * redirect URI points at the other and Spotify will happily authorise you, then
 * bounce you to an origin where the verifier does not exist, failing at the last
 * step with a confusing "missing PKCE verifier".
 */
export function redirectDiagnostics() {
  const currentOrigin = window.location.origin;
  let registeredOrigin = null;
  try {
    registeredOrigin = new URL(REDIRECT_URI).origin;
  } catch {
    /* malformed or unset */
  }
  return {
    redirectUri: REDIRECT_URI,
    currentOrigin,
    registeredOrigin,
    originMatches: registeredOrigin === currentOrigin,
    browsingLocalhost: currentOrigin.includes('localhost'),
  };
}

/**
 * Build the consent-screen URL and stash the PKCE verifier and state.
 * Separated from `login()` so it can be asserted on without navigating.
 */
export async function buildAuthorizeUrl() {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set — copy .env.example to .env');
  if (!REDIRECT_URI) throw new Error('VITE_SPOTIFY_REDIRECT_URI is not set');

  const diagnostics = redirectDiagnostics();
  // The desktop app catches the redirect itself (see spotify_sign_in in
  // src-tauri), so its own origin doesn't need to match.
  if (!isTauri && !diagnostics.originMatches) {
    throw new Error(
      `You are browsing ${diagnostics.currentOrigin} but the redirect URI is ` +
        `${diagnostics.redirectUri}. Those are different origins, so the sign-in would ` +
        `lose its PKCE verifier on the way back. Open the app at ` +
        `${diagnostics.registeredOrigin} instead` +
        (diagnostics.browsingLocalhost
          ? ' — Spotify does not accept `localhost`, so 127.0.0.1 is the one to use.'
          : '.')
    );
  }

  const verifier = randomString();
  const state = randomString(16);
  savePending(state, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
    scope: SCOPES.join(' '),
  });

  return `${AUTH_HOST}/authorize?${params}`;
}

/**
 * Send the browser to Spotify's consent screen. In the desktop app the consent
 * page opens in its own window; this resolves once that sign-in completes.
 * Returns true when signed in without leaving the page.
 */
export async function login() {
  const url = await buildAuthorizeUrl();
  if (!isTauri) {
    window.location.assign(url);
    return false;
  }
  const callback = once('spotify-callback');
  await invoke('spotify_sign_in', { url, redirect: REDIRECT_URI });
  return handleRedirect(await callback);
}

async function postToken(body) {
  const response = await fetch(`${AUTH_HOST}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload.error === 'invalid_grant') {
      clearTokens();
      throw new ReauthRequired();
    }
    throw new Error(`Spotify token request failed (${response.status}): ${payload.error ?? 'unknown'}`);
  }
  return payload;
}

/**
 * Complete the redirect back from Spotify. Returns true if a login was consumed.
 * Safe to call on every page load.
 */
export async function handleRedirect(href = window.location.href) {
  const fromPage = href === window.location.href;
  const url = new URL(href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    if (fromPage) scrubUrl(url);
    throw new Error(`Spotify authorisation denied: ${error}`);
  }
  if (!code) return false;

  const verifier = takePending(returnedState);
  if (fromPage) scrubUrl(url);

  if (!verifier) {
    throw new Error(
      'This sign-in was started somewhere else (another tab, or Safari instead of the ' +
        'installed app), so it can’t be finished here. Start the sign-in again from this window.'
    );
  }

  writeTokens(
    await postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    })
  );
  return true;
}

function scrubUrl(url) {
  ['code', 'state', 'error'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, '', url.pathname + url.search);
}

/** A valid access token, refreshing if needed. Throws ReauthRequired when dead. */
export async function getAccessToken({ force = false } = {}) {
  const tokens = readTokens();
  if (!tokens?.refreshToken) throw new ReauthRequired('Not signed in to Spotify.');

  // 30s of slack so a token cannot expire mid-flight. `force` is for a 401: the
  // server has rejected a token we still believe is valid, so refresh regardless.
  if (!force && tokens.accessToken && Date.now() < tokens.expiresAt - 30_000) {
    return tokens.accessToken;
  }

  const refreshed = writeTokens(
    await postToken({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken })
  );
  return refreshed.accessToken;
}
