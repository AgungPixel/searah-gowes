import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '$lib/types';

const SESSION_SECONDS = 60 * 60 * 24 * 14;
export const COOKIE_NAME = 'gowes_session';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function derive(password: string, salt: string, secret: string): Promise<Buffer> {
  const peppered = createHmac('sha256', secret).update(password).digest();
  return new Promise((resolve, reject) => {
    scrypt(peppered, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}
export async function hashPassword(password: string, secret: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, secret);
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string, secret: string) {
  const [version, salt, hash] = stored.split('$');
  if (version !== 'scrypt-v1' || !salt || !hash || hash.length !== 64) return false;
  const candidate = await derive(password, salt, secret);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}
export async function createSession(db: D1Database, userId: string, cookies: Cookies, secure: boolean) {
  const token = randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < unixepoch()'),
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(digest(token), userId, expires)
  ]);
  cookies.set(COOKIE_NAME, token, { path: '/', httpOnly: true, secure, sameSite: 'lax', maxAge: SESSION_SECONDS });
}
export async function currentUser(db: D1Database, token?: string): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(`SELECT u.id,u.name,u.email,u.city,u.bike_type,u.bio FROM users u
    JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>unixepoch()`)
    .bind(digest(token)).first<User>();
}
