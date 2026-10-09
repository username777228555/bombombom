<script lang="ts">
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import { answerMatches } from '$lib/core/utils/text';
  import { answerFormat, expandAnswers } from '$lib/core/content/answers';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'text' }>> = $props();
  let value = $state('');
  let ok = $state(false);
  const accepted = $derived(expandAnswers(q.answers));
  const format = $derived(answerFormat(q.answers));
  function check() {
    ok = answerMatches(value, accepted);
    onsubmit(ok ? 1 : 0);
  }
</script>

<div class="wrap">
  <TextField bind:value placeholder="Ваш ответ" hint={revealed ? undefined : format} autofocus onenter={() => value.trim() && !revealed && check()} status={revealed ? (ok ? 'ok' : 'bad') : 'none'} />
  {#if revealed && !ok}<p class="answer">Верный ответ: <b>{q.answers[0]}</b></p>{/if}
</div>
{#if !revealed}
  <Button full size="lg" disabled={!value.trim()} onclick={check}>Проверить</Button>
{/if}

<style>
  .wrap { margin-bottom: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .answer { color: var(--success); }
</style>
