// This command ONLY uses getPlatformProxy's local D1. It never seeds production.
import { spawnSync } from 'node:child_process';
import { getPlatformProxy } from 'wrangler';
import { hashPassword } from '../src/lib/server/auth.ts';
const setup=spawnSync(process.execPath,['scripts/local-setup.mjs'],{stdio:'inherit'});
if(setup.status!==0)process.exit(setup.status??1);
const proxy=await getPlatformProxy({configPath:'wrangler.jsonc'});
try{
  const db=proxy.env.DB;
  const passwordHash=await hashPassword('GowesBareng!2026',proxy.env.AUTH_SECRET);
  const people=[['contoh-owner','Teman Gowes','demogowes'],['contoh-raka','Raka Pratama','rakagowes'],['contoh-dian','Dian Putri','diangowes']];
  for(const [id,name,username]of people)await db.prepare(`INSERT INTO users(id,account_key,name,username,password_hash,city,bike_type) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,username=COALESCE(users.username,excluded.username)`)
    .bind(id,id,name,username,passwordHash,'Bogor','Road bike').run();
  const titles=['Sentul morning loop','Ngopi tipis, gowes santai','Menjemput pagi di Puncak','City ride: keliling Bogor'];
  for(let i=0;i<titles.length;i++){
    const id='contoh-ride-'+i;
    if(await db.prepare('SELECT id FROM rides WHERE id=?').bind(id).first())continue;
    const start=new Date(Date.now()+(i+2)*86400000);start.setUTCHours(23,0,0,0);
    const owner=people[i%3][0];
    await db.batch([
      db.prepare(`INSERT INTO rides(id,organizer_id,title,description,city,meeting_point,route_url,starts_at,distance_km,elevation_m,pace,terrain,capacity)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,owner,titles[i],'DATA CONTOH LOKAL. Rencana ini untuk mencoba fitur planner.','Bogor','Titik kumpul contoh, Bogor','',start.toISOString(),[42,18,65,25][i],[380,90,1250,160][i],i===2?'Moderate':'Santai','Road',12),
      db.prepare('INSERT INTO participants(ride_id,user_id) VALUES(?,?)').bind(id,owner)
    ]);
    for(const [pid]of people)if(pid!==owner)await db.prepare('INSERT INTO participants(ride_id,user_id) VALUES(?,?)').bind(id,pid).run();
  }
  console.log('\nData contoh lokal siap.\nUsername: demogowes\nPassword: GowesBareng!2026\nJalankan npm run dev untuk membuka planner.');
}finally{await proxy.dispose();}
