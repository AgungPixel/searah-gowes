<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import RouteArt from '$lib/components/RouteArt.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import RideCard from '$lib/components/RideCard.svelte';
  import { CHECKLIST, type User, type Ride, type RideDetail } from '$lib/types';
  import { dateLabel, timeLabel, dateKey, localInput, toUTC, initials, isUpcoming, calendarText } from '$lib/format';
  import { demoUser, demoRides } from '$lib/demo';

  let user = $state<User | null>(null);
  let rides = $state<Ride[]>([]);
  let loading = $state(true);
  let bootError = $state('');
  let isDemo = $state(false);
  let view = $state('dashboard');
  let mobileNav = $state(false);
  let search = $state('');
  let paceFilter = $state('Semua pace');
  let terrainFilter = $state('Semua medan');
  let scope = $state('upcoming');
  let plannerTab = $state('joined');
  let authMode = $state('login');
  let authOverlay = $state(false);
  let authName = $state('');
  let authUsername = $state('');
  let authPassword = $state('');
  let authError = $state('');
  let authBusy = $state(false);
  let showPassword = $state(false);
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout>;
  let detail = $state<RideDetail | null>(null);
  let detailLoading = $state(false);
  let detailError = $state('');
  let detailOpen = $state(false);
  let actionBusy = $state(false);
  let checklistBusy = $state(false);
  let note = $state('');
  let formOpen = $state(false);
  let editing = $state<string | null>(null);
  let formBusy = $state(false);
  let formError = $state('');
  let confirmAction = $state<'delete' | 'cancel' | 'complete' | 'leave' | null>(null);
  let draft = $state(emptyDraft());
  let profileName = $state('');
  let profileUsername = $state('');
  let profileEmail = $state('');
  let profileCity = $state('');
  let profileBike = $state('Road bike');
  let profileBio = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let profileBusy = $state(false);
  let passwordBusy = $state(false);
  let profileError = $state('');
  let passwordError = $state('');
  const today = new Date();
  const todayWIB = new Intl.DateTimeFormat('sv-SE',{ timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit' }).format(today);
  let calendarYear = $state(Number(todayWIB.slice(0,4)));
  let calendarMonth = $state(Number(todayWIB.slice(5,7))-1);
  let selectedDay = $state('');
  let clock = $state(Date.now());

  const nav = [ {id:'dashboard',icon:'grid',label:'Ringkasan'}, {id:'explore',icon:'compass',label:'Jelajahi gowes'}, {id:'planner',icon:'route',label:'Gowes saya'}, {id:'calendar',icon:'calendar',label:'Kalender'} ];
  const upcoming = $derived(rides.filter(r=>r.status==='upcoming'&&new Date(r.starts_at).getTime()>clock).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));
  const joinedUpcoming = $derived(upcoming.filter(r=>r.joined));
  const completed = $derived(rides.filter(r=>r.joined&&r.status==='completed'));
  const totalDistance = $derived(completed.reduce((sum,r)=>sum+r.distance_km,0));
  const featured = $derived(joinedUpcoming[0] || upcoming[0]);
  const visibleRides = $derived((view==='planner' ? rides.filter(r=>plannerTab==='organizing'?r.organizer_id===user?.id:!!r.joined) : rides)
    .filter(r=>scope==='all'||(scope==='completed'?r.status==='completed':r.status==='upcoming'&&new Date(r.starts_at).getTime()>clock))
    .filter(r=>(r.title+' '+r.city+' '+r.organizer_name).toLowerCase().includes(search.toLowerCase()))
    .filter(r=>paceFilter==='Semua pace'||r.pace===paceFilter)
    .filter(r=>terrainFilter==='Semua medan'||r.terrain===terrainFilter)
    .sort((a,b)=>scope==='completed'?b.starts_at.localeCompare(a.starts_at):a.starts_at.localeCompare(b.starts_at)));
  const days = $derived.by(()=> {
    const first = new Date(Date.UTC(calendarYear,calendarMonth,1));
    const offset = (first.getUTCDay()+6)%7;
    return Array.from({length:42},(_,i)=> {
      const day = new Date(Date.UTC(calendarYear,calendarMonth,1-offset+i,5));
      return {key:dateKey(day),day:day.getUTCDate(),current:day.getUTCMonth()===calendarMonth};
    });
  });
  const monthLabel = $derived(new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(calendarYear,calendarMonth,1))));
  const calendarRides = $derived(rides.filter(r=>r.joined&&r.status!=='cancelled').sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));
  const dayRides = $derived(calendarRides.filter(r=>dateKey(r.starts_at)===(selectedDay||todayWIB)));

  function notify(message:string) { toast=message; clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast='',4500); }
  function emptyDraft() {
    const tomorrow = new Date(Date.now()+86400000);
    return { title:'', description:'', city:'', meeting_point:'', route_url:'', starts_at:localInput(tomorrow).slice(0,10)+'T06:00', distance_km:25, elevation_m:0, capacity:12, pace:'Santai', terrain:'Road' };
  }
  async function api<T = {ok: boolean}>(path:string,method='GET',payload?:unknown):Promise<T> {
    if(isDemo&&method!=='GET') throw new Error('Ini mode demo. Masuk dengan akun untuk menyimpan perubahan.');
    const response=await fetch('/api/'+path,{method,headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined});
    const result=await response.json().catch(()=>({error:'Server belum bisa dihubungi.'}));
    if(!response.ok) {
      if(response.status===401&&user&&!isDemo){user=null;detailOpen=false;formOpen=false;}
      throw new Error((result as {error?:string}).error||'Terjadi kesalahan. Silakan coba lagi.');
    }
    return result as T;
  }
  async function boot() {
    loading=true;bootError='';
    try { const result=await api<{user:User|null;rides:Ride[]}>('bootstrap');user=result.user;rides=result.rides;fillProfile(); }
    catch(err) { bootError=(err as Error).message; }
    finally { loading=false; }
  }
  function fillProfile() { if(user){profileName=user.name;profileUsername=user.username||'';profileEmail=user.email||'';profileCity=user.city;profileBike=user.bike_type;profileBio=user.bio;} }
  onMount(()=> {
    void boot().then(()=> {const id=new URLSearchParams(location.search).get('ride');if(id&&user)void openDetail(id);});
    const timer=setInterval(()=>clock=Date.now(),30000);
    const refresh=()=>{if(document.visibilityState==='visible'&&user&&!isDemo)void refreshRides().catch(()=>{});};
    document.addEventListener('visibilitychange',refresh);
    return ()=>{clearInterval(timer);clearTimeout(toastTimer);document.removeEventListener('visibilitychange',refresh);};
  });
  function navigate(id:string) {view=id;mobileNav=false;search='';paceFilter='Semua pace';terrainFilter='Semua medan';scope='upcoming';if(id==='profile')fillProfile();}
  function launchDemo() { isDemo=true;user={...demoUser};rides=demoRides();bootError='';fillProfile(); }
  async function authenticate(event:SubmitEvent) {
    event.preventDefault();authBusy=true;authError='';
    try {
      // Authentication always uses the real endpoint, including when leaving demo mode.
      const response=await fetch('/api/auth/'+(authMode==='register'?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:authName,username:authUsername,password:authPassword})});
      const result=await response.json() as {user:User;error?:string};if(!response.ok)throw new Error(result.error);
      isDemo=false;user=result.user;authPassword='';authOverlay=false;detailOpen=false;detail=null;await refreshRides();fillProfile();navigate('dashboard');
      const id=new URLSearchParams(location.search).get('ride');if(id)await openDetail(id);
      notify(authMode==='register'?'Akun siap. Yuk, rencanakan gowes pertama!':'Selamat datang kembali.');
    }catch(err){authError=(err as Error).message;}finally{authBusy=false;}
  }
  async function logout() {
    try {if(!isDemo)await api('auth/logout','POST');isDemo=false;user=null;rides=[];detailOpen=false;navigate('dashboard');notify('Kamu sudah keluar. Sampai di gowes berikutnya!');}
    catch(err){notify((err as Error).message);}
  }
  async function refreshRides() {if(isDemo)return;const result=await api<{user:User|null;rides:Ride[]}>('bootstrap');user=result.user;rides=result.rides;clock=Date.now();}
  async function openDetail(id:string) {
    detailOpen=true;detailLoading=true;detailError='';note='';confirmAction=null;detail=null;
    try {
      if(isDemo){const ride=rides.find(r=>r.id===id)!;detail={ride,participants:[{id:ride.organizer_id,name:ride.organizer_name,city:ride.city,bike_type:'Road bike'}],checklist:[],notes:[]};}
      else detail=await api<RideDetail>('rides/'+id);
    }catch(err){detailError=(err as Error).message;}finally{detailLoading=false;}
  }
  function openCreate() {
    if(isDemo){authOverlay=true;return;}
    editing=null;draft=emptyDraft();draft.city=user?.city||'';formError='';formOpen=true;
  }
  function editRide() {
    if(!detail)return;
    const r=detail.ride;editing=r.id;
    draft={title:r.title,description:r.description,city:r.city,meeting_point:r.meeting_point,route_url:r.route_url,starts_at:localInput(r.starts_at),distance_km:r.distance_km,elevation_m:r.elevation_m,capacity:r.capacity,pace:r.pace,terrain:r.terrain};
    detailOpen=false;formError='';formOpen=true;
  }
  async function saveRide(event:SubmitEvent) {
    event.preventDefault();formError='';formBusy=true;
    try {const result=await api<RideDetail>('rides'+(editing?'/'+editing:''),editing?'PATCH':'POST',{...draft,starts_at:toUTC(draft.starts_at)});await refreshRides();formOpen=false;detail=result;detailOpen=true;notify(editing?'Jadwal diperbarui.':'Gowes berhasil dibuat. Ajak temanmu!');}
    catch(err){formError=(err as Error).message;}finally{formBusy=false;}
  }
  async function rideAction(action:'join'|'leave'|'delete'|'cancel'|'complete') {
    if(!detail)return;if(isDemo){authOverlay=true;return;}
    actionBusy=true;detailError='';const id=detail.ride.id;
    try {
      if(action==='delete'){await api('rides/'+id,'DELETE');detailOpen=false;detail=null;}
      else if(action==='join'||action==='leave')detail=await api<RideDetail>('rides/'+id+'/join',action==='join'?'POST':'DELETE');
      else detail=await api<RideDetail>('rides/'+id+'/status','PATCH',{status:action==='cancel'?'cancelled':'completed'});
      await refreshRides();confirmAction=null;notify(({join:'Kamu terdaftar. Sampai di titik kumpul!',leave:'Keikutsertaan dibatalkan.',delete:'Jadwal dihapus.',cancel:'Gowes dibatalkan.',complete:'Gowes selesai. Perjalanan masuk ke riwayat.'})[action]);
    }catch(err){detailError=(err as Error).message;}finally{actionBusy=false;}
  }
  async function toggleCheck(item_id:string) {
    if(!detail||checklistBusy)return;checklistBusy=true;detailError='';
    const checked=!detail.checklist.includes(item_id);
    try{await api('rides/'+detail.ride.id+'/checklist','PUT',{item_id,checked});if(detail)detail.checklist=checked?[...detail.checklist,item_id]:detail.checklist.filter(c=>c!==item_id);}
    catch(err){detailError=(err as Error).message;}finally{checklistBusy=false;}
  }
  async function sendNote(event:SubmitEvent) {
    event.preventDefault();if(!detail||!note.trim())return;actionBusy=true;detailError='';
    try{detail=await api<RideDetail>('rides/'+detail.ride.id+'/notes','POST',{body:note});note='';}catch(err){detailError=(err as Error).message;}finally{actionBusy=false;}
  }
  async function deleteNote(id:string) {
    if(!detail)return;actionBusy=true;detailError='';
    try{detail=await api<RideDetail>('rides/'+detail.ride.id+'/notes/'+id,'DELETE');}catch(err){detailError=(err as Error).message;}finally{actionBusy=false;}
  }
  async function copyRide() {
    if(!detail)return;
    try{await navigator.clipboard.writeText(location.origin+'/?ride='+encodeURIComponent(detail.ride.id));notify('Tautan disalin. Teman perlu masuk untuk melihat detail.');}catch{notify('Clipboard tidak tersedia. Gunakan fitur ekspor kalender.');}
  }
  function exportCalendar(ride:Ride) {
    const url=URL.createObjectURL(new Blob([calendarText(ride)],{type:'text/calendar;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='gowes-'+ride.id+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function saveProfile(event:SubmitEvent) {
    event.preventDefault();profileBusy=true;profileError='';
    try{const result=await api<{user:User}>('profile','PATCH',{name:profileName,username:profileUsername,email:profileEmail,city:profileCity,bike_type:profileBike,bio:profileBio});user=result.user;await refreshRides();notify('Profil berhasil diperbarui.');}catch(err){profileError=(err as Error).message;}finally{profileBusy=false;}
  }
  async function changePassword(event:SubmitEvent) {
    event.preventDefault();passwordBusy=true;passwordError='';
    try{await api('auth/password','PATCH',{current_password:currentPassword,password:newPassword});currentPassword='';newPassword='';notify('Password diganti. Sesi di perangkat lain sudah dikeluarkan.');}catch(err){passwordError=(err as Error).message;}finally{passwordBusy=false;}
  }
  function shiftMonth(amount:number) {const d=new Date(Date.UTC(calendarYear,calendarMonth+amount,1));calendarYear=d.getUTCFullYear();calendarMonth=d.getUTCMonth();selectedDay='';}
</script>

<svelte:head><title>Searah — Gowes bareng, lebih terencana</title><meta name="description" content="Rencanakan gowes bareng, tentukan titik kumpul, atur peserta, dan siapkan perjalanan berikutnya bersama Searah."/></svelte:head>

{#snippet brand(light=false)}
  <span class="brand" class:light><span class="brand-icon"><Icon name="bike" size={27}/></span><span>searah<span class="brand-dot">.</span></span></span>
{/snippet}

{#snippet authForm()}
  <div class="auth-intro"><span class="eyebrow">MULAI CERITA BERIKUTNYA</span><h1>{authMode==='register'?'Kenalan dulu, yuk.':'Senang kamu kembali.'}</h1><p>{authMode==='register'?'Satu akun untuk rencana, teman, dan perjalanan baru.':'Masuk dan temukan teman di perjalanan berikutnya.'}</p></div>
  <div class="segmented auth-tabs"><button class:active={authMode==='login'} onclick={()=>{authMode='login';authError='';}}>Masuk</button><button class:active={authMode==='register'} onclick={()=>{authMode='register';authError='';}}>Buat akun</button></div>
  <form onsubmit={authenticate} class="form-stack">
    {#if authMode==='register'}<label>Nama lengkap<input name="name" autocomplete="name" bind:value={authName} required minlength="2" maxlength="60" placeholder="Nama panggilan di jalan"/></label>{/if}
    <label>Username<input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck={false} bind:value={authUsername} required minlength={authMode==='register'?3:1} maxlength={authMode==='register'?32:254} pattern={authMode==='register'?String.raw`[A-Za-z0-9][A-Za-z0-9._\-]{2,31}`:undefined} placeholder={authMode==='register'?'Misalnya: agung_gowes':'Masukkan username'}/><small>{authMode==='register'?'3–32 karakter, tanpa spasi. Huruf besar dan kecil dianggap sama.':'Akun yang belum punya username masih bisa masuk dengan email.'}</small></label>
    <label>Password<span class="password-input"><input type={showPassword?'text':'password'} name="password" autocomplete={authMode==='register'?'new-password':'current-password'} bind:value={authPassword} required minlength={authMode==='register'?12:1} maxlength="128" placeholder={authMode==='register'?'Minimal 12 karakter':'Masukkan password'}/><button type="button" onclick={()=>showPassword=!showPassword}>{showPassword?'Sembunyikan':'Lihat'}</button></span></label>
    {#if authError}<p class="error-box" role="alert">{authError}</p>{/if}
    <button class="btn btn-primary full" type="submit" disabled={authBusy}>{authBusy?'Sebentar, ya…':authMode==='register'?'Buat akun & mulai gowes':'Masuk ke planner'}<Icon name="arrow" size={18}/></button>
  </form>
  <p class="auth-note"><Icon name="lock" size={13}/>Akun pribadi. Rencana jadi milik bersama.</p>
{/snippet}

{#if loading}
  <div class="loading-page">{@render brand()}<span class="loader"></span><p>Menyiapkan perjalananmu…</p></div>
{:else if !user}
  <main class="auth-page">
    <section class="auth-visual">
      <div class="auth-brand">{@render brand(true)}<span class="edition">YOUR NEXT RIDE, TOGETHER.</span></div>
      <div class="auth-story"><span class="pill light-pill"><span class="live-dot"></span>Gowes bareng, lebih terencana</span><h2>Jalan baru.<br/>Cerita baru.<br/><em>Teman yang sama.</em></h2><p>Dari ajakan “minggu gowes, yuk” sampai ketemu di titik kumpul. Semua rencananya, di satu tempat.</p></div>
      <div class="auth-art"><RouteArt/></div>
      <div class="auth-bottom"><span><Icon name="leaf" size={16}/>Pelan juga sampai.</span><span>01 / THE JOY OF RIDING</span></div>
    </section>
    <section class="auth-panel"><div class="auth-mobile-brand">{@render brand()}</div><div class="auth-form-wrap">
      {#if bootError}<div class="error-box" role="alert">{bootError}<button class="text-button" onclick={boot}>Coba hubungkan lagi</button></div>{/if}
      {@render authForm()}
      <div class="demo-divider"><span>atau kenalan dulu</span></div><button class="btn btn-secondary full" onclick={launchDemo}>Jelajahi tampilan demo<Icon name="compass" size={18}/></button><p class="muted text-center text-xs mt-3">Demo memakai data contoh. Akun asli menyimpan data ke database.</p>
    </div><footer class="auth-footer">Lebih banyak perjalanan. Lebih sedikit wacana.</footer></section>
  </main>
{:else}
  <a class="skip-link" href="#main-content">Lewati ke konten</a>
  <div class="app-shell">
    {#if mobileNav}<button class="nav-scrim" aria-label="Tutup navigasi" onclick={()=>mobileNav=false}></button>{/if}
    <aside class="sidebar" class:mobile-open={mobileNav}>
      <button class="brand-button" onclick={()=>navigate('dashboard')} aria-label="Searah, halaman ringkasan">{@render brand()}</button>
      <div class="sidebar-caption">LET'S MAKE A PLAN</div>
      <nav aria-label="Navigasi utama">{#each nav as item}<button class:active={view===item.id} aria-current={view===item.id?'page':undefined} onclick={()=>navigate(item.id)}><Icon name={item.icon} size={19}/><span>{item.label}</span>{#if item.id==='planner'&&joinedUpcoming.length}<span class="nav-count">{joinedUpcoming.length}</span>{/if}</button>{/each}</nav>
      <div class="sidebar-quote"><span class="little-sun"><Icon name="sun" size={25}/></span><p>Rencana kecil.<br/><strong>Petualangan besar.</strong></p><span>Mulai dari satu kayuhan.</span><button onclick={openCreate}>Ajak teman gowes<Icon name="arrow" size={15}/></button></div>
      <div class="sidebar-bottom"><button class="profile-nav" class:active={view==='profile'} onclick={()=>navigate('profile')}><span class="avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.city||'Lengkapi profilmu'}</small></span><Icon name="settings" size={18}/></button><button class="logout-button" onclick={logout}><Icon name="logout" size={16}/>{isDemo?'Keluar demo':'Keluar akun'}</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="flex items-center gap-3"><button class="icon-button mobile-menu" aria-label="Buka navigasi" aria-expanded={mobileNav} onclick={()=>mobileNav=!mobileNav}><Icon name="menu"/></button><span class="breadcrumb">Planner <span>/</span> <strong>{view==='profile'?'Profil saya':nav.find(n=>n.id===view)?.label}</strong></span></div><div class="topbar-actions"><span class="topbar-date"><Icon name="calendar" size={15}/>{dateLabel(new Date().toISOString(),true)}</span><button class="btn btn-primary btn-small" onclick={openCreate}><Icon name="plus" size={17}/>Buat gowes</button></div></header>
      {#if isDemo}<div class="demo-banner"><span><strong>Mode demo</strong><span class="demo-extra"> · Semua jadwal dan peserta adalah data contoh.</span></span><button onclick={()=>{authMode='register';authOverlay=true;}}>Buat akun sendiri<Icon name="arrow" size={14}/></button></div>{/if}
      {#if !isDemo&&!user.username}<div class="demo-banner"><span>Lengkapi username agar selanjutnya bisa masuk tanpa email.</span><button onclick={()=>navigate('profile')}>Atur username<Icon name="arrow" size={14}/></button></div>{/if}
      <main id="main-content" class="main-content">
        {#if view==='dashboard'}
          <div class="page-heading"><div><span class="eyebrow">GOOD DAYS START WITH A RIDE</span><h1>Halo, {user.name.split(' ')[0]}<span class="wave">✳</span></h1><p>Mau ke mana kita di akhir pekan ini?</p></div><div class="week-label"><span class="live-dot"></span>Rencanakan. Kayuh. Nikmati.</div></div>
          <div class="dashboard-grid"><div class="dashboard-primary">
            <section class="hero-card"><div class="hero-copy"><span class="eyebrow">{featured?'PERJALANAN BERIKUTNYA':'RUANG UNTUK PETUALANGAN'}</span><h2>{featured?featured.title:'Lebih seru kalau searah.'}</h2><p>{featured?dateLabel(featured.starts_at)+' · '+timeLabel(featured.starts_at):'Cari jalan baru, ajak teman lama. Rencana gowes berikutnya dimulai dari sini.'}</p>{#if featured}<div class="hero-tags"><span><Icon name="pin" size={15}/>{featured.city}</span><span><Icon name="route" size={15}/>{featured.distance_km} km</span><span><Icon name="users" size={15}/>{featured.participant_count} pesepeda</span></div>{/if}<button class="btn btn-primary" onclick={()=>featured?openDetail(featured.id):openCreate()}>{featured?'Lihat rencana':'Buat rencana pertama'}<Icon name="arrow" size={17}/></button></div><div class="hero-visual"><RouteArt/><span class="illustration-caption">ILUSTRASI PERJALANAN</span></div></section>
            <div class="stats-row"><div class="stat-card"><span class="stat-icon"><Icon name="calendar"/></span><div><span>Gowes mendatang</span><strong>{joinedUpcoming.length}<small>rencana</small></strong></div></div><div class="stat-card"><span class="stat-icon"><Icon name="flag"/></span><div><span>Perjalanan selesai</span><strong>{completed.length}<small>gowes</small></strong></div></div><div class="stat-card"><span class="stat-icon"><Icon name="route"/></span><div><span>Jarak gowes selesai</span><strong>{totalDistance.toLocaleString('id-ID')}<small>km</small></strong></div></div></div>
            <div class="section-heading"><div><h2>Temukan teman searah<span class="heading-dot">.</span></h2><p>Rute baru, obrolan baru, cerita baru.</p></div><button class="text-button" onclick={()=>navigate('explore')}>Lihat semua<Icon name="arrow" size={16}/></button></div>
            {#if upcoming.length}<div class="ride-grid">{#each upcoming.slice(0,4) as ride,i}<RideCard {ride} index={i} onclick={()=>openDetail(ride.id)}/>{/each}</div>{:else}<div class="empty-state"><span class="empty-icon"><Icon name="bike" size={40}/></span><h3>Jalanan menunggu cerita pertama.</h3><p>Belum ada jadwal gowes. Buat rencana, lalu bagikan tautannya ke teman-teman.</p><button class="btn btn-primary" onclick={openCreate}><Icon name="plus" size={16}/>Buat gowes pertama</button></div>{/if}
          </div><aside class="dashboard-secondary">
            <section class="agenda-card"><div class="section-heading compact-heading"><h2>Agenda saya</h2><button class="icon-button" aria-label="Buka kalender" onclick={()=>navigate('calendar')}><Icon name="calendar" size={18}/></button></div><p class="muted text-xs mb-5">Yang sudah kamu tunggu-tunggu.</p>{#if joinedUpcoming.length}<div class="agenda-list">{#each joinedUpcoming.slice(0,3) as ride}<button class="agenda-item" onclick={()=>openDetail(ride.id)}><span class="agenda-date"><strong>{new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit'}).format(new Date(ride.starts_at))}</strong><small>{new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',month:'short'}).format(new Date(ride.starts_at))}</small></span><span><strong>{ride.title}</strong><small>{timeLabel(ride.starts_at)} · {ride.city}</small></span><Icon name="chevron" size={14}/></button>{/each}</div>{:else}<div class="agenda-empty"><Icon name="sun" size={30}/><p>Agenda masih lapang.</p><span>Gabung gowes atau buat rencanamu.</span></div>{/if}<button class="btn btn-secondary full mt-5" onclick={()=>navigate('planner')}>Lihat gowes saya<Icon name="arrow" size={15}/></button></section>
            <section class="tip-card"><span class="eyebrow">BEFORE YOU ROLL</span><h3>Siap jalan?<br/>Cek dulu, yuk.</h3><div class="tip-checklist">{#each CHECKLIST.slice(0,4) as item}<div><span class="mini-check"><Icon name="check" size={12}/></span>{item.label}</div>{/each}</div><p>Checklist pribadimu tersedia di setiap gowes yang kamu ikuti.</p>{#if joinedUpcoming[0]}<button class="text-button" onclick={()=>openDetail(joinedUpcoming[0].id)}>Buka checklist<Icon name="arrow" size={15}/></button>{/if}</section>
            <div class="side-mantra"><Icon name="heart" size={15}/><p>Bukan soal paling cepat.<br/>Soal menikmati setiap kayuhan.</p></div>
          </aside></div>
        {:else if view==='explore'||view==='planner'}
          <div class="page-heading"><div><span class="eyebrow">{view==='explore'?'FIND YOUR NEXT ADVENTURE':'YOUR PLANS, YOUR PEOPLE'}</span><h1>{view==='explore'?'Cari teman searah.':'Setiap rencana, satu cerita.'}</h1><p>{view==='explore'?'Pilih rute yang cocok. Kita ketemu di titik kumpul.':'Gowes yang kamu ikuti dan perjalanan yang kamu mulai.'}</p></div></div>
          {#if view==='planner'}<div class="planner-tabs"><button class:active={plannerTab==='joined'} onclick={()=>plannerTab='joined'}>Saya ikuti<span>{rides.filter(r=>r.joined).length}</span></button><button class:active={plannerTab==='organizing'} onclick={()=>plannerTab='organizing'}>Saya buat<span>{rides.filter(r=>r.organizer_id===user?.id).length}</span></button></div>{/if}
          <div class="filter-bar"><label class="search-field"><Icon name="search" size={18}/><input aria-label="Cari nama gowes, kota, atau penyelenggara" placeholder="Cari gowes, kota, atau teman…" bind:value={search}/></label><select aria-label="Filter pace" bind:value={paceFilter}><option>Semua pace</option><option>Santai</option><option>Moderate</option><option>Ngebut</option></select><select aria-label="Filter medan" bind:value={terrainFilter}><option>Semua medan</option><option>Road</option><option>Gravel</option><option>MTB</option><option>Campuran</option></select><button class="icon-button" aria-label="Perbarui daftar gowes" onclick={()=>refreshRides().then(()=>notify('Daftar diperbarui.')).catch(err=>notify(err.message))}><Icon name="route" size={19}/></button></div>
          <div class="results-toolbar"><div class="filter-chips"><button class:active={scope==='upcoming'} onclick={()=>scope='upcoming'}>Mendatang</button><button class:active={scope==='completed'} onclick={()=>scope='completed'}>Selesai</button><button class:active={scope==='all'} onclick={()=>scope='all'}>Semua</button></div><span class="muted text-xs">{visibleRides.length} perjalanan</span></div>
          {#if visibleRides.length}<div class="ride-grid browse-grid">{#each visibleRides as ride,i}<RideCard {ride} index={i} onclick={()=>openDetail(ride.id)}/>{/each}</div>{:else}<div class="empty-state"><span class="empty-icon"><Icon name="compass" size={40}/></span><h3>Belum ada gowes di sini.</h3><p>Coba ubah pencarian atau mulai rencana gowesmu sendiri.</p><button class="btn btn-primary" onclick={openCreate}><Icon name="plus" size={16}/>Buat rencana gowes</button></div>{/if}
        {:else if view==='calendar'}
          <div class="page-heading"><div><span class="eyebrow">SAVE A DAY FOR THE ROAD</span><h1>Sisihkan hari untuk gowes.</h1><p>Jadwal gowes yang kamu ikuti, dalam satu kalender. Semua waktu dalam WIB.</p></div></div>
          <div class="calendar-layout"><section class="calendar-panel"><div class="calendar-toolbar"><h2>{monthLabel}</h2><div class="flex items-center gap-2"><button class="btn btn-secondary btn-small" onclick={()=>{calendarYear=Number(todayWIB.slice(0,4));calendarMonth=Number(todayWIB.slice(5,7))-1;selectedDay=todayWIB;}}>Hari ini</button><button class="icon-button rotate-180" aria-label="Bulan sebelumnya" onclick={()=>shiftMonth(-1)}><Icon name="chevron" size={18}/></button><button class="icon-button" aria-label="Bulan berikutnya" onclick={()=>shiftMonth(1)}><Icon name="chevron" size={18}/></button></div></div><div class="calendar-weekdays">{#each ['Sen','Sel','Rab','Kam','Jum','Sab','Min'] as day}<span>{day}</span>{/each}</div><div class="calendar-days">{#each days as d}<button class="calendar-day" class:outside={!d.current} class:today={d.key===todayWIB} class:selected={d.key===selectedDay} aria-label={d.key+', '+calendarRides.filter(r=>dateKey(r.starts_at)===d.key).length+' gowes'} aria-pressed={d.key===selectedDay} onclick={()=>selectedDay=d.key}><span class="day-number">{d.day}</span>{#each calendarRides.filter(r=>dateKey(r.starts_at)===d.key).slice(0,2) as ride}<span class="calendar-event" class:completed={ride.status==='completed'}>{ride.title}</span>{/each}{#if calendarRides.filter(r=>dateKey(r.starts_at)===d.key).length>2}<small>+{calendarRides.filter(r=>dateKey(r.starts_at)===d.key).length-2} lainnya</small>{/if}</button>{/each}</div><div class="calendar-legend"><span><i></i>Gowes terjadwal</span><span><i class="done"></i>Perjalanan selesai</span></div></section><aside class="agenda-card calendar-agenda"><span class="eyebrow">AGENDA HARI INI</span><h2>{dateLabel((selectedDay||todayWIB)+'T05:00:00Z',true)}</h2>{#if dayRides.length}{#each dayRides as ride}<button class="day-ride" onclick={()=>openDetail(ride.id)}><span class="pace-badge">{timeLabel(ride.starts_at)}</span><h3>{ride.title}</h3><p><Icon name="pin" size={14}/>{ride.meeting_point}</p><span class="text-button">Lihat rencana<Icon name="arrow" size={15}/></span></button>{/each}{:else}<div class="agenda-empty"><Icon name="sun" size={30}/><p>Hari yang masih lapang.</p><span>Jadikan hari ini awal cerita baru.</span></div>{/if}<button class="btn btn-primary full mt-5" onclick={openCreate}><Icon name="plus" size={16}/>Buat gowes</button></aside></div>
        {:else if view==='profile'}
          <div class="page-heading"><div><span class="eyebrow">THE PERSON BEHIND THE PEDALS</span><h1>Kenalan lebih dekat.</h1><p>Biar teman searah tahu siapa yang akan datang ke titik kumpul.</p></div></div>
          <div class="profile-layout"><section class="profile-card"><div class="profile-card-header"><span class="avatar large">{initials(user.name)}</span><div><h2>{user.name}</h2><p>{user.username?'@'+user.username:'Pilih username untuk akunmu'}</p></div></div><form class="form-stack" onsubmit={saveProfile}><label>Nama lengkap<input bind:value={profileName} required minlength="2" maxlength="60" autocomplete="name"/></label><label>Username<input name="profile-username" autocomplete="username" autocapitalize="none" spellcheck={false} bind:value={profileUsername} required minlength="3" maxlength="32" pattern={String.raw`[A-Za-z0-9][A-Za-z0-9._\-]{2,31}`} placeholder="Misalnya: agung_gowes"/><small>Gunakan username ini untuk masuk. Tanpa spasi, 3–32 karakter.</small></label><label>Email <span class="field-hint">opsional</span><input type="email" name="contact-email" autocomplete="email" bind:value={profileEmail} maxlength="254" placeholder="Boleh dikosongkan"/><small>Tambahkan untuk kontak, atau kosongkan untuk menghapus. Login tetap menggunakan username.</small></label><div class="form-row"><label>Kota asal<input bind:value={profileCity} maxlength="80" placeholder="Misalnya: Bogor"/></label><label>Sepeda yang dipakai<select bind:value={profileBike}>{#each ['Road bike','MTB','Gravel','Folding bike','Hybrid','Lainnya'] as bike}<option>{bike}</option>{/each}</select></label></div><label>Tentang kamu<textarea rows="3" maxlength="300" bind:value={profileBio} placeholder="Gowes santai, pantang pulang sebelum ngopi."></textarea></label>{#if profileError}<p class="error-box" role="alert">{profileError}</p>{/if}<button class="btn btn-primary" disabled={profileBusy}>{profileBusy?'Menyimpan…':'Simpan profil'}<Icon name="check" size={17}/></button></form></section><section class="profile-card"><span class="stat-icon mb-5"><Icon name="lock" size={22}/></span><h2>Ganti password</h2><p class="muted text-sm mt-2 mb-6">Gunakan minimal 12 karakter. Mengganti password akan mengeluarkan sesi di perangkat lain.</p><form class="form-stack" onsubmit={changePassword}><label>Password saat ini<input type="password" autocomplete="current-password" bind:value={currentPassword} required maxlength="128"/></label><label>Password baru<input type="password" autocomplete="new-password" bind:value={newPassword} required minlength="12" maxlength="128"/></label>{#if passwordError}<p class="error-box" role="alert">{passwordError}</p>{/if}<button class="btn btn-secondary" disabled={passwordBusy}>{passwordBusy?'Mengganti…':'Perbarui password'}</button></form></section></div>
        {/if}
        <footer class="app-footer"><span>searah. <span>Good roads. Better company.</span></span><span>Kayuh pelan. Nikmati perjalanan.<Icon name="leaf" size={13}/></span></footer>
      </main>
    </div>
  </div>
{/if}

<Modal open={authOverlay} title="Satu akun, banyak perjalanan" onclose={()=>{if(!authBusy)authOverlay=false;}}>{@render authForm()}</Modal>

<Modal open={formOpen} title={editing?'Ubah rencana gowes':'Rencanakan gowes berikutnya'} onclose={()=>{if(!formBusy)formOpen=false;}} wide>
  <p class="form-description">Buat rencana yang jelas. Sisanya, nikmati bareng.</p>
  <form class="form-stack" onsubmit={saveRide}>
    <label>Nama gowes<input bind:value={draft.title} required minlength="3" maxlength="100" placeholder="Misalnya: Sentul morning loop"/></label>
    <div class="form-row"><label>Tanggal & jam kumpul <span class="field-hint">WIB / UTC+7</span><input type="datetime-local" bind:value={draft.starts_at} required min={localInput(new Date(Date.now()+60000).toISOString())}/></label><label>Kota / area<input bind:value={draft.city} required minlength="2" maxlength="80" placeholder="Bogor"/></label></div>
    <label>Titik kumpul<input bind:value={draft.meeting_point} required minlength="3" maxlength="200" placeholder="Nama tempat dan alamat yang mudah ditemukan"/></label>
    <div class="form-row three"><label>Jarak (km)<input type="number" bind:value={draft.distance_km} min="1" max="1000" step="0.1" required/></label><label>Elevasi (m)<input type="number" bind:value={draft.elevation_m} min="0" max="20000" step="1" required/></label><label>Kuota peserta<input type="number" bind:value={draft.capacity} min="2" max="200" step="1" required/></label></div>
    <div class="form-row"><label>Pace<select bind:value={draft.pace}><option>Santai</option><option>Moderate</option><option>Ngebut</option></select></label><label>Medan<select bind:value={draft.terrain}><option>Road</option><option>Gravel</option><option>MTB</option><option>Campuran</option></select></label></div>
    <label>Tautan rute <span class="field-hint">opsional</span><input type="url" bind:value={draft.route_url} maxlength="600" placeholder="https://maps.app.goo.gl/…"/><small>Google Maps, Komoot, Strava, atau tautan HTTPS lainnya.</small></label>
    <label>Catatan perjalanan <span class="field-hint">opsional</span><textarea bind:value={draft.description} maxlength="2000" rows="3" placeholder="Rencana rute, tempat istirahat, patungan, atau aturan no drop…"></textarea></label>
    {#if formError}<p class="error-box" role="alert">{formError}</p>{/if}
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick={()=>formOpen=false} disabled={formBusy}>Nanti dulu</button><button class="btn btn-primary" disabled={formBusy}>{formBusy?'Menyimpan…':editing?'Simpan perubahan':'Buat & ajak teman'}<Icon name="arrow" size={17}/></button></div>
  </form>
</Modal>

<Modal open={detailOpen} title="Rencana perjalanan" onclose={()=>{if(!actionBusy&&!checklistBusy)detailOpen=false;}} wide>
  {#if detailLoading}<div class="modal-loading"><span class="loader"></span><p>Mengambil rencana gowes…</p></div>{:else if detail}
    {@const ride=detail.ride}{@const isOwner=ride.organizer_id===user?.id}
    <div class="detail-cover"><RouteArt compact/><span class="pill">{ride.terrain} · {ride.pace}</span><span class="illustration-caption">ILUSTRASI RUTE</span></div>
    <div class="detail-title"><div><span class="eyebrow">{ride.status==='cancelled'?'GOWES DIBATALKAN':ride.status==='completed'?'PERJALANAN SELESAI':ride.joined?'KAMU SUDAH TERDAFTAR':'LET’S RIDE TOGETHER'}</span><h2>{ride.title}</h2></div>{#if isOwner&&ride.status==='upcoming'}<button class="btn btn-secondary btn-small" onclick={editRide}><Icon name="edit" size={15}/>Ubah</button>{/if}</div>
    <div class="detail-meta"><span><Icon name="calendar" size={16}/>{dateLabel(ride.starts_at)}</span><span><Icon name="clock" size={16}/>{timeLabel(ride.starts_at)}</span><span><Icon name="pin" size={16}/>{ride.city}</span></div>
    <div class="detail-stats"><div><Icon name="route" size={20}/><strong>{ride.distance_km}<small>km</small></strong><span>Jarak rencana</span></div><div><Icon name="mountain" size={20}/><strong>{ride.elevation_m}<small>m</small></strong><span>Total elevasi</span></div><div><Icon name="users" size={20}/><strong>{ride.participant_count}<small>/ {ride.capacity}</small></strong><span>Pesepeda</span></div></div>
    {#if detailError}<p class="error-box" role="alert">{detailError}</p>{/if}
    <section class="detail-section"><h3><Icon name="pin" size={17}/>Ketemu di sini</h3><p>{ride.meeting_point}</p><span class="muted text-xs">Diselenggarakan oleh {ride.organizer_name}</span>{#if ride.route_url}<a class="text-button mt-3" href={ride.route_url} target="_blank" rel="noopener noreferrer">Buka tautan rute<Icon name="external" size={15}/></a>{/if}</section>
    {#if ride.description}<section class="detail-section"><h3>Rencana & catatan</h3><p class="preserve-lines">{ride.description}</p></section>{/if}
    <section class="detail-section"><div class="flex justify-between items-center mb-3"><h3>Teman seperjalanan</h3><span class="muted text-xs">{ride.participant_count} dari {ride.capacity} tempat</span></div><div class="participant-list">{#each detail.participants as p}<div class="participant"><span class="avatar">{initials(p.name)}</span><span><strong>{p.name}</strong><small>{p.id===ride.organizer_id?'Penyelenggara':p.bike_type}{p.city?' · '+p.city:''}</small></span></div>{/each}</div>{#if isDemo}<p class="muted text-xs mt-3">Nama dan jumlah peserta di mode ini adalah contoh tampilan.</p>{/if}</section>
    {#if ride.joined}<section class="detail-section"><div class="flex justify-between items-center mb-3"><h3>Checklist pribadimu</h3><span class="pace-badge">{detail.checklist.length}/{CHECKLIST.length} siap</span></div><div class="progress-track"><span style:width={detail.checklist.length/CHECKLIST.length*100+'%'}></span></div><div class="personal-checklist">{#each CHECKLIST as item}<label><input type="checkbox" checked={detail.checklist.includes(item.id)} disabled={checklistBusy||isDemo} onchange={()=>toggleCheck(item.id)}/><span>{item.label}</span></label>{/each}</div></section>{/if}
    <section class="detail-section"><h3>Obrolan sebelum berangkat</h3>{#if ride.joined}<form class="note-form" onsubmit={sendNote}><label class="sr-only" for="ride-note">Tulis pesan</label><textarea id="ride-note" bind:value={note} rows="2" maxlength="1000" required placeholder="Tanya rute, ajak ngopi, atau kabari teman…"></textarea><button class="btn btn-primary btn-small" disabled={actionBusy||!note.trim()||isDemo}><Icon name="send" size={16}/>Kirim</button></form>{:else}<p class="muted text-sm">Gabung gowes untuk ikut mengobrol.</p>{/if}<div class="notes-list">{#each detail.notes as n}<div class="note-item"><span class="avatar tiny">{initials(n.name)}</span><div><div class="note-meta"><strong>{n.name}</strong><time>{new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(n.created_at*1000))}</time></div><p class="preserve-lines">{n.body}</p></div>{#if n.user_id===user?.id||isOwner}<button class="icon-button" aria-label="Hapus pesan" disabled={actionBusy} onclick={()=>deleteNote(n.id)}><Icon name="trash" size={14}/></button>{/if}</div>{:else}<p class="muted text-xs py-3">Belum ada pesan. Mulai dengan menyapa teman searah.</p>{/each}</div></section>
    <div class="detail-tools"><button class="btn btn-secondary btn-small" onclick={()=>exportCalendar(ride)}><Icon name="download" size={15}/>Ekspor kalender</button>{#if !isDemo}<button class="btn btn-secondary btn-small" onclick={copyRide}><Icon name="external" size={15}/>Bagikan</button>{/if}</div>
    {#if confirmAction}<div class="confirm-box" role="alert"><strong>{confirmAction==='delete'?'Hapus jadwal ini beserta data pesertanya?':confirmAction==='cancel'?'Batalkan gowes ini untuk semua peserta?':confirmAction==='complete'?'Tandai perjalanan ini sudah selesai?':'Batalkan keikutsertaanmu?'}</strong><p>{confirmAction==='delete'?'Jadwal dan obrolan akan dihapus permanen.':confirmAction==='complete'?'Jarak rencana akan masuk ke statistik perjalanan peserta.':'Perubahan akan langsung tersimpan.'}</p><div class="flex gap-2 mt-3"><button class="btn btn-secondary btn-small" onclick={()=>confirmAction=null} disabled={actionBusy}>Kembali</button><button class="btn btn-danger btn-small" disabled={actionBusy} onclick={()=>confirmAction&&rideAction(confirmAction)}>{actionBusy?'Memproses…':'Ya, lanjutkan'}</button></div></div>{/if}
    <div class="detail-actions">{#if isOwner}<div class="owner-actions">{#if ride.status==='upcoming'}<button class="text-button danger-text" disabled={actionBusy} onclick={()=>confirmAction='cancel'}>Batalkan gowes</button>{#if new Date(ride.starts_at).getTime()<=clock}<button class="btn btn-primary" disabled={actionBusy} onclick={()=>confirmAction='complete'}><Icon name="check" size={17}/>Tandai selesai</button>{/if}{/if}<button class="icon-button danger-text" aria-label="Hapus jadwal" disabled={actionBusy} onclick={()=>confirmAction='delete'}><Icon name="trash" size={18}/></button></div>{:else if isUpcoming(ride)}{#if ride.joined}<span class="joined-confirm"><Icon name="check" size={18}/>Sampai di titik kumpul!</span><button class="btn btn-secondary" disabled={actionBusy} onclick={()=>confirmAction='leave'}>Batal ikut</button>{:else}<span class="muted text-sm">{Math.max(0,ride.capacity-ride.participant_count)} tempat tersisa</span><button class="btn btn-primary" disabled={actionBusy||ride.participant_count>=ride.capacity} onclick={()=>rideAction('join')}>{actionBusy?'Mendaftarkan…':ride.participant_count>=ride.capacity?'Kuota penuh':'Ikut gowes ini'}<Icon name="arrow" size={17}/></button>{/if}{:else}<p class="muted text-sm">{ride.status==='cancelled'?'Gowes ini dibatalkan penyelenggara.':ride.status==='completed'?'Perjalanan ini sudah selesai.':'Waktu keberangkatan sudah lewat.'}</p>{/if}</div>
  {:else if detailError}<p class="error-box" role="alert">{detailError}</p>{/if}
</Modal>

{#if toast}<div class="toast" role="status"><span><Icon name="check" size={17}/></span>{toast}<button aria-label="Tutup pemberitahuan" onclick={()=>toast=''}>✕</button></div>{/if}
