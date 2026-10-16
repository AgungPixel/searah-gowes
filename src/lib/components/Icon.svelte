<script lang="ts">
  let { name, size = 20, stroke = 1.7, class: className = '' }: { name: string; size?: number; stroke?: number; class?: string } = $props();
  const paths: Record<string, string> = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-2.5 5.5L8 16l2.5-5.5L16 8Z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 14h2M15 14h2M7 18h2',
    route: 'M6 6a3 3 0 1 0 0 .01M18 18a3 3 0 1 0 0 .01M9 6h7a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h7',
    bike: 'M7 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM25 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 17l5-10 7 10H3l8-8h7M6 7h5M21 17l-4-14h4',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    arrow: 'M5 12h14M13 6l6 6-6 6', chevron: 'm9 5 7 7-7 7', plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M6 18 18 6', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l.6 3 2.4 1.4 2.9-1 3 5.2-2.3 2V16l2.3 2-3 5.2-2.9-1-2.4 1.4L15 27H9l-.6-3.4L6 22.2l-2.9 1-3-5.2 2.3-2v-2.4l-2.3-2 3-5.2 2.9 1L8.4 6 9 3Z',
    user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    mountain: 'm2 20 7-14 5 8 3-5 6 11H2ZM6 12l3 2 3-2',
    check: 'm5 12 4 4L19 6', external: 'M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', edit: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    flag: 'M5 22V3m0 1c5-5 9 5 15 0v10c-6 5-10-5-15 0',
    leaf: 'M20 3C8 2 2 7 4 15s16 8 16-12ZM4 21 16 9',
    menu: 'M4 6h16M4 12h16M4 18h16', send: 'm22 2-7 20-4-9-9-4L22 2ZM22 2 11 13',
    lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
    sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'
  };
</script>
<svg class={className} width={size} height={size} viewBox={name === 'bike' ? '-2 0 29 25' : name === 'settings' ? '-2 1 28 28' : '0 0 24 24'} fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] || paths.compass} /></svg>
