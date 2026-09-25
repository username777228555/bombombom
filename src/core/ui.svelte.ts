import type { Component } from 'svelte';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

export interface Celebration {
  kind: 'rank' | 'order' | 'goal';
  title: string;
  subtitle?: string;
  orderId?: string;
  rankIndex?: number;
}

export interface SheetState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>;
  props?: Record<string, unknown>;
  title?: string;
}

export const ui = $state({
  toasts: [] as Toast[],
  celebrations: [] as Celebration[],
  sheet: null as SheetState | null,
  confirm: null as null | { title: string; message?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void },
});

let nextId = 1;
export function toast(message: string, kind: Toast['kind'] = 'info', timeout = 2600): void {
  const t = { id: nextId++, message, kind };
  ui.toasts.push(t);
  setTimeout(() => {
    const i = ui.toasts.findIndex((x) => x.id === t.id);
    if (i >= 0) ui.toasts.splice(i, 1);
  }, timeout);
}

export const celebrate = (c: Celebration) => ui.celebrations.push(c);
export const openSheet = (s: SheetState) => (ui.sheet = s);
export const closeSheet = () => (ui.sheet = null);

export function confirmDialog(title: string, opts: { message?: string; ok?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    ui.confirm = { title, message: opts.message, ok: opts.ok ?? 'Да', danger: opts.danger, resolve };
  });
}
