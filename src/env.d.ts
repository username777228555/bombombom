/// <reference types="svelte" />
/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** The AI proxy (server/ai-proxy.mjs); empty — the AI buttons are hidden. */
  readonly VITE_AI_URL?: string;
}
