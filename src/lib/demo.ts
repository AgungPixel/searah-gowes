import type { Ride, User } from './types';
export const demoUser: User = { id:'preview', name:'Teman Gowes', email:'contoh@searah.local', city:'Bogor', bike_type:'Road bike', bio:'' };
export function demoRides(): Ride[] {
  const base = new Date();
  const nextSaturday = (6 - base.getUTCDay() + 7) % 7 || 7;
  const names = ['Sentul morning loop','Ngopi tipis, gowes santai','Menjemput pagi di Puncak','City ride: keliling Bogor','Gravel & good company','Sunday recovery ride'];
  return names.map((title,i)=> {
    const start = new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()+nextSaturday+i*2, i%2?23:22,0));
    return {
      id:'demo-'+i, title, organizer_id:i===1?'preview':'demo-user-'+i,
      organizer_name:['Raka Pratama','Teman Gowes','Dian Putri','Aditya','Nadia','Raka Pratama'][i],
      description:'Data contoh untuk melihat tampilan planner. Nikmati jalan pagi, berhenti sejenak untuk ngopi, dan pulang dengan cerita baru. No drop ride — kita berangkat dan pulang bareng.',
      city:i===2?'Cisarua':'Bogor', meeting_point:i===0?'Area parkir Sentul City':'Titik kumpul contoh, Bogor',
      route_url:'', starts_at:start.toISOString(), distance_km:[42,18,65,25,38,22][i],
      elevation_m:[380,90,1250,160,420,110][i], pace:i===2?'Moderate':'Santai',
      terrain:i===4?'Gravel':'Road', capacity:[12,10,8,16,10,12][i],
      status:'upcoming', participant_count:[8,5,6,4,7,3][i], joined:i<2?1:0, created_at:Math.floor(Date.now()/1000)
    };
  });
}
