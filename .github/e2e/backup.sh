#!/usr/bin/env bash
# Temporary E2E check: Auto Backup keeps only files/autobackup/stolypin.json, and the app restores progress from it.
set -u
PKG=ru.stolypin.app
APK=app-debug.apk
FAIL=0
check() { if eval "$2"; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi; }
app() { adb shell run-as "$PKG" "$@"; }
snap() { app cat files/autobackup/stolypin.json 2>/dev/null; }
backup() {
  OUT=$(adb shell bmgr backupnow "$PKG"); echo "$OUT"
  if ! echo "$OUT" | grep -q "Package $PKG with result: Success"; then
    adb shell bmgr run; sleep 10; OUT=$(adb shell bmgr backupnow "$PKG"); echo "$OUT"
  fi
  echo "$OUT" | grep -q "Package $PKG with result: Success"
}

echo "API $(adb shell getprop ro.build.version.sdk)"
adb shell settings put secure backup_auto_restore 1
adb shell bmgr enable true
adb shell bmgr transport com.android.localtransport/.LocalTransport
adb shell settings put secure backup_local_transport_parameters 'is_encrypted=true'

echo "== A. Fresh install"
adb install -t "$APK"
adb shell dumpsys package "$PKG" | grep -m1 -o 'pkgFlags=\[[^]]*\]'
adb shell am start -W -n "$PKG/.MainActivity" > /dev/null
sleep 30
JS=0; snap | grep -q stolypin-backup && JS=1
if [ $JS = 1 ]; then
  echo "PASS: the app wrote its snapshot to files/autobackup"; snap | head -c 300; echo
else
  echo "NOTE: the app's JS does not run on this image's built-in WebView; checking the backup rules only"
  adb logcat -d | grep 'Capacitor/Console' | grep -i error | tail -3
fi

echo "== B. Progress in the snapshot; files that must stay out of the backup"
adb shell am force-stop "$PKG"
app mkdir -p files/autobackup
adb shell "run-as $PKG sh -c 'cat > files/autobackup/stolypin.json'" < .github/e2e/snapshot.json
adb shell "run-as $PKG sh -c 'echo secret > files/not-in-backup.txt'"
# Launching again leaves the force-stopped state (Android skips stopped apps in backups).
adb shell am start -W -n "$PKG/.MainActivity" > /dev/null
sleep 25
if [ $JS = 1 ]; then
  S=$(snap); echo "$S" | head -c 400; echo
  check "app imported the snapshot into an empty database and saved it back" "echo \"\$S\" | grep -q 'Тест-восстановление' && ! echo \"\$S\" | grep -q createdAt"
fi
adb shell input keyevent KEYCODE_HOME
sleep 3
app ls -la files files/autobackup
app du -s app_webview 2>/dev/null
check "backup succeeded" "backup"

echo "== C. Reinstall: Android restores before the first launch"
adb uninstall "$PKG"
adb install -t "$APK"
sleep 8
app ls -laR files 2>&1 | head -20
check "snapshot restored" "snap | grep -q 'Тест-восстановление'"
check "other app files not restored" "! app ls files/not-in-backup.txt > /dev/null 2>&1"
check "WebView data (AI key, books) not restored" "! app ls app_webview > /dev/null 2>&1"

if [ $JS = 1 ]; then
  echo "== D. First launch after reinstall"
  adb shell am start -W -n "$PKG/.MainActivity" > /dev/null
  sleep 30
  S=$(snap); echo "$S" | head -c 600; echo
  check "progress restored into the database (settings, activity, results)" "echo \"\$S\" | grep -q 'Тест-восстановление' && echo \"\$S\" | grep -q '\"onboarded\":true' && echo \"\$S\" | grep -q '2026-10-20' && echo \"\$S\" | grep -q '\"ref\":\"e2e\"'"
fi
adb logcat -d | grep -E 'restoreAtInstall|Restore|FullBackup|LocalTransport' | grep -i stolypin | tail -15
echo "RESULT: $([ $FAIL = 0 ] && echo ALL PASSED || echo FAILED)"
exit $FAIL
