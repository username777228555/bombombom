<script lang="ts">
  /** Monogram «Съ» in a gilded frame — the app mark. */
  let { size = 44 }: { size?: number } = $props();
</script>

<svg class="emblem" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <linearGradient id="emb-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9a2536" />
      <stop offset="1" stop-color="#5e1320" />
    </linearGradient>
    <linearGradient id="emb-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d68e" />
      <stop offset="0.5" stop-color="#c79a3e" />
      <stop offset="1" stop-color="#8c6420" />
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#emb-bg)" />
  <rect x="9" y="9" width="82" height="82" rx="18" fill="none" stroke="url(#emb-gold)" stroke-width="2.2" />
  <rect x="13" y="13" width="74" height="74" rx="15" fill="none" stroke="url(#emb-gold)" stroke-width="0.8" stroke-opacity="0.7" />
  <text x="47" y="71" text-anchor="middle" font-family="Old Standard TT, Georgia, serif" font-weight="700" font-size="58" fill="url(#emb-gold)">С</text>
  <text x="72" y="71" text-anchor="middle" font-family="Old Standard TT, Georgia, serif" font-weight="700" font-size="30" fill="url(#emb-gold)">ъ</text>
  <path d="M50 17 l3 4 -3 4 -3 -4z" fill="url(#emb-gold)" />
  <path d="M50 75 l3 4 -3 4 -3 -4z" fill="url(#emb-gold)" />
</svg>

<style>
  .emblem { display: block; flex: 0 0 auto; filter: drop-shadow(0 3px 8px rgba(94, 19, 32, 0.28)); }
</style>
