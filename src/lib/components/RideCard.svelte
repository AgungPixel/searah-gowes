<script lang="ts">
  import type { Ride } from '$lib/types';
  import Icon from './Icon.svelte';
  import RouteArt from './RouteArt.svelte';
  import { dateLabel, timeLabel, initials, isUpcoming } from '$lib/format';
  let { ride, index = 0, onclick }: {ride:Ride;index?:number;onclick:()=>void} = $props();
</script>
<button class="ride-card" {onclick} aria-label={'Lihat '+ride.title}>
  <div class="ride-cover"><RouteArt compact variant={index%3}/><span class="terrain-badge"><Icon name={ride.terrain==='MTB'?'mountain':'route'} size={13}/>{ride.terrain}</span><span class="card-date">{dateLabel(ride.starts_at,true)}</span></div>
  <div class="ride-card-content">
    <div class="flex items-center gap-2"><span class:pace-santai={ride.pace==='Santai'} class="pace-badge">{ride.pace}</span>{#if ride.joined}<span class="joined-badge"><Icon name="check" size={12}/>Terdaftar</span>{/if}{#if !isUpcoming(ride)}<span class="muted text-xs">{ride.status==='cancelled'?'Dibatalkan':ride.status==='completed'?'Selesai':'Sudah dimulai'}</span>{/if}</div>
    <h3>{ride.title}</h3><p class="card-location"><Icon name="pin" size={14}/>{ride.city}<span>·</span>{timeLabel(ride.starts_at)}</p>
    <div class="ride-metrics"><span><Icon name="route" size={15}/><strong>{ride.distance_km}</strong> km</span><span><Icon name="mountain" size={15}/><strong>{ride.elevation_m}</strong> m</span><span><Icon name="users" size={15}/><strong>{ride.participant_count}</strong>/{ride.capacity}</span></div>
    <div class="ride-card-footer"><span class="organizer"><span class="avatar tiny">{initials(ride.organizer_name)}</span>{ride.organizer_name}</span><span class="card-arrow"><Icon name="arrow" size={17}/></span></div>
  </div>
</button>
