import { error, json, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { CHECKLIST, type Ride, type User, type Participant, type RideNote } from '$lib/types';
import { COOKIE_NAME, createSession, digest, hashPassword, verifyPassword } from './auth';
import { ValidationError, optionalEmailField, usernameField, passwordField, textField, enumField, rideFields } from './validation';

const USER_COLUMNS = 'id,name,username,email,city,bike_type,bio';
const RIDE_QUERY = `SELECT r.*, u.name AS organizer_name,
  (SELECT COUNT(*) FROM participants p WHERE p.ride_id=r.id) AS participant_count,
  EXISTS(SELECT 1 FROM participants p WHERE p.ride_id=r.id AND p.user_id=?) AS joined
  FROM rides r JOIN users u ON u.id=r.organizer_id`;

async function body(event: RequestEvent): Promise<Record<string, unknown>> {
  if (!event.request.headers.get('content-type')?.startsWith('application/json')) error(415, 'Gunakan JSON.');
  const raw = await event.request.text();
  if (raw.length > 16384) error(413, 'Data terlalu besar.');
  try {
    const result = JSON.parse(raw);
    if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error();
    return result;
  } catch { error(400, 'Format data tidak valid.'); }
}
function requireUser(event: RequestEvent): User {
  if (!event.locals.user) error(401, 'Silakan masuk terlebih dahulu.');
  return event.locals.user;
}
async function limit(db: D1Database, key: string, max: number, seconds = 900) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires_at<=? THEN 1 ELSE hits+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING hits`)
    .bind(key, now + seconds, now, now).first<{ hits: number }>();
  if (!row || row.hits > max) error(429, 'Terlalu banyak percobaan. Coba lagi beberapa saat.');
}
function secret(event: RequestEvent) {
  const value = event.platform!.env.AUTH_SECRET;
  if (!value || value.length < 32) error(503, 'AUTH_SECRET belum diatur. Lihat README untuk konfigurasi.');
  return value;
}
async function findRide(db: D1Database, id: string, userId: string) {
  const ride = await db.prepare(`${RIDE_QUERY} WHERE r.id=?`).bind(userId, id).first<Ride>();
  if (!ride) error(404, 'Jadwal gowes tidak ditemukan.');
  return ride;
}
async function detail(db: D1Database, id: string, userId: string) {
  const ride = await findRide(db, id, userId);
  const participants = await db.prepare(`SELECT u.id,u.name,u.city,u.bike_type FROM participants p
    JOIN users u ON u.id=p.user_id WHERE p.ride_id=? ORDER BY p.joined_at,u.name`).bind(id).all<Participant>();
  const checklist = await db.prepare('SELECT item_id FROM checklist WHERE ride_id=? AND user_id=?').bind(id, userId).all<{ item_id: string }>();
  const notes = await db.prepare(`SELECT n.id,n.user_id,u.name,n.body,n.created_at FROM notes n
    JOIN users u ON u.id=n.user_id WHERE n.ride_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 100`).bind(id).all<RideNote>();
  return { ride, participants: participants.results, checklist: checklist.results.map(c => c.item_id), notes: notes.results };
}

export async function handleApi(event: RequestEvent) {
  try { return await route(event); }
  catch (err) {
    if (isHttpError(err)) return json({ error: err.body.message }, { status: err.status });
    if (err instanceof ValidationError) return json({ error: err.message }, { status: 400 });
    const message = err instanceof Error ? err.message : '';
    if (/RIDE_FULL/.test(message)) return json({ error: 'Kuota gowes sudah penuh.' }, { status: 409 });
    if (/RIDE_CLOSED|RIDE_STARTED/.test(message)) return json({ error: 'Pendaftaran sudah ditutup.' }, { status: 409 });
    if (/CAPACITY_TOO_SMALL/.test(message)) return json({ error: 'Kuota tidak boleh kurang dari jumlah peserta saat ini.' }, { status: 409 });
    if (/UNIQUE constraint failed: users.username/.test(message)) return json({ error: 'Username sudah digunakan. Pilih username lain.' }, { status: 409 });
    if (/UNIQUE constraint failed: users.email/.test(message)) return json({ error: 'Email sudah dipakai akun lain.' }, { status: 409 });
    if (/UNIQUE constraint failed: participants/.test(message)) return json({ error: 'Kamu sudah terdaftar pada gowes ini.' }, { status: 409 });
    console.error('Gowes API:', message);
    return json({ error: 'Data belum dapat diproses. Coba lagi.' }, { status: 500 });
  }
}
async function route(event: RequestEvent): Promise<Response> {
  const db = event.platform!.env.DB;
  const path = event.params.path ?? '';
  const method = event.request.method;
  const parts = path.split('/');
  const ip = event.request.headers.get('cf-connecting-ip') || 'local';

  if (path === 'auth/logout' && method === 'POST') {
    if (event.locals.sessionHash) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(event.locals.sessionHash).run();
    event.cookies.delete(COOKIE_NAME, { path: '/' });
    return json({ ok: true });
  }
  if ((path === 'auth/register' || path === 'auth/login') && method === 'POST') {
    const authSecret = secret(event);
    await limit(db, `auth:ip:${digest(ip)}`, 30);
    const data = await body(event);
    let userId: string;
    if (path === 'auth/register') {
      const username = usernameField(data);
      await limit(db, `auth:identity:${digest(username)}`, 10);
      const name = textField(data, 'name', 2, 60);
      const password = passwordField(data);
      const passwordHash = await hashPassword(password, authSecret);
      userId = randomUUID();
      // No email is requested or invented for a new account.
      await db.prepare('INSERT INTO users(id,account_key,name,username,password_hash) VALUES(?,?,?,?,?)')
        .bind(userId, userId, name, username, passwordHash).run();
    } else {
      // Legacy email payloads remain valid only for accounts without a username.
      const identity = textField({ identity: data.username ?? data.email }, 'identity', 1, 254).toLowerCase();
      await limit(db, `auth:identity:${digest(identity)}`, 10);
      const password = data.password;
      if (typeof password !== 'string' || password.length < 1 || password.length > 128) error(400, 'Isi password yang valid.');
      const account = await db.prepare('SELECT id,password_hash FROM users WHERE username=? OR (username IS NULL AND email=?)')
        .bind(identity, identity).first<{ id: string; password_hash: string }>();
      const dummy = 'scrypt-v1$00000000000000000000000000000000$' + '0'.repeat(64);
      const valid = await verifyPassword(password, account?.password_hash ?? dummy, authSecret);
      if (!account || !valid) error(401, 'Username atau password belum cocok. Akun lama dapat memakai email sampai username diatur.');
      userId = account.id;
    }
    // Rotate the current session, including after signing into a different account.
    if (event.locals.sessionHash) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(event.locals.sessionHash).run();
    await createSession(db, userId, event.cookies, event.url.protocol === 'https:');
    const user = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id=?`).bind(userId).first<User>();
    return json({ user }, { status: path === 'auth/register' ? 201 : 200 });
  }
  if (path === 'bootstrap' && method === 'GET') {
    if (!event.locals.user) return json({ user: null, rides: [] });
    const { results } = await db.prepare(`${RIDE_QUERY} ORDER BY r.starts_at DESC LIMIT 300`).bind(event.locals.user.id).all<Ride>();
    return json({ user: event.locals.user, rides: results });
  }
  const user = requireUser(event);
  if (method !== 'GET') await limit(db, `write:${user.id}`, 100, 60);
  if (path === 'profile' && method === 'PATCH') {
    const data = await body(event);
    const name = textField(data, 'name', 2, 60);
    const city = textField(data, 'city', 0, 80);
    const bike = enumField(data, 'bike_type', ['Road bike','MTB','Gravel','Folding bike','Hybrid','Lainnya']);
    const bio = textField(data, 'bio', 0, 300);
    const username = data.username === undefined && user.username ? user.username : usernameField(data);
    const email = data.email === undefined ? user.email : optionalEmailField(data);
    await db.prepare('UPDATE users SET name=?,username=?,email=?,city=?,bike_type=?,bio=? WHERE id=?')
      .bind(name, username, email, city, bike, bio, user.id).run();
    return json({ user: await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id=?`).bind(user.id).first<User>() });
  }
  if (path === 'auth/password' && method === 'PATCH') {
    await limit(db, `password:${user.id}`, 5);
    const data = await body(event);
    const oldPassword = data.current_password;
    if (typeof oldPassword !== 'string' || oldPassword.length < 1 || oldPassword.length > 128) error(400, 'Isi password saat ini.');
    const password = passwordField(data);
    const account = await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first<{ password_hash: string }>();
    if (!account || !await verifyPassword(oldPassword, account.password_hash, secret(event))) error(400, 'Password saat ini belum cocok.');
    const hash = await hashPassword(password, secret(event));
    await db.batch([
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hash, user.id),
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)
    ]);
    await createSession(db, user.id, event.cookies, event.url.protocol === 'https:');
    return json({ ok: true });
  }
  if (path === 'rides' && method === 'POST') {
    const fields = rideFields(await body(event));
    const id = randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO rides(id,organizer_id,title,description,city,meeting_point,route_url,starts_at,distance_km,elevation_m,capacity,pace,terrain)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, user.id, fields.title, fields.description, fields.city, fields.meeting_point, fields.route_url,
          fields.starts_at, fields.distance_km, fields.elevation_m, fields.capacity, fields.pace, fields.terrain),
      db.prepare('INSERT INTO participants(ride_id,user_id) VALUES(?,?)').bind(id, user.id)
    ]);
    return json(await detail(db, id, user.id), { status: 201 });
  }
  if (parts[0] === 'rides' && parts[1]) {
    const id = parts[1];
    const ride = await findRide(db, id, user.id);
    const action = parts[2] ?? '';
    const owner = ride.organizer_id === user.id;
    if (!action && method === 'GET') return json(await detail(db, id, user.id));
    if (!action && method === 'PATCH') {
      if (!owner) error(403, 'Hanya penyelenggara yang dapat mengubah jadwal.');
      if (ride.status !== 'upcoming') error(409, 'Jadwal yang ditutup tidak dapat diubah.');
      const fields = rideFields(await body(event));
      await db.prepare(`UPDATE rides SET title=?,description=?,city=?,meeting_point=?,route_url=?,starts_at=?,distance_km=?,elevation_m=?,capacity=?,pace=?,terrain=? WHERE id=? AND organizer_id=?`)
        .bind(fields.title, fields.description, fields.city, fields.meeting_point, fields.route_url, fields.starts_at, fields.distance_km,
          fields.elevation_m, fields.capacity, fields.pace, fields.terrain, id, user.id).run();
      return json(await detail(db, id, user.id));
    }
    if (!action && method === 'DELETE') {
      if (!owner) error(403, 'Hanya penyelenggara yang dapat menghapus jadwal.');
      await db.prepare('DELETE FROM rides WHERE id=? AND organizer_id=?').bind(id, user.id).run();
      return json({ ok: true });
    }
    if (action === 'join' && method === 'POST') {
      await db.prepare('INSERT INTO participants(ride_id,user_id) VALUES(?,?)').bind(id, user.id).run();
      return json(await detail(db, id, user.id));
    }
    if (action === 'join' && method === 'DELETE') {
      if (owner) error(400, 'Penyelenggara otomatis menjadi peserta. Batalkan jadwal untuk menutup gowes.');
      if (ride.status !== 'upcoming' || new Date(ride.starts_at).getTime() <= Date.now()) error(409, 'Keikutsertaan pada jadwal yang sudah dimulai tidak dapat diubah.');
      await db.prepare('DELETE FROM participants WHERE ride_id=? AND user_id=?').bind(id, user.id).run();
      return json(await detail(db, id, user.id));
    }
    if (action === 'status' && method === 'PATCH') {
      if (!owner) error(403, 'Hanya penyelenggara yang dapat menutup jadwal.');
      const status = enumField(await body(event), 'status', ['completed','cancelled']);
      if (ride.status !== 'upcoming') error(409, 'Status jadwal sudah ditutup.');
      if (status === 'completed' && new Date(ride.starts_at).getTime() > Date.now()) error(400, 'Tandai selesai setelah waktu keberangkatan.');
      await db.prepare('UPDATE rides SET status=? WHERE id=? AND organizer_id=? AND status=?').bind(status, id, user.id, 'upcoming').run();
      return json(await detail(db, id, user.id));
    }
    if (action === 'checklist' && method === 'PUT') {
      if (!ride.joined) error(403, 'Gabung gowes untuk menyimpan checklist.');
      const data = await body(event);
      const item = enumField(data, 'item_id', CHECKLIST.map(c => c.id));
      if (typeof data.checked !== 'boolean') error(400, 'Nilai checklist tidak valid.');
      if (data.checked) await db.prepare('INSERT OR IGNORE INTO checklist(ride_id,user_id,item_id) VALUES(?,?,?)').bind(id, user.id, item).run();
      else await db.prepare('DELETE FROM checklist WHERE ride_id=? AND user_id=? AND item_id=?').bind(id, user.id, item).run();
      return json({ ok: true });
    }
    if (action === 'notes' && method === 'POST') {
      if (!ride.joined) error(403, 'Gabung gowes untuk berdiskusi.');
      const note = textField(await body(event), 'body', 1, 1000);
      await db.prepare('INSERT INTO notes(id,ride_id,user_id,body) VALUES(?,?,?,?)').bind(randomUUID(), id, user.id, note).run();
      return json(await detail(db, id, user.id), { status: 201 });
    }
    if (action === 'notes' && parts[3] && method === 'DELETE') {
      const note = await db.prepare('SELECT user_id FROM notes WHERE id=? AND ride_id=?').bind(parts[3], id).first<{user_id:string}>();
      if (!note) error(404, 'Pesan tidak ditemukan.');
      if (note.user_id !== user.id && !owner) error(403, 'Kamu tidak dapat menghapus pesan ini.');
      await db.prepare('DELETE FROM notes WHERE id=? AND ride_id=?').bind(parts[3], id).run();
      return json(await detail(db, id, user.id));
    }
  }
  error(404, 'Endpoint tidak ditemukan.');
}
