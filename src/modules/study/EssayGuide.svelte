<script lang="ts" module>
  /**
   * «Как писать» — the owner's guide to the olympiad historical essay (content/essay/guide.json, extracted from
   * the circle's handbook): criteria and points, then sections with formulas, steps, tips, score tables and
   * good / bad examples. Shown as the first tab of «Историческое эссе»; its checklist is reused by the plan.
   */
  import raw from '../../../content/essay/guide.json';

  export interface EssayGuideData {
    intro: string;
    criteria: { title: string; rows: { part: string; points: number; note?: string }[]; note?: string };
    sections: {
      id: string;
      title: string;
      summary: string;
      formula?: string;
      steps?: string[];
      tips?: string[];
      table?: { head: string[]; rows: string[][] };
      examples?: { kind: 'good' | 'bad'; label?: string; text: string; why?: string }[];
    }[];
    checklist: string[];
  }
  export const guide = raw as EssayGuideData;
</script>

<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ChevronDown, ThumbsUp, ThumbsDown } from '@lucide/svelte';
  import Card from '$lib/design/components/Card.svelte';
  import { pluralN, WORDS } from '$lib/core/utils/format';

  let open = $state<string | null>(null);
  const total = guide.criteria.rows.reduce((s, r) => s + r.points, 0);
</script>

<p class="lead">{guide.intro}</p>

<Card padding="md">
  <h3>{guide.criteria.title}</h3>
  <table class="crit">
    <tbody>
      {#each guide.criteria.rows as r (r.part)}
        <tr><td>{r.part}{#if r.note}<small>{r.note}</small>{/if}</td><td class="num pts">{r.points}</td></tr>
      {/each}
      <tr class="sum"><td>Всего</td><td class="num pts">{pluralN(total, WORDS.score)}</td></tr>
    </tbody>
  </table>
  {#if guide.criteria.note}<p class="muted note">{guide.criteria.note}</p>{/if}
</Card>

<div class="sections">
  {#each guide.sections as s (s.id)}
    <div class="sec" class:open={open === s.id}>
      <button class="head" onclick={() => (open = open === s.id ? null : s.id)} aria-expanded={open === s.id}>
        <strong class="grow">{s.title}</strong><ChevronDown size={18} />
      </button>
      {#if open === s.id}
        <div class="body" transition:slide={{ duration: 220 }}>
          <p>{s.summary}</p>
          {#if s.formula}<p class="formula">{s.formula}</p>{/if}
          {#if s.steps?.length}<ol>{#each s.steps as st, i (i)}<li>{st}</li>{/each}</ol>{/if}
          {#if s.tips?.length}<ul>{#each s.tips as t, i (i)}<li>{t}</li>{/each}</ul>{/if}
          {#if s.table}
            <div class="tbl">
              <table>
                <thead><tr>{#each s.table.head as h, i (i)}<th>{h}</th>{/each}</tr></thead>
                <tbody>{#each s.table.rows as row, i (i)}<tr>{#each row as c, j (j)}<td>{c}</td>{/each}</tr>{/each}</tbody>
              </table>
            </div>
          {/if}
          {#each s.examples ?? [] as ex, i (i)}
            <div class="ex" class:bad={ex.kind === 'bad'}>
              <span class="ex-h">{#if ex.kind === 'bad'}<ThumbsDown size={14} />{:else}<ThumbsUp size={14} />{/if} {ex.label ?? (ex.kind === 'bad' ? 'Антипример' : 'Пример')}</span>
              <p>{ex.text}</p>
              {#if ex.why}<small>{ex.why}</small>{/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .lead { font-family: var(--font-read); line-height: 1.55; color: var(--ink-2); margin: var(--sp-3) 0; }
  h3 { font-size: var(--text-md); margin: 0 0 var(--sp-2); }
  .crit { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  .crit td { padding: 6px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .crit small { display: block; color: var(--ink-3); font-size: var(--text-xs); }
  .crit .pts { text-align: right; font-weight: 700; color: var(--accent); white-space: nowrap; padding-left: var(--sp-3); }
  .crit .sum td { border-bottom: 0; font-weight: 700; }
  .note { font-size: var(--text-xs); margin: var(--sp-2) 0 0; }
  .sections { display: flex; flex-direction: column; gap: 6px; margin-top: var(--sp-4); }
  .sec { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-1); }
  .head { display: flex; align-items: center; gap: var(--sp-2); width: 100%; padding: 12px 14px; border: 0; background: none; cursor: pointer; color: var(--ink); text-align: left; font-size: var(--text-md); }
  .head :global(svg) { transition: transform var(--dur-2); color: var(--ink-3); }
  .open .head :global(svg) { transform: rotate(180deg); }
  .body { padding: 0 14px 14px; font-size: var(--text-sm); line-height: 1.5; color: var(--ink-2); }
  .body p { margin: 0 0 var(--sp-2); font-family: var(--font-read); }
  .body ol, .body ul { margin: 0 0 var(--sp-2); padding-left: 1.2em; display: flex; flex-direction: column; gap: 4px; }
  .formula { font-family: var(--font-display) !important; font-weight: 700; color: var(--accent); padding: 8px 12px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); border-radius: 0 var(--r-sm) var(--r-sm) 0; }
  .tbl { overflow-x: auto; margin-bottom: var(--sp-2); }
  .tbl table { border-collapse: collapse; font-size: var(--text-xs); min-width: 100%; }
  .tbl th, .tbl td { border: 1px solid var(--line); padding: 4px 6px; text-align: left; vertical-align: top; }
  .tbl th { background: var(--surface-2, var(--bg)); }
  .ex { margin-top: var(--sp-2); padding: 10px 12px; border-radius: var(--r-sm); background: var(--success-soft); }
  .ex.bad { background: var(--danger-soft); }
  .ex-h { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 700; color: var(--success); margin-bottom: 4px; }
  .ex.bad .ex-h { color: var(--danger); }
  .ex p { margin: 0; color: var(--ink); }
  .ex small { display: block; margin-top: 4px; color: var(--ink-3); }
</style>
