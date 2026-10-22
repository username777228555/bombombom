# Сервер «Помощи Василия» (ИИ)

`ai-proxy.mjs` — посредник между приложением и моделью ИИ: ключ к модели лежит только здесь, приложение присылает
название задания и текст ученика, промпт сервер собирает сам (`ai-tasks.mjs`). Node 20+, без зависимостей.

Сервер не обязателен: без него каждый вставляет ключ в «Настройки → Помощь Василия», и приложение ходит к модели
напрямую с того же `ai-tasks.mjs`. Сервер нужен, чтобы раздать ИИ многим, не раздавая ключ.

| Путь | Что делает |
|------|-----------|
| `POST /ai/retell` | проверка пересказа урока: какие пункты раскрыты, фактические ошибки, отзыв |
| `POST /ai/why` | «Почему я ошибся?» — короткое объяснение ошибки в тесте |
| `POST /ai/fork` | «Развилки»: вердикт решению игрока и что из него последует (как было на самом деле — справка из приложения) |
| `POST /ai/ask` | «Спросить Василия» на карточке: ответ по этой карточке и соседним |
| `GET /ai/health` | проверка, что сервер жив |

## Настройки (переменные окружения)

| Переменная | По умолчанию | Зачем |
|-----------|--------------|-------|
| `AI_KEY` | — (обязательно) | ключ к модели |
| `AI_BASE` | `https://api.reformboss.com/v1` | OpenAI-совместимый адрес |
| `AI_MODELS` | у каждого задания свой порядок (`ai-tasks.mjs`) | модели по порядку для всех заданий: если первая не ответила (сбой, отказ, оборванный ответ), берётся следующая; после двоеточия — `reasoning_effort` |
| `LIMIT_INSTALL` | `40` | запросов в день с одной установки |
| `LIMIT_IP` | `200` | запросов в день с одного IP |
| `LIMIT_TOKENS` | `20000000` | токенов в день на всех; дальше сервер отвечает «перегружен» |
| `PORT` | `8787` | порт |
| `STATE_FILE` | `data/ai-state.json` | счётчики дня (переживают перезапуск) |

Тексты учеников сервер не пишет ни в логи, ни на диск — только счётчики.

## Запуск на VPS

Сервер должен открываться из России без VPN: подойдёт недорогой VPS в России или рядом. Cloudflare в России
работает с перебоями.

```bash
# на сервере: Node 20+ и два файла
sudo mkdir -p /opt/stolypin && sudo cp ai-proxy.mjs ai-tasks.mjs /opt/stolypin/
sudo tee /etc/systemd/system/stolypin-ai.service <<'UNIT'
[Unit]
Description=СТОЛЫПИНЪ AI proxy
After=network.target
[Service]
WorkingDirectory=/opt/stolypin
Environment=AI_KEY=sk-...
ExecStart=/usr/bin/node /opt/stolypin/ai-proxy.mjs
Restart=always
DynamicUser=yes
StateDirectory=stolypin
Environment=STATE_FILE=/var/lib/stolypin/ai-state.json
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now stolypin-ai
```

HTTPS обязателен (приложение ходит только по https): проще всего Caddy перед сервером —
`ai.example.ru { reverse_proxy 127.0.0.1:8787 }` в `/etc/caddy/Caddyfile`, сертификат он получит сам.
Caddy передаёт адрес клиента в `X-Forwarded-For`, по нему считается лимит на IP.

## Подключить к приложению

В GitHub: Settings → Secrets and variables → Actions → Variables → `AI_URL` = `https://ai.example.ru`.
CI соберёт APK с этим адресом (`VITE_AI_URL`), и в приложении появятся кнопки «Проверить с Василием»
и «Почему я ошибся?». Без переменной кнопок нет. Локально: `VITE_AI_URL=http://127.0.0.1:8787 pnpm dev`.
