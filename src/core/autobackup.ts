/**
 * Копия в аккаунте Google (Android Auto Backup). Система раз в сутки, когда телефон заряжается и стоит на Wi-Fi,
 * сохраняет из данных приложения только один файл — снимок `files/autobackup/stolypin.json` (правила —
 * android/app/src/main/res/xml/backup_rules.xml и data_extraction_rules.xml). Это тот же JSON, что «Сохранить
 * резервную копию» (core/backup.ts): прогресс, настройки, заметки, свои колоды — без ключа ИИ, токена GitHub,
 * файлов книг и кэша WebView, поэтому копия маленькая и не упирается в лимит Google 25 МБ. После переустановки
 * Android возвращает файл ещё до первого запуска, и приложение восстанавливает из него прогресс, пока база пуста.
 *   await restoreFromGoogle()   // App.svelte, до загрузки настроек: true — прогресс восстановлен
 *   initAutoBackup()            // после загрузки: снимок обновляется при каждом уходе из приложения
 */
import { backupJson, restoreBackup } from './backup';
import { db } from './db';
import { isNative } from './platform';

const PATH = 'autobackup/stolypin.json';
let saved = '';

export async function restoreFromGoogle(): Promise<boolean> {
  // Any saved settings mean the app has been used here: never overwrite live data with the snapshot.
  if (!isNative || (await db.kv.get('settings'))) return false;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { data } = await Filesystem.readFile({ path: PATH, directory: Directory.Data, encoding: Encoding.UTF8 });
    await restoreBackup(String(data));
    return true;
  } catch {
    return false; // no snapshot (a first install) or an unreadable one: start fresh
  }
}

async function save(): Promise<void> {
  const json = await backupJson(false);
  if (json === saved) return;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  await Filesystem.writeFile({ path: PATH, directory: Directory.Data, data: json, encoding: Encoding.UTF8, recursive: true });
  saved = json;
}

export function initAutoBackup(): void {
  if (!isNative) return;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void save().catch(() => {});
  });
  // The first snapshot right away: after an update the old full backup is replaced only by a non-empty one.
  setTimeout(() => void save().catch(() => {}), 5000);
}
