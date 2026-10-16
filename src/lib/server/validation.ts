export class ValidationError extends Error {}
export function textField(data: Record<string, unknown>, key: string, min: number, max: number) {
  if (typeof data[key] !== 'string') throw new ValidationError(`Kolom ${key} perlu diisi.`);
  const value = (data[key] as string).trim();
  if (value.length < min || value.length > max) throw new ValidationError(`Kolom ${key} harus ${min}–${max} karakter.`);
  return value;
}
export function numberField(data: Record<string, unknown>, key: string, min: number, max: number, integer = false) {
  const value = data[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new ValidationError(`Nilai ${key} harus antara ${min} dan ${max}.`);
  return value;
}
export function enumField(data: Record<string, unknown>, key: string, options: string[]) {
  const value = textField(data, key, 1, 30);
  if (!options.includes(value)) throw new ValidationError(`Pilihan ${key} tidak valid.`);
  return value;
}
export function emailField(data: Record<string, unknown>) {
  const email = textField(data, 'email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Alamat email belum valid.');
  return email;
}
export function optionalEmailField(data: Record<string, unknown>) {
  if (data.email === null || (typeof data.email === 'string' && data.email.trim() === '')) return null;
  return emailField(data);
}
export function usernameField(data: Record<string, unknown>) {
  if (typeof data.username !== 'string') throw new ValidationError('Isi username untuk akunmu.');
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))
    throw new ValidationError('Username harus 3–32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung. Awali dengan huruf atau angka.');
  return username;
}
export function passwordField(data: Record<string, unknown>) {
  const password = data.password;
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new ValidationError('Password harus 12–128 karakter.');
  return password;
}
export function rideFields(data: Record<string, unknown>, now = Date.now()) {
  const startsAt = textField(data, 'starts_at', 20, 30);
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start) || start <= now || start > now + 2 * 366 * 86400000)
    throw new ValidationError('Pilih waktu keberangkatan mendatang, maksimal 2 tahun.');
  const route = textField(data, 'route_url', 0, 600);
  if (route) {
    try {
      const parsed = new URL(route);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
    } catch { throw new ValidationError('Tautan rute harus URL https yang valid.'); }
  }
  return {
    title: textField(data, 'title', 3, 100), description: textField(data, 'description', 0, 2000),
    city: textField(data, 'city', 2, 80), meeting_point: textField(data, 'meeting_point', 3, 200),
    route_url: route, starts_at: new Date(start).toISOString(),
    distance_km: numberField(data, 'distance_km', 1, 1000),
    elevation_m: numberField(data, 'elevation_m', 0, 20000, true),
    capacity: numberField(data, 'capacity', 2, 200, true),
    pace: enumField(data, 'pace', ['Santai', 'Moderate', 'Ngebut']),
    terrain: enumField(data, 'terrain', ['Road', 'Gravel', 'MTB', 'Campuran'])
  };
}
