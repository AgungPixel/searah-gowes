<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open, title, onclose, children, wide = false }: {open: boolean; title: string; onclose:()=>void; children:Snippet; wide?:boolean} = $props();
  let dialog: HTMLDialogElement;
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>
<dialog bind:this={dialog} class:wide oncancel={(e)=>{e.preventDefault();onclose();}} aria-label={title}>
  <div class="dialog-header"><h2>{title}</h2><button class="icon-button" aria-label="Tutup dialog" onclick={onclose}>✕</button></div>
  <div class="dialog-body">{@render children()}</div>
</dialog>
