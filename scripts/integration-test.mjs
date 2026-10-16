// Exercise the actual production Worker and a fresh D1; no preview server is started.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

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
  const owner=client(),one=client(),two=client(),guest=client();
  await test('Guest cannot write data; forged cross-site requests are rejected',async()=>{
    await guest.request('rides','POST',{},401);
    await guest.request('auth/register','POST',{name:'Bad origin'},403,{origin:'https://other.test'});
    const {data}=await guest.request('bootstrap');assert.equal(data.user,null);assert.deepEqual(data.rides,[]);
  });
  await test('Register real accounts; session cookie is HttpOnly, Secure, SameSite=Lax',async()=>{
    for(const [account,name,email] of [[owner,'Penyelenggara','owner@example.test'],[one,'Peserta satu','one@example.test'],[two,'Peserta dua','two@example.test']]){
      const {data,response}=await account.request('auth/register','POST',{name,email,password:'Gowes bareng aman 2026!'},201);
      assert.equal(data.user.email,email);assert.equal(data.user.password_hash,undefined);
      const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);assert.match(setCookie,/SameSite=Lax/i);
    }
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
    await secondDevice.request('auth/login','POST',{email:'owner@example.test',password:'Gowes bareng aman 2026!'});
    await owner.request('profile','PATCH',{name:'Pemilik Gowes',city:'Bogor',bike_type:'Gravel',bio:'Suka rute baru.'});
    let {data}=await secondDevice.request('bootstrap');assert.equal(data.user.name,'Pemilik Gowes');
    await owner.request('auth/password','PATCH',{current_password:'Gowes bareng aman 2026!',password:'  Kata sandi baru 2026!  '});
    ({data}=await secondDevice.request('bootstrap'));assert.equal(data.user,null);
    const fresh=client();await fresh.request('auth/login','POST',{email:'owner@example.test',password:'  Kata sandi baru 2026!  '});
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
    for(let i=0;i<10;i++)await guest.request('auth/login','POST',{email:'missing@example.test',password:'Incorrect password'},401);
    await guest.request('auth/login','POST',{email:'missing@example.test',password:'Incorrect password'},429);
  });
  console.log(`\n${checks} integration scenarios passed against the production Worker and D1.`);
}finally{await mf.dispose();}
