<script lang="ts">let { compact = false, variant = 0 }: { compact?:boolean; variant?:number } = $props();</script>
<svg viewBox="0 0 620 360" class="route-art" class:compact aria-hidden="true">
  <defs>
    <pattern id={'grid'+compact+variant} width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#a8b8a0" stroke-opacity=".18" stroke-width="1"/></pattern>
    <linearGradient id={'hill'+compact+variant} x2="0" y2="1"><stop stop-color="#c4d3ae"/><stop offset="1" stop-color="#e3e9d6"/></linearGradient>
  </defs>
  <rect width="620" height="360" fill={variant===1?'#e5e5da':variant===2?'#e9e2d2':'#e3ead9'}/>
  <rect width="620" height="360" fill={'url(#grid'+compact+variant+')'}/>
  <g fill="none" stroke="#bdcaaa" stroke-width="1.3" opacity=".65">
    <path d="M-40 87c140-143 156 109 317 18s214-26 389-31M-40 100c140-143 156 109 317 18s214-26 389-31M-40 113c140-143 156 109 317 18s214-26 389-31M-40 126c140-143 156 109 317 18s214-26 389-31"/>
    <path d="M-40 291c128-106 172 83 295 19s215-160 418-75M-40 304c128-106 172 83 295 19s215-160 418-75M-40 317c128-106 172 83 295 19s215-160 418-75M-40 330c128-106 172 83 295 19s215-160 418-75"/>
    <path d="M490-20c-30 65-85 40-65 107s130 74 110 150 110 118 150 136M505-20c-30 65-85 40-65 107s130 74 110 150 110 118 150 136M520-20c-30 65-85 40-65 107s130 74 110 150 110 118 150 136"/>
  </g>
  <path d="M65 260c61-70 72-12 114-42s-24-83 38-111 74 15 106 8 35-65 93-47 70 86 45 121-90 24-106 66 90 52 133-3" fill="none" stroke="#f9f9f0" stroke-width="16" stroke-linecap="round"/>
  <path d="M65 260c61-70 72-12 114-42s-24-83 38-111 74 15 106 8 35-65 93-47 70 86 45 121-90 24-106 66 90 52 133-3" fill="none" stroke="#3f6e46" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/>
  <circle cx="65" cy="260" r="12" fill="#1b4534" stroke="#fffef6" stroke-width="5"/><circle cx="488" cy="252" r="12" fill="#c8e78b" stroke="#1b4534" stroke-width="4"/>
  {#if !compact}
    <g transform="translate(225 135)">
      <ellipse cx="79" cy="99" rx="91" ry="10" fill="#a1b292" opacity=".35"/>
      <g fill="none" stroke="#254d3c" stroke-width="5"><circle cx="27" cy="62" r="32"/><circle cx="130" cy="62" r="32"/><path d="m27 62 31-52 37 52H27l45-37h41m17 37-21-69h14M49 10h20"/></g>
      <path d="m65-6 23-30 29 17-9 25" fill="none" stroke="#224f3a" stroke-width="14" stroke-linecap="round"/>
      <path d="m67-4 21 24-15 27M109-17 126-8l9 1" fill="none" stroke="#e9a775" stroke-width="9" stroke-linecap="round"/>
      <path d="m63-9 22-31 25 15-13 23Z" fill="#a6cb62"/>
      <circle cx="112" cy="-49" r="12" fill="#e9a775"/>
      <path d="M100-54c0-18 29-14 29 2l-29-2Z" fill="#254d3c"/>
      <path d="m68 48 15 2" stroke="#254d3c" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g fill="#234f3b" font-family="system-ui" font-size="11" font-weight="700"><text x="38" y="293">MULAI</text><text x="464" y="288">SAMPAI</text></g>
    <g transform="translate(464 27)"><rect width="121" height="38" rx="19" fill="#fafbf3"/><circle cx="20" cy="19" r="5" fill="#6f914c"/><text x="33" y="23" fill="#34513d" font-family="system-ui" font-size="11">Satu arah, bareng.</text></g>
  {/if}
</svg>
