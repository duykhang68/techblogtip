// Google Identity Services token model: in-memory token only; never persist CV or token in browser storage.
export const CV_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
let bearer = '';
let expiresAt = 0;
let tokenClient;
let gisLoad;

export function configured(clientId, apiBase) {
  return Boolean(clientId && apiBase && /^https:\/\//.test(apiBase));
}
function loadGIS() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoad) return gisLoad;
  gisLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => globalThis.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google Identity Services unavailable'));
    script.onerror = () => reject(new Error('Google sign-in library could not load'));
    document.head.append(script);
  });
  return gisLoad;
}
export async function connectGoogle(clientId) {
  if (!clientId) throw new Error('Missing Google OAuth client ID');
  await loadGIS();
  const response = await new Promise((resolve, reject) => {
    tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CV_DRIVE_SCOPE,
      callback: r => r.error ? reject(new Error('Google authorization denied')) : resolve(r),
      error_callback: () => reject(new Error('Google authorization canceled')),
    });
    tokenClient.requestAccessToken({prompt: 'consent'});
  });
  // GIS may return a subset of requested permissions; fail closed if Drive access was not granted.
  const scopes=String(response.scope||'').split(/\s+/);
  if (!response.access_token || !scopes.includes(CV_DRIVE_SCOPE)) {
    throw new Error('Google Drive appData permission not granted. Accept the Drive access request.');
  }
  bearer = response.access_token;
  expiresAt = Date.now() + Math.max(30, Number(response.expires_in || 3600) - 60) * 1000;
  return true;
}
export function connected() { return Boolean(bearer && Date.now() < expiresAt); }
export function disconnectGoogle() {
  if (bearer && globalThis.google?.accounts?.oauth2) globalThis.google.accounts.oauth2.revoke(bearer, () => {});
  bearer = '';
  expiresAt = 0;
}
export async function driveRequest(apiBase, path = '', method = 'GET', payload) {
  if (!connected()) throw new Error('Google session expired. Please connect again.');
  const base = new URL(apiBase);
  if (base.protocol !== 'https:') throw new Error('Secure HTTPS API required');
  const url = new URL('/api/korea-cv' + path, base);
  const response = await fetch(url, {
    method,
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: 'Bearer ' + bearer,
      ...(payload ? {'Content-Type': 'application/json'} : {}),
    },
    ...(payload ? {body: JSON.stringify(payload)} : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { bearer = ''; expiresAt = 0; }
  if (!response.ok) {
    const err = new Error(data.error || 'Google Drive API error');
    err.status = response.status;
    throw err;
  }
  return data;
}
export const createCVId = () => crypto.randomUUID();
