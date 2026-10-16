import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, digest } from '../src/lib/server/auth.ts';
import { ValidationError, rideFields, passwordField, usernameField, optionalEmailField } from '../src/lib/server/validation.ts';
import { toUTC, localInput, dateKey, calendarText } from '../src/lib/format.ts';
import type { Ride } from '../src/lib/types.ts';

const ride = {
  title:'Gowes bareng', description:'Santai, no drop.', city:'Bogor', meeting_point:'Taman kota',
  route_url:'https://maps.google.com/', starts_at:'2028-01-01T23:00:00.000Z',
  distance_km:42, elevation_m:380, capacity:12, pace:'Santai', terrain:'Road'
};

test('passwords use independent salts, preserve whitespace, and need the correct pepper', async()=> {
  const secret='test-secret-'.repeat(4);
  const password='  password panjang sekali  ';
  const one=await hashPassword(password,secret);
  const two=await hashPassword(password,secret);
  assert.notEqual(one,two);
  assert.ok(!one.includes(password));
  assert.equal(await verifyPassword(password,one,secret),true);
  assert.equal(await verifyPassword(password.trim(),one,secret),false);
  assert.equal(await verifyPassword(password,one,secret+'x'),false);
  assert.equal(await verifyPassword(password,'unknown',secret),false);
  assert.equal(digest('session').length,64);
});
test('ride validation rejects unsafe URLs, invalid dates and impossible capacities', ()=> {
  const now=new Date('2027-06-01T00:00:00Z').getTime();
  assert.equal(rideFields(ride,now).starts_at,ride.starts_at);
  for(const changes of [
    {route_url:'javascript:alert(1)'},{route_url:'https://username:password@example.com'},
    {starts_at:'2020-01-01T00:00:00Z'},{starts_at:'not-a-date-not-a-date!'},{capacity:1},
    {capacity:2.5},{distance_km:NaN},{pace:'Reckless'}
  ]) assert.throws(()=>rideFields({...ride,...changes},now),ValidationError);
  assert.throws(()=>passwordField({password:'short'}),ValidationError);
});
test('WIB date conversion works regardless of computer timezone', ()=> {
  assert.equal(toUTC('2026-10-18T06:00'),'2026-10-17T23:00:00.000Z');
  assert.equal(localInput('2026-10-17T23:00:00.000Z'),'2026-10-18T06:00');
  assert.equal(dateKey('2026-10-17T23:00:00Z'),'2026-10-18');
});
test('usernames are normalized and emails can be added or removed without fake addresses', ()=> {
  assert.equal(usernameField({username:'  Agung_Gowes  '}),'agung_gowes');
  for(const username of ['ab','nama dengan spasi','@agung','agung@email.test','a'.repeat(33),'agung🚲'])
    assert.throws(()=>usernameField({username}),ValidationError);
  assert.equal(optionalEmailField({email:''}),null);
  assert.equal(optionalEmailField({email:'   '}),null);
  assert.equal(optionalEmailField({email:null}),null);
  assert.equal(optionalEmailField({email:' AGUNG@example.test '}),'agung@example.test');
  for(const email of ['invalid',42,undefined])assert.throws(()=>optionalEmailField({email}),ValidationError);
});
test('calendar export escapes event text and folds Unicode at 75 bytes', ()=> {
  const value=calendarText({...ride,id:'ride-test',title:'Gowes, pagi; bareng',description:'Cerita\n'+('🚲'.repeat(70))} as Ride);
  assert.ok(value.includes('SUMMARY:Gowes\\, pagi\\; bareng'));
  assert.ok(value.includes('DTSTART:20280101T230000Z'));
  assert.ok(value.includes('Cerita\\n'));
  assert.ok(value.endsWith('END:VCALENDAR\r\n'));
  for(const line of value.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
});
