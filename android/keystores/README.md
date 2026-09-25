# Ключ подписи для установки на свой телефон

`stolypin-debug.keystore` (пароль `stolypin-debug`, alias `stolypin`) — **намеренно несекретный** ключ.
Им подписываются все сборки, поэтому новая версия APK из GitHub Actions ставится поверх старой,
а прогресс в приложении сохраняется.

Для публикации в Google Play или RuStore нужен собственный секретный ключ. Добавьте в
Settings → Secrets → Actions репозитория `STOLYPIN_KEYSTORE_B64` (keystore в base64) и
`STOLYPIN_KEYSTORE_PASSWORD`. Сборка подпишется им автоматически, но такой APK уже не встанет
поверх версии, подписанной этим ключом.
