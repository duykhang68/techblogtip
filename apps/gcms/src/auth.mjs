// G-CMS Google Identity Services ID-token verification, independent of Visual CMS.
const jwksCache = {keys: null, expires: 0};
const decode = part => Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const list = value => String(value || '').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
export async function requireStaff(request, env) {
  const clientId = String(env.GCMS_GOOGLE_CLIENT_ID || '');
  if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)) throw Error('google_oauth_not_configured');
  const bearer = request.headers.get('authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token || token.length > 10000) throw Error('login_required');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('invalid_identity');
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch { throw Error('invalid_identity'); }
  const timestamp = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
      !['https://accounts.google.com','accounts.google.com'].includes(claims.iss) ||
      claims.aud !== clientId || !Number.isFinite(claims.exp) || claims.exp <= timestamp ||
      (claims.nbf && claims.nbf > timestamp + 30) || claims.email_verified !== true) {
    throw Error('invalid_identity');
  }
  if (!jwksCache.keys || jwksCache.expires < Date.now()) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!response.ok) throw Error('google_jwks_unavailable');
    const data = await response.json();
    jwksCache.keys = data.keys || [];
    jwksCache.expires = Date.now() + 300000;
  }
  const jwk = jwksCache.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig'));
  if (!jwk) throw Error('invalid_identity');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!verified) throw Error('invalid_identity');
  const email = String(claims.email || '').trim().toLowerCase();
  const role = list(env.GCMS_ADMINS).includes(email) ? 'admin'
    : list(env.GCMS_EDITORS).includes(email) ? 'editor'
    : list(env.GCMS_REVIEWERS).includes(email) ? 'reviewer' : null;
  if (!role) throw Error('not_allowed');
  return {email, role};
}