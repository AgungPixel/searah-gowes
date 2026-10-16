import type { Ride } from './types';
export const TIME_ZONE = 'Asia/Jakarta';
export const dateLabel = (value: string, short = false) => new Intl.DateTimeFormat('id-ID', {
  timeZone: TIME_ZONE, weekday: short ? undefined : 'long', day: 'numeric', month: short ? 'short' : 'long'
}).format(new Date(value));
export const timeLabel = (value: string) => new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) + ' WIB';
export const dateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value));
export const localInput = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value));
  return parts.replace(' ', 'T');
};
export const toUTC = (value: string) => new Date(value + ':00+07:00').toISOString();
export const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
export const isUpcoming = (ride: Ride) => ride.status === 'upcoming' && new Date(ride.starts_at).getTime() > Date.now();
export const calendarText = (ride: Ride) => {
  const escape = (s: string) => s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  const start = new Date(ride.starts_at);
  const speed = ride.pace === 'Santai' ? 15 : ride.pace === 'Moderate' ? 22 : 28;
  const end = new Date(start.getTime() + (ride.distance_km/speed+0.5)*3600000);
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Searah//Gowes Planner//ID','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${ride.id}@searah.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escape(ride.title)}`,`LOCATION:${escape(ride.meeting_point+', '+ride.city)}`,`DESCRIPTION:${escape(ride.description+'\n'+ride.route_url+'\nWaktu selesai adalah estimasi dari jarak dan pace.')}`,'END:VEVENT','END:VCALENDAR'];
  // Fold UTF-8 lines at 75 octets according to RFC 5545.
  return lines.map(line => {
    let folded='', length=0;
    for(const char of line) { const size=new TextEncoder().encode(char).length; if(length+size>75){folded+='\r\n ';length=1;} folded+=char;length+=size; }
    return folded;
  }).join('\r\n')+'\r\n';
};
