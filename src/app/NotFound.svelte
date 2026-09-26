<script lang="ts">
  import { Compass } from '@lucide/svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import Button from '$lib/design/components/Button.svelte';
  let { message }: { message?: string } = $props();
</script>

<div class="page">
  <EmptyState icon={Compass} title="Здесь ничего нет" text={message ?? 'Такой страницы не существует. Вернёмся на главную?'}>
    <Button href="/">На главную</Button>
  </EmptyState>
</div>
