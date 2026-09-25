import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

let hapticsEnabled = true;
export const setHapticsEnabled = (v: boolean) => (hapticsEnabled = v);

export async function applySystemBars(dark: boolean): Promise<void> {
  if (!isNative) return;
  try {
    await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  } catch {
    /* older WebView/plugin: ignore */
  }
}

/** Wires the Android back button. `handle` returns true when the app consumed the event. */
export async function initPlatform(handle: () => boolean): Promise<void> {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (!handle()) void App.minimizeApp();
  });
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide({ fadeOutDuration: 250 });
}

export type HapticKind = 'tap' | 'select' | 'success' | 'error' | 'heavy';

export function haptic(kind: HapticKind = 'tap'): void {
  if (!hapticsEnabled) return;
  if (isNative) {
    void import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
      if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
      if (kind === 'error') return Haptics.notification({ type: NotificationType.Error });
      if (kind === 'select') return Haptics.selectionChanged();
      return Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light });
    }).catch(() => {});
    return;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'error' ? [25, 40, 25] : kind === 'success' ? [12, 30, 12] : 8);
    } catch {
      /* not allowed before user gesture */
    }
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Saves/exports a file: share sheet on Android, download in the browser. */
export async function exportFile(name: string, data: Blob | string, mime = 'application/json'): Promise<void> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const written = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ title: name, files: [written.uri], dialogTitle: 'Сохранить файл' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Opens the native file picker and resolves with the chosen files. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Android maps `accept` to MIME types and silently drops unknown extensions (.fb2, .fbz, .azw3),
    // hiding those files in the picker. Formats are detected by content anyway, so allow any file there.
    if (!isNative) input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve([]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
