<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { router } from '$lib/core/router.svelte';
  import { allRoutes, modules } from '$lib/core/modules';
  import { kb } from '$lib/core/content/kb.svelte';
  import { loadSettings, settings, persistSettings, applyTheme, motionOK } from '$lib/core/settings.svelte';
  import { loadProgress } from '$lib/core/progress.svelte';
  import { loadUserDecks } from '$lib/core/content/userdecks.svelte';
  import { initPlatform, setHapticsEnabled } from '$lib/core/platform';
  import TabBar from '$lib/app/TabBar.svelte';
  import SheetHost from '$lib/app/SheetHost.svelte';
  import Overlays from '$lib/app/Overlays.svelte';
  import Splash from '$lib/app/Splash.svelte';
  import NotFound from '$lib/app/NotFound.svelte';

  let booted = $state(false);
  let failure = $state<string | null>(null);

  onMount(async () => {
    try {
      await loadSettings();
      await Promise.all([kb.load(), loadProgress(), loadUserDecks()]);
      for (const m of modules) await m.init?.();
      router.register(allRoutes);
      router.start();
      booted = true;
      void initPlatform(() => router.handleHardwareBack());
      void navigator.storage?.persist?.();
    } catch (e) {
      console.error(e);
      failure = e instanceof Error ? e.message : String(e);
    }
  });

  $effect(() => {
    JSON.stringify(settings);
    persistSettings();
    applyTheme();
    setHapticsEnabled(settings.haptics);
    try {
      localStorage.setItem('stolypin-theme', settings.theme);
      localStorage.setItem('stolypin-accent', settings.accent);
    } catch {
      /* private mode */
    }
  });

  // Scroll: top on forward navigation, restore on back.
  $effect(() => {
    void router.seq;
    const back = router.direction === 'back';
    const y = back ? router.savedScroll() : 0;
    requestAnimationFrame(() => setTimeout(() => window.scrollTo(0, y), back ? 60 : 0));
  });

  function interceptLinks(e: MouseEvent) {
    const a = (e.target as HTMLElement | null)?.closest?.('a');
    const href = a?.getAttribute('href');
    if (a && href?.startsWith('#/')) {
      e.preventDefault();
      router.navigate(href.slice(1));
    }
  }

  const dx = $derived(router.direction === 'back' ? -28 : router.direction === 'forward' ? 28 : 0);
  const immersive = $derived(!!router.route?.immersive);
</script>

<svelte:document onclick={interceptLinks} />

{#if !booted}
  <Splash error={failure} />
{:else}
  {#key router.seq}
    <main class="view" in:fly={{ x: motionOK() ? dx : 0, y: dx === 0 && motionOK() ? 12 : 0, duration: 300, easing: cubicOut }}>
      {#if router.route}
        {#await router.route.component()}
          <div class="loading" in:fade={{ delay: 150 }}><span class="dot"></span></div>
        {:then mod}
          <mod.default />
        {:catch err}
          <NotFound message={String(err)} />
        {/await}
      {:else}
        <NotFound />
      {/if}
    </main>
  {/key}
  {#if !immersive}<TabBar />{/if}
  <SheetHost />
{/if}
<Overlays />

<style>
  .view { min-height: 100dvh; }
  .loading { min-height: 60dvh; display: grid; place-items: center; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 900ms ease-in-out infinite alternate; }
  @keyframes pulse { from { transform: scale(0.6); opacity: 0.4; } to { transform: scale(1.4); opacity: 1; } }
</style>
