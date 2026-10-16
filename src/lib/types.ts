export interface User {
  id: string; name: string; username: string | null; email: string | null; city: string; bike_type: string; bio: string;
}
export interface Ride {
  id: string; organizer_id: string; organizer_name: string; title: string;
  description: string; city: string; meeting_point: string; route_url: string;
  starts_at: string; distance_km: number; elevation_m: number; pace: string;
  terrain: string; capacity: number; status: 'upcoming' | 'completed' | 'cancelled';
  participant_count: number; joined: number; created_at: number;
}
export interface Participant { id: string; name: string; city: string; bike_type: string }
export interface RideNote { id: string; user_id: string; name: string; body: string; created_at: number }
export interface RideDetail { ride: Ride; participants: Participant[]; checklist: string[]; notes: RideNote[] }
export const CHECKLIST = [
  { id: 'helmet', label: 'Helm & perlengkapan' },
  { id: 'bike', label: 'Cek rem, ban & rantai' },
  { id: 'water', label: 'Air minum & camilan' },
  { id: 'repair', label: 'Ban cadangan & alat' },
  { id: 'money', label: 'Uang & identitas' }
];
