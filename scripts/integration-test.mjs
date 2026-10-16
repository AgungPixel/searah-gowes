// Exercise the actual production Worker and a fresh D1; no preview server is started.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash, createHmac, scrypt } from 'node:crypto';

const root=resolve('.svelte-kit/cloudflare');
assert.ok(existsSync(root+'/_worker.js'),'Run npm run build first.');
const bundled=await build({entryPoints:[root+'/_worker.js'],bundle:true,write:false,format:'esm',platform:'browser',external:['node:*','cloudflare:*']});
const mf=new Miniflare(convertV4MiniflareOptions({
  name:'searah-integration',
  modules:true,
  script:bundled.outputFiles[0].text,
  compatibilityDate:'2026-10-01',
  compatibilityFlags:['nodejs_compat'],
  d1Databases:['DB'],
  bindings:{AUTH_SECRET:'integration-test-only-secret-never-used-in-production'},
  serviceBindings:{ASSETS:()=>new Response('asset',{status:200})}
}));
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('✓ '+name);};
const origin='https://searah.test';
function client(){
  let cookie='';
  return {
    get cookie(){return cookie;},
    async request(path,method='GET',body,expected=200,extra={}){
      const headers={origin,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...extra};
      const response=await mf.dispatchFetch(origin+'/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined});
      const data=await response.json();
      assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);
      if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
      return {data,response};
    }
  };
}
try{
  const db=await mf.getD1Database('DB');
  // Keep each CREATE TRIGGER intact, including its nested CASE ... END clauses.
  const schema=readFileSync('migrations/0001_initial.sql','utf8').replace(/^--.*$/gm,'').trim();
  const statements=schema.match(/CREATE TRIGGER[\s\S]*?END;(?=\s*(?:CREATE|$))|CREATE (?:TABLE|INDEX)[\s\S]*?;/g);
  for(const statement of statements)await db.prepare(statement).run();
  // Start with real v1-shaped data to catch accidental FK cascades during upgrade.
  const legacySecret='integration-test-only-secret-never-used-in-production';
  const legacySalt='2'.repeat(32);
  const legacyKey=await new Promise((resolve,reject)=>scrypt(createHmac('sha256',legacySecret).update('Password akun lama 2026!').digest(),legacySalt,32,{N:16384,r:8,p:5,maxmem:64*1024*1024},(err,key)=>err?reject(err):resolve(key)));
  const legacyHash=`scrypt-v1$${legacySalt}$${legacyKey.toString('hex')}`;
  const legacyToken='a'.repeat(64);
  await db.prepare('INSERT INTO users(id,name,email,password_hash,city) VALUES(?,?,?,?,?)').bind('legacy-user','Anggota Lama','lama@example.test',legacyHash,'Bogor').run();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(createHash('sha256').update(legacyToken).digest('hex'),'legacy-user',Math.floor(Date.now()/1000)+86400).run();
  await db.prepare(`INSERT INTO rides(id,organizer_id,title,city,meeting_point,starts_at,distance_km,pace,terrain,capacity)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).bind('legacy-ride','legacy-user','Gowes sebelum update','Bogor','Taman kota',new Date(Date.now()+172800000).toISOString(),20,'Santai','Road',5).run();
  await db.prepare('INSERT INTO participants(ride_id,user_id) VALUES(?,?)').bind('legacy-ride','legacy-user').run();
  await db.prepare('INSERT INTO checklist(ride_id,user_id,item_id) VALUES(?,?,?)').bind('legacy-ride','legacy-user','helmet').run();
  await db.prepare('INSERT INTO notes(id,ride_id,user_id,body) VALUES(?,?,?,?)').bind('legacy-note','legacy-ride','legacy-user','Pesan sebelum migrasi.').run();
  const upgrade=readFileSync('migrations/0002_username_optional_email.sql','utf8').replace(/^--.*$/gm,'');
  await test('Upgrade preserves existing accounts, hashes, sessions and all ride relationships',async()=>{
    // One transactional batch, matching Wrangler's migration transaction.
    await db.batch(upgrade.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    const old=await db.prepare('SELECT * FROM users WHERE id=?').bind('legacy-user').first();
    assert.equal(old.password_hash,legacyHash);assert.equal(old.email,'lama@example.test');assert.equal(old.username,null);assert.equal(old.account_key,'legacy-user');
    for(const table of ['users','sessions','rides','participants','checklist','notes']){
      const row=await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first();assert.equal(row.n,1,table+' data must survive');
    }
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  });
  const owner=client(),one=client(),two=client(),guest=client();
  await test('Guest cannot write data; forged cross-site requests are rejected',async()=>{
    await guest.request('rides','POST',{},401);
    await guest.request('auth/register','POST',{name:'Bad origin'},403,{origin:'https://other.test'});
    const {data}=await guest.request('bootstrap');assert.equal(data.user,null);assert.deepEqual(data.rides,[]);
  });
  await test('Register multiple accounts without email; cookie is HttpOnly, Secure, SameSite=Lax',async()=>{
    for(const [account,name,username] of [[owner,'Penyelenggara','owner'],[one,'Peserta satu','one'],[two,'Peserta dua','two']]){
      const {data,response}=await account.request('auth/register','POST',{name,username,password:'Gowes bareng aman 2026!'},201);
      assert.equal(data.user.username,username);assert.equal(data.user.email,null);assert.equal(data.user.password_hash,undefined);assert.equal(data.user.account_key,undefined);
      const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);assert.match(setCookie,/SameSite=Lax/i);
    }
  });
  await test('Usernames reject invalid input, stay unique ignoring case, and support mixed-case login',async()=>{
    const account=client();
    await account.request('auth/register','POST',{name:'Duplicate',username:'OWNER',password:'Gowes bareng aman 2026!'},409);
    await account.request('auth/register','POST',{name:'Invalid',username:'nama dengan spasi',password:'Gowes bareng aman 2026!'},400);
    const {data}=await account.request('auth/login','POST',{username:'  OnE  ',password:'Gowes bareng aman 2026!'});assert.equal(data.user.username,'one');
  });
  await test('Optional profile email can be added, validated and removed; username remains the login identity',async()=>{
    const profile={name:'Peserta satu',username:'one',email:' ONE@example.test ',city:'Bogor',bike_type:'Road bike',bio:''};
    let {data}=await one.request('profile','PATCH',profile);assert.equal(data.user.email,'one@example.test');
    ({data}=await one.request('bootstrap'));assert.equal(data.user.email,'one@example.test');
    await two.request('profile','PATCH',{...profile,name:'Peserta dua',username:'two'},409);
    await one.request('profile','PATCH',{...profile,email:'not-valid'},400);
    await one.request('profile','PATCH',{...profile,username:'OwNeR'},409);
    const fresh=client();await fresh.request('auth/login','POST',{username:'one@example.test',password:'Gowes bareng aman 2026!'},401);
    ({data}=await one.request('profile','PATCH',{...profile,email:''}));assert.equal(data.user.email,null);assert.equal(data.user.username,'one');
    ({data}=await fresh.request('auth/login','POST',{username:'one',password:'Gowes bareng aman 2026!'}));assert.equal(data.user.email,null);
  });
  await test('Old sessions and email login work until an existing member chooses a username',async()=>{
    const legacy=client();
    let {data}=await guest.request('bootstrap','GET',undefined,200,{cookie:'gowes_session='+legacyToken});assert.equal(data.user.id,'legacy-user');assert.equal(data.user.username,null);
    ({data}=await legacy.request('auth/login','POST',{email:'lama@example.test',password:'Password akun lama 2026!'}));assert.equal(data.user.id,'legacy-user');
    const second=client();await second.request('auth/login','POST',{username:'LAMA@example.test',password:'Password akun lama 2026!'});
    ({data}=await legacy.request('profile','PATCH',{name:'Anggota Lama',username:'agung_lama',email:'',city:'Bogor',bike_type:'Road bike',bio:''}));assert.equal(data.user.username,'agung_lama');assert.equal(data.user.email,null);
    await second.request('auth/login','POST',{username:'lama@example.test',password:'Password akun lama 2026!'},401);
    await second.request('auth/login','POST',{username:'agung_lama',password:'Password akun lama 2026!'});
    ({data}=await second.request('rides/legacy-ride'));assert.equal(data.ride.joined,1);assert.deepEqual(data.checklist,['helmet']);assert.equal(data.notes[0].body,'Pesan sebelum migrasi.');
    const stored=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind('legacy-user').first();assert.equal(stored.password_hash,legacyHash);
  });
  let id;
  const draft={title:'Integration morning ride',description:'No drop.',city:'Bogor',meeting_point:'Taman kota',route_url:'https://maps.google.com/',starts_at:new Date(Date.now()+86400000).toISOString(),distance_km:42,elevation_m:380,capacity:2,pace:'Santai',terrain:'Road'};
  await test('Create trip atomically with organizer as first participant',async()=>{
    const {data}=await owner.request('rides','POST',draft,201);id=data.ride.id;
    assert.equal(data.ride.participant_count,1);assert.equal(data.ride.joined,1);assert.equal(data.participants.length,1);
    await owner.request('rides/'+id+'/status','PATCH',{status:'completed'},400);
    await one.request('rides/'+id,'PATCH',{...draft,title:'Unauthorized edit'},403);
    await one.request('rides/'+id,'DELETE',undefined,403);
    await one.request('rides/'+id+'/checklist','PUT',{item_id:'water',checked:true},403);
  });
  await test('Concurrent registration for the last seat cannot overbook D1',async()=>{
    const responses=await Promise.all([one,two].map(account=>mf.dispatchFetch(origin+'/api/rides/'+id+'/join',{method:'POST',headers:{origin,cookie:account.cookie}})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    for(const response of responses)await response.text();
    const {data}=await owner.request('rides/'+id);assert.equal(data.ride.participant_count,2);
  });
  let participant,outsider;
  {const {data}=await one.request('rides/'+id);participant=data.ride.joined?one:two;outsider=data.ride.joined?two:one;}
  await test('Private checklists persist per account; outsiders cannot post notes',async()=>{
    await participant.request('rides/'+id+'/checklist','PUT',{item_id:'water',checked:true});
    let {data}=await participant.request('rides/'+id);assert.deepEqual(data.checklist,['water']);
    ({data}=await owner.request('rides/'+id));assert.deepEqual(data.checklist,[]);
    await outsider.request('rides/'+id+'/notes','POST',{body:'Not allowed'},403);
    ({data}=await participant.request('rides/'+id+'/notes','POST',{body:'Sampai di titik kumpul!'},201));
    assert.equal(data.notes[0].body,'Sampai di titik kumpul!');
    await outsider.request('rides/'+id+'/notes/'+data.notes[0].id,'DELETE',undefined,403);
    await owner.request('rides/'+id+'/notes/'+data.notes[0].id,'DELETE');
  });
  await test('Capacity cannot drop below participants; leaving frees the seat and checklist',async()=>{
    await owner.request('rides/'+id,'PATCH',{...draft,capacity:1},400);
    await owner.request('rides/'+id,'PATCH',{...draft,capacity:3});
    await outsider.request('rides/'+id+'/join','POST');
    await owner.request('rides/'+id,'PATCH',{...draft,capacity:2},409);
    await outsider.request('rides/'+id+'/join','DELETE');
    await owner.request('rides/'+id,'PATCH',{...draft,title:'Updated morning ride'});
    await participant.request('rides/'+id+'/join','DELETE');
    const {data}=await outsider.request('rides/'+id+'/join','POST');assert.equal(data.ride.participant_count,2);
    const checks=await db.prepare('SELECT COUNT(*) n FROM checklist WHERE ride_id=?').bind(id).first();assert.equal(checks.n,0);
    await owner.request('rides/'+id+'/join','DELETE',undefined,400);
  });
  await test('Profile survives reload; changing password revokes other device sessions',async()=>{
    const secondDevice=client();
    await secondDevice.request('auth/login','POST',{username:'owner',password:'Gowes bareng aman 2026!'});
    await owner.request('profile','PATCH',{name:'Pemilik Gowes',city:'Bogor',bike_type:'Gravel',bio:'Suka rute baru.'});
    let {data}=await secondDevice.request('bootstrap');assert.equal(data.user.name,'Pemilik Gowes');
    await owner.request('auth/password','PATCH',{current_password:'Gowes bareng aman 2026!',password:'  Kata sandi baru 2026!  '});
    ({data}=await secondDevice.request('bootstrap'));assert.equal(data.user,null);
    const fresh=client();await fresh.request('auth/login','POST',{username:'owner',password:'  Kata sandi baru 2026!  '});
  });
  await test('Cancellation closes joins; deletion cascades to participants and discussion',async()=>{
    await owner.request('rides/'+id+'/status','PATCH',{status:'cancelled'});
    await participant.request('rides/'+id+'/join','POST',undefined,409);
    await owner.request('rides/'+id,'DELETE');
    await owner.request('rides/'+id,'GET',undefined,404);
    const count=await db.prepare('SELECT COUNT(*) n FROM participants WHERE ride_id=?').bind(id).first();assert.equal(count.n,0);
  });
  await test('Departure closes registration; organizer can complete a past ride',async()=>{
    const {data:created}=await owner.request('rides','POST',{...draft,title:'Trip to complete'},201);
    const trip=created.ride.id;
    await db.prepare('UPDATE rides SET starts_at=? WHERE id=?').bind(new Date(Date.now()-3600000).toISOString(),trip).run();
    await one.request('rides/'+trip+'/join','POST',undefined,409);
    const {data}=await owner.request('rides/'+trip+'/status','PATCH',{status:'completed'});
    assert.equal(data.ride.status,'completed');assert.equal(data.ride.distance_km,42);
    await owner.request('rides/'+trip,'PATCH',draft,409);
  });
  await test('Logout invalidates database session; repeated failed login is rate limited',async()=>{
    const oldCookie=owner.cookie;await owner.request('auth/logout','POST');
    const {data}=await guest.request('bootstrap','GET',undefined,200,{cookie:oldCookie});assert.equal(data.user,null);
    for(let i=0;i<10;i++)await guest.request('auth/login','POST',{username:'missing_member',password:'Incorrect password'},401);
    await guest.request('auth/login','POST',{username:'missing_member',password:'Incorrect password'},429);
  });
  console.log(`\n${checks} integration scenarios passed against the production Worker and D1.`);
}finally{await mf.dispose();}
