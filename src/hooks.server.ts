import { json, type Handle } from '@sveltejs/kit';
import { COOKIE_NAME, currentUser, digest } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionHash = null;
  if (event.url.pathname.startsWith('/api/')) {
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database belum terhubung. Jalankan npm run dev atau pasang binding DB di Cloudflare.' }, { status: 503 });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
      if (event.request.headers.get('origin') !== event.url.origin)
        return json({ error: 'Permintaan harus berasal dari situs ini.' }, { status: 403 });
    }
    const token = event.cookies.get(COOKIE_NAME);
    event.locals.user = await currentUser(db, token);
    event.locals.sessionHash = token ? digest(token) : null;
  }
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (event.url.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'no-store');
  return response;
};
