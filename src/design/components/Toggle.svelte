<script lang="ts">
  import { haptic } from '$lib/core/platform';
  interface Props {
    checked: boolean;
    label?: string;
    onchange?: (v: boolean) => void;
  }
  let { checked = $bindable(), label, onchange }: Props = $props();
</script>

<button
  class="toggle"
  class:on={checked}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => {
    haptic('select');
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    position: relative;
    width: 50px;
    height: 30px;
    flex: 0 0 auto;
    border-radius: var(--r-full);
    border: 1px solid var(--line-strong);
    background: var(--surface-3);
    cursor: pointer;
    transition: background-color var(--dur-2), border-color var(--dur-2);
  }
  .on { background: var(--accent); border-color: var(--accent); }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--dur-3) var(--ease-spring);
  }
  .on .knob { transform: translateX(20px); }
</style>
