<script lang="ts">
  import { House, Landmark, GraduationCap, Library, User } from '@lucide/svelte';
  import { router, navigate, type TabId } from '$lib/core/router.svelte';
  import { haptic } from '$lib/core/platform';

  const TABS: { id: TabId; label: string; href: string; icon: typeof House }[] = [
    { id: 'home', label: 'Главная', href: '/', icon: House },
    { id: 'explore', label: 'Эпохи', href: '/explore', icon: Landmark },
    { id: 'practice', label: 'Практика', href: '/practice', icon: GraduationCap },
    { id: 'library', label: 'Библиотека', href: '/library', icon: Library },
    { id: 'profile', label: 'Профиль', href: '/profile', icon: User },
  ];

  const active = $derived(router.route?.tab ?? 'home');
  const index = $derived(Math.max(0, TABS.findIndex((t) => t.id === active)));
</script>

<nav class="tabbar" aria-label="Разделы">
  <div class="inner" style:--i={index}>
    <span class="pill" aria-hidden="true"></span>
    {#each TABS as t (t.id)}
      {@const Icon = t.icon}
      <button
        class:active={t.id === active}
        aria-current={t.id === active ? 'page' : undefined}
        onclick={() => {
          haptic('select');
          if (router.path === t.href) window.scrollTo({ top: 0, behavior: 'smooth' });
          else navigate(t.href, { replace: router.route?.tab !== undefined && router.path === TABS.find((x) => x.id === active)?.href });
        }}
      >
        <Icon size={22} strokeWidth={t.id === active ? 2.3 : 1.8} />
        <span>{t.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    padding: 0 var(--sp-3) calc(var(--safe-bottom) + var(--sp-2));
    pointer-events: none;
  }
  .inner {
    position: relative;
    pointer-events: auto;
    max-width: 520px;
    margin: 0 auto;
    height: var(--tabbar-h);
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 6px;
    border-radius: 24px;
    background: var(--glass);
    backdrop-filter: blur(18px) saturate(1.4);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-3);
  }
  .pill {
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 6px;
    width: calc((100% - 12px) / 5);
    transform: translateX(calc(var(--i) * 100%));
    border-radius: 18px;
    background: var(--accent-soft);
    transition: transform 460ms var(--ease-spring);
  }
  button {
    position: relative;
    z-index: 1;
    border: 0;
    background: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--ink-3);
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: color var(--dur-2), transform var(--dur-1);
  }
  button:active { transform: scale(0.92); }
  button.active { color: var(--accent); }
</style>
