/**
 * Lesson text → HTML: paragraphs and **bold** like richText, plus `[[id]]` / `[[id|подпись]]` links to the
 * knowledge base rendered as buttons with `data-ref` (the page opens the entity sheet on tap).
 */
import { escapeHtml, richText } from '$lib/core/utils/text';
import { kb } from '$lib/core/content/kb.svelte';

export function lessonHtml(text: string): string {
  return richText(text).replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, label?: string) =>
    kb.get(id) ? `<button type="button" class="ref" data-ref="${id}">${label ?? escapeHtml(kb.title(id))}</button>` : (label ?? id),
  );
}

/** Plain text without link markup (for previews). */
export const lessonPlain = (text: string) => text.replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([a-z0-9-]+)\]\]/g, (_, id: string) => kb.title(id));
