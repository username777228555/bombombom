#!/usr/bin/env python3
"""
Иллюстрации с Wikimedia Commons для пакетов контента — с автором, датой, лицензией и описанием.

Для каждой персоналии / события / памятника культуры берётся главная картинка статьи русской Википедии
(ссылка из `refs`; для культуры без ссылки — поиск по названию), проверяется, что файл лежит на Commons
под свободной лицензией, и скачивается уменьшенная копия:
  * портреты (persons) — квадрат 384×384, обрезанный по найденному лицу (OpenCV), чтобы в круглых
    аватарах лицо было по центру;
  * события — длинная сторона до 640 px; культура — до 900 px. Всё в webp.
В JSON пакета записываются `image` и `imageInfo` { title, author, date, about, license, source }.

Использование (из корня репозитория, нужен интернет и `pip install requests pillow opencv-python`):
  python3 scripts/media/wiki_images.py fetch  [--pack osnova] [--kinds persons,events,culture] [--missing-only]
  python3 scripts/media/wiki_images.py apply  [--pack osnova]
  python3 scripts/media/wiki_images.py report
  python3 scripts/media/wiki_images.py gc      # удалить неиспользуемые файлы и битые ссылки
В GitHub Actions всё это делает workflow «Media» (.github/workflows/media.yml): запускается вручную или
коммитом с «[media]» в сообщении в ветку gumball/** / media/** и коммитит картинки обратно в ветку.
`fetch` складывает картинки и manifest.json в .cache/wiki-images/<pack>/ (ничего не меняя в content/),
`apply` переносит их в content/packs/<pack>/images/ и прописывает поля в JSON, `report` печатает итоги.
Правила: только public domain / CC0 / CC BY / CC BY-SA / GFDL / FAL; флаги, гербы, подписи и логотипы
отбрасываются. После apply запустите `pnpm content:check`.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import glob
import html
import io
import json
import os
import re
import sys
import threading
import time
import urllib.parse

import requests
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = 'StolypinHistoryApp/0.3 (educational offline app; https://github.com/username777228555/bombombom)'
S = requests.Session()
S.headers['User-Agent'] = UA
RU_API = 'https://ru.wikipedia.org/w/api.php'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
FREE = re.compile(r'public domain|^pd|pd-|cc0|cc[ -]by|gfdl|fal|free art|attribution', re.I)
NONFREE = re.compile(r'fair use|non-free|несвободн', re.I)
BAD_NAME = re.compile(r'signature|autograph|подпис|coat[ _]of[ _]arms|герб|flag|флаг|seal|печать|logo|логотип|emblem|эмблем|монограмм|stamp|марка_|coin|монета', re.I)
MAP_NAME = re.compile(r'map|карта|схема|scheme', re.I)
LONG_SIDE = {'events': 640, 'culture': 900}
QUALITY = {'persons': 76, 'events': 68, 'culture': 74}
PORTRAIT = 384
MAX_BYTES = 290_000


def get(url: str, params: dict, tries: int = 5) -> dict:
    for i in range(tries):
        r = S.get(url, params={**params, 'format': 'json', 'formatversion': 2}, timeout=60)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(2 + i * 3)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f'API failed: {url} {params}')


def chunks(xs: list, n: int = 40):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def clean(s: str | None, limit: int = 220) -> str:
    if not s:
        return ''
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ')
    s = re.sub(r'\s+', ' ', s).strip(' .;,')
    return s if len(s) <= limit else s[:limit - 1].rsplit(' ', 1)[0] + '…'


def wiki_title(refs: list[str] | None, wiki: str | None = None) -> str | None:
    if wiki:
        return wiki
    for r in refs or []:
        m = re.match(r'https?://ru\.(?:m\.)?wikipedia\.org/wiki/([^#?]+)', r)
        if m:
            return urllib.parse.unquote(m.group(1)).replace('_', ' ')
    return None


# ——— loading content ——————————————————————————————————————————————————————————————
def load_pack(pack: str):
    items = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'content/packs', pack, 'data', '**', '*.json'), recursive=True)):
        data = json.load(open(f, encoding='utf-8'))
        for kind in ('persons', 'events', 'culture'):
            for it in data.get(kind, []):
                items.append({'kind': kind, 'file': os.path.relpath(f, ROOT), 'item': it})
    return items


def search_article(query: str) -> str | None:
    d = get(RU_API, {'action': 'query', 'list': 'search', 'srsearch': query, 'srlimit': 1, 'srprop': '', 'srnamespace': 0})
    hits = d.get('query', {}).get('search', [])
    return hits[0]['title'] if hits else None


def culture_query(it: dict) -> str:
    t = re.sub(r'[«»"“”]', '', it['title'])
    return f"{t} {it.get('authorName', '')}".strip()


# ——— metadata ————————————————————————————————————————————————————————————————————
def page_images(titles: list[str]) -> dict[str, str]:
    """ru.wiki article title → lead image file name (as Wikipedia reports it)."""
    out: dict[str, str] = {}
    for part in chunks(sorted(set(titles))):
        d = get(RU_API, {'action': 'query', 'prop': 'pageimages', 'piprop': 'name', 'redirects': 1, 'titles': '|'.join(part)})
        q = d.get('query', {})
        back: dict[str, str] = {t: t for t in part}
        for n in q.get('normalized', []):
            back[n['to']] = back.get(n['from'], n['from'])
        for r in q.get('redirects', []):
            back[r['to']] = back.get(r['from'], r['from'])
        for p in q.get('pages', []):
            if p.get('pageimage'):
                out[back.get(p['title'], p['title'])] = p['pageimage']
        time.sleep(0.3)
    return out


def commons_info(files: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for part in chunks(sorted(set(files)), 30):
        d = get(COMMONS_API, {
            'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 960,
            'iiextmetadatalanguage': 'ru', 'titles': '|'.join('File:' + f for f in part),
        })
        q = d.get('query', {})
        back = {('File:' + f): f for f in part}
        for n in q.get('normalized', []):
            back[n['to']] = back.get(n['from'], n['from'])
        for p in q.get('pages', []):
            if p.get('missing') or not p.get('imageinfo'):
                continue  # not on Commons → a local (usually non-free) Wikipedia file
            ii = p['imageinfo'][0]
            out[back.get(p['title'], p['title'].removeprefix('File:'))] = ii
        time.sleep(0.3)
    return out


def image_info(ii: dict, file: str) -> dict:
    m = ii.get('extmetadata', {})
    v = lambda k: m.get(k, {}).get('value')
    author = clean(v('Artist'), 90) or clean(v('Credit'), 90)
    if re.search(r'unknown|неизвестн|anonymous|аноним', author, re.I) or not author:
        author = 'Неизвестный автор'
    title = clean(v('ObjectName'), 120) or re.sub(r'\.[a-z]+$', '', file, flags=re.I).replace('_', ' ')
    desc = clean(v('ImageDescription'), 240)
    return {
        'title': title,
        'author': author,
        'date': clean(v('DateTimeOriginal'), 40),
        'about': desc if re.search('[А-Яа-яЁё]', desc) else '',
        'license': clean(v('LicenseShortName'), 40) or 'см. источник',
        'source': ii.get('descriptionurl', ''),
        'thumb': ii.get('thumburl') or ii.get('url'),
        'width': ii.get('width', 0),
        'mime': ii.get('mime', ''),
        'free': bool(FREE.search(v('LicenseShortName') or '') or (v('Copyrighted') == 'False')) and not NONFREE.search(v('LicenseShortName') or ''),
    }


# ——— image processing ——————————————————————————————————————————————————————————————
_cascades = None
_cv_lock = threading.Lock()  # OpenCV classifiers are not thread-safe


YUNET_URL = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'


def find_face(img: Image.Image):
    """Most confident face (x, y, w, h) in image pixels, or None. YuNet (DNN) first, Haar cascades as fallback."""
    import cv2
    import numpy as np
    model = os.path.join(ROOT, '.cache', 'face_detection_yunet_2023mar.onnx')
    if not os.path.exists(model):
        try:
            os.makedirs(os.path.dirname(model), exist_ok=True)
            open(model, 'wb').write(download(YUNET_URL))
        except Exception:  # noqa: BLE001 — no network: use Haar
            pass
    if os.path.exists(model) and hasattr(cv2, 'FaceDetectorYN'):
        arr = cv2.cvtColor(np.array(img.convert('RGB')), cv2.COLOR_RGB2BGR)
        k = min(1.0, 800 / max(arr.shape[:2]))
        if k < 1:
            arr = cv2.resize(arr, None, fx=k, fy=k)
        h, w = arr.shape[:2]
        det = cv2.FaceDetectorYN.create(model, '', (w, h), 0.55, 0.3, 50)
        _, faces = det.detect(arr)
        if faces is not None and len(faces):
            best = max(faces, key=lambda f: float(f[-1]) * float(f[2] * f[3]) ** 0.5)
            x, y, fw, fh = (float(v) / k for v in best[:4])
            return (x, y, fw, fh)
        return None
    return find_face_haar(img)


def find_face_haar(img: Image.Image):
    """Largest plausible face (x, y, w, h) by Haar cascades, or None. Prefers faces in the upper part."""
    global _cascades
    import cv2
    import numpy as np
    if _cascades is None:
        _cascades = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in (
            'haarcascade_frontalface_default.xml', 'haarcascade_frontalface_alt2.xml', 'haarcascade_profileface.xml')]
    g = cv2.cvtColor(np.array(img.convert('RGB')), cv2.COLOR_RGB2GRAY)
    k = min(1.0, 800 / max(g.shape))
    if k < 1:
        g = cv2.resize(g, None, fx=k, fy=k)
    g = cv2.equalizeHist(g)
    H, W = g.shape
    min_side = max(24, int(min(H, W) * 0.07))
    best = None
    for i, c in enumerate(_cascades):
        for flip in ((False, True) if i == 2 else (False,)):
            gg = cv2.flip(g, 1) if flip else g
            for (x, y, w, h) in c.detectMultiScale(gg, scaleFactor=1.08, minNeighbors=5, minSize=(min_side, min_side)):
                if flip:
                    x = W - x - w
                score = w * h * (1.4 if (y + h / 2) < H * 0.6 else 0.6)
                if best is None or score > best[0]:
                    best = (score, x / k, y / k, w / k, h / k)
        if best:
            break
    return best[1:] if best else None


def portrait_crop(img: Image.Image) -> tuple[Image.Image, bool]:
    W, H = img.size
    with _cv_lock:
        face = find_face(img)
    if face:
        x, y, w, h = face
        side = min(max(h * 2.7, min(W, H) * 0.42), W, H)
        cx, cy = x + w / 2, y + h / 2 + h * 0.18
    else:
        # No face found: tall images keep the top (heads are there), others are cropped around the centre
        # (miniatures of the «Царский титулярник» put the portrait in the middle of an ornamental frame).
        side = min(W, H) * (0.9 if H <= W * 1.2 else 1.0)
        cx, cy = W / 2, (min(H * 0.04 + side / 2, H - side / 2) if H > W * 1.2 else H / 2)
    x0 = int(max(0, min(W - side, cx - side / 2)))
    y0 = int(max(0, min(H - side, cy - side / 2)))
    return img.crop((x0, y0, x0 + int(side), y0 + int(side))).resize((PORTRAIT, PORTRAIT), Image.LANCZOS), bool(face)


def to_webp(img: Image.Image, quality: int) -> bytes:
    for q in (quality, quality - 8, quality - 16, quality - 24):
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=q, method=6)
        if buf.tell() <= MAX_BYTES:
            break
    return buf.getvalue()


def process(kind: str, raw: bytes) -> tuple[bytes, bool]:
    img = Image.open(io.BytesIO(raw))
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGBA')
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    img = img.convert('RGB')
    face = False
    if kind == 'persons':
        img, face = portrait_crop(img)
    else:
        img.thumbnail((LONG_SIDE[kind], LONG_SIDE[kind]), Image.LANCZOS)
    return to_webp(img, QUALITY[kind]), face


def download(url: str) -> bytes:
    for i in range(5):
        r = S.get(url, timeout=(10, 40))
        if r.status_code == 429:
            time.sleep(3 + i * 4)
            continue
        r.raise_for_status()
        return r.content
    raise RuntimeError(f'download failed {url}')


# ——— commands ————————————————————————————————————————————————————————————————————
def cache_dir(pack: str) -> str:
    d = os.path.join(ROOT, '.cache', 'wiki-images', pack)
    os.makedirs(os.path.join(d, 'img'), exist_ok=True)
    return d


def cmd_fetch(a):
    items = [x for x in load_pack(a.pack) if x['kind'] in a.kinds]
    if a.ids:
        items = [x for x in items if x['item']['id'] in a.ids]
    if a.missing_only:
        items = [x for x in items if not x['item'].get('image')]
    cdir = cache_dir(a.pack)
    manifest_path = os.path.join(cdir, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {}

    titles: dict[str, str] = {}
    for x in items:
        it = x['item']
        t = wiki_title(it.get('refs'), it.get('wiki'))
        if not t and x['kind'] == 'culture':
            t = search_article(culture_query(it))
            if t:
                x['found_article'] = t
            time.sleep(0.2)
        if t:
            titles[it['id']] = t
    print(f'articles: {len(titles)}/{len(items)}', flush=True)
    lead = page_images(list(titles.values()))
    files = {iid: lead[t] for iid, t in titles.items() if t in lead}
    # Manual choices win: scripts/media/overrides.json maps an entity id to a Commons file (or null = no picture).
    ov_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'overrides.json')
    overrides = json.load(open(ov_path, encoding='utf-8')) if os.path.exists(ov_path) else {}
    for iid, f in overrides.items():
        if iid.startswith('_'):
            continue
        if f:
            files[iid] = f
        else:
            files.pop(iid, None)
    print(f'lead images: {len(files)}', flush=True)
    info = commons_info(list(files.values()))
    print(f'on Commons: {sum(1 for f in files.values() if f in info)}', flush=True)

    # Portraits without a usable lead image: search Commons itself («Царский титулярник», engravings…).
    def usable(f: str | None, kind: str) -> bool:
        return bool(f) and f in info and image_info(info[f], f)['free'] and not BAD_NAME.search(f) and not (kind == 'persons' and MAP_NAME.search(f))
    for x in items:
        it = x['item']
        if x['kind'] != 'persons' or it['id'] in overrides or usable(files.get(it['id']), 'persons'):
            continue
        name = it.get('short') or it['name']
        for q in (f'{name} Титулярник', f'{it["name"]} портрет', it['name']):
            d = get(COMMONS_API, {'action': 'query', 'list': 'search', 'srnamespace': 6, 'srlimit': 5, 'srsearch': q})
            cands = [h['title'].removeprefix('File:') for h in d.get('query', {}).get('search', []) if re.search(r'\.(jpe?g|png|tiff?|webp)$', h['title'], re.I)]
            cands = [c for c in cands if not BAD_NAME.search(c) and not MAP_NAME.search(c)]
            if cands:
                info.update(commons_info(cands[:1]))
                if usable(cands[0], 'persons'):
                    files[it['id']] = cands[0]
                    break
            time.sleep(0.3)

    jobs = []
    for x in items:
        it, kind = x['item'], x['kind']
        f = files.get(it['id'])
        rec = {'kind': kind, 'file': x['file'], 'article': titles.get(it['id']), 'found_article': x.get('found_article'), 'commons': f}
        if not f:
            rec['skip'] = 'no lead image'
        elif f not in info:
            rec['skip'] = 'not on Commons (non-free?)'
        else:
            meta = image_info(info[f], f)
            rec['meta'] = meta
            if not meta['free']:
                rec['skip'] = f"license: {meta['license']}"
            elif BAD_NAME.search(f) or (kind == 'persons' and MAP_NAME.search(f)):
                rec['skip'] = 'flag/coat/signature/map'
            elif meta['width'] and meta['width'] < (160 if kind == 'persons' else 250) and it['id'] not in overrides:
                rec['skip'] = 'too small'
            elif not meta['mime'].startswith('image/'):
                rec['skip'] = f"mime {meta['mime']}"
        manifest[it['id']] = rec
        if 'skip' not in rec:
            jobs.append((it['id'], rec))

    def work(job):
        iid, rec = job
        out = os.path.join(cdir, 'img', f'{iid}.webp')
        if os.path.exists(out) and os.path.getsize(out) > 0 and not a.refresh:  # resume
            rec['bytes'] = os.path.getsize(out)
            return iid
        try:
            data, face = process(rec['kind'], download(rec['meta']['thumb']))
            open(out, 'wb').write(data)
            rec['bytes'] = len(data)
            rec['face'] = face
        except Exception as e:  # noqa: BLE001 — record and continue
            rec['skip'] = f'error: {e}'[:160]
        return iid

    done = 0
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for _ in ex.map(work, jobs):
            done += 1
            if done % 25 == 0:
                print(f'downloaded {done}/{len(jobs)}', flush=True)
                json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('fetch done', flush=True)
    cmd_report(a)


def cmd_report(a):
    m = json.load(open(os.path.join(cache_dir(a.pack), 'manifest.json'), encoding='utf-8'))
    from collections import Counter
    ok = Counter(r['kind'] for r in m.values() if 'skip' not in r)
    skip = Counter((r['kind'], r['skip'].split(':')[0]) for r in m.values() if 'skip' in r)
    faces = sum(1 for r in m.values() if r.get('face'))
    size = sum(r.get('bytes', 0) for r in m.values())
    print('ok:', dict(ok), '| faces found:', faces, '| total', round(size / 1e6, 1), 'MB')
    print('skipped:', dict(skip))


def clean_date(date: str, license: str) -> str:
    """EXIF timestamps are scan/upload times, not creation dates: keep the year, drop them for old PD works."""
    d = re.sub(r'date QS:.*$|QS:P.*$', '', date or '')  # Wikidata template leftovers
    d = re.sub(r'\s+\d{1,2}:\d{2}(:\d{2})?$', '', d).strip(' ,;')
    m = re.match(r'^(\d{4})-\d{2}-\d{2}$', d)
    if m:
        if int(m.group(1)) >= 1990 and re.search(r'public domain|^pd', license or '', re.I):
            return ''
        return m.group(1)
    return d


LATIN = re.compile(r'[A-Za-z]')
CYRILLIC = re.compile(r'[А-Яа-яЁё]')
BOILERPLATE = re.compile(r'загруж|участник|википеди|wikipedia|собственн|own work|user:|фото:|photo|http|@', re.I)
ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI']


def ru_date(date: str) -> str:
    """English Commons dates → Russian («circa 1830» → «ок. 1830», «17th century» → «XVII век»); otherwise ''."""
    t = (date or '').strip()
    t = re.sub(r'\b(circa|ca\.|c\.)\s*', 'ок. ', t, flags=re.I)
    t = re.sub(r'\bbetween\s+(\d{3,4})\s+and\s+(\d{3,4})', r'\1–\2', t, flags=re.I)
    t = re.sub(r'\b(\d{3,4})s\b', r'\1-е', t)
    t = re.sub(r'\bbefore\b', 'до', t, flags=re.I)
    t = re.sub(r'\bafter\b', 'после', t, flags=re.I)

    def cent(m):
        pre = (m.group(1) or '').lower().strip()
        n = int(m.group(2))
        if n >= len(ROMAN):
            return m.group(0)
        prefix = {'early': 'начало ', 'late': 'конец ', 'mid': 'середина ', 'mid-': 'середина ', '1st half of': 'первая половина ',
                  'first half of': 'первая половина ', '2nd half of': 'вторая половина ', 'second half of': 'вторая половина '}.get(pre, '')
        return f'{prefix}{ROMAN[n]} {"века" if prefix else "век"}'
    t = re.sub(r'\b(early|late|mid-?|1st half of|first half of|2nd half of|second half of)?\s*(\d{1,2})(?:st|nd|rd|th)[ -]century', cent, t, flags=re.I)
    t = re.sub(r'\s+', ' ', t).strip(' ,;')
    return '' if LATIN.search(t) else t


def sanitize_info(info: dict, kind: str, it: dict) -> dict:
    """Only Russian credits are shown to students: Latin-script authors/titles and Commons boilerplate are dropped."""
    out: dict = {}
    title = (info.get('title') or '').strip().strip('«»"')
    if title and CYRILLIC.search(title) and not LATIN.search(title) and not re.search(r'_|\.(jpe?g|png|tiff?)$', title, re.I):
        out['title'] = title
    author = (info.get('author') or '').strip()
    if author and CYRILLIC.search(author) and not LATIN.search(author) and not BOILERPLATE.search(author):
        out['author'] = author
    date = ru_date(info.get('date', ''))
    if date:
        out['date'] = date
    about = re.sub(r'Это фотография объекта культурного наследия[^.]*\.?|Изначально этот файл[^.]*\.?|номер:\s*[\d-]+', '', info.get('about') or '')
    about = re.sub(r'\s+', ' ', about).strip(' .,;')
    out['about'] = about if CYRILLIC.search(about) and not re.search(r'[A-Za-z]{4,}', about) else author_line({}, kind, it)
    if info.get('license'):
        out['license'] = 'Общественное достояние' if re.search(r'public domain|^pd', info['license'], re.I) else info['license']
    if info.get('source'):
        out['source'] = info['source']
    return out


def author_line(meta: dict, kind: str, it: dict) -> str:
    if meta.get('about'):
        return meta['about']
    name = it.get('short') or it.get('name') or it.get('title', '')
    if kind == 'persons':
        return f'Изображение: {name}.'
    if kind == 'events':
        return f'Иллюстрация к событию «{name}».'
    return f'Изображение: {name}.'


def cmd_apply(a):
    cdir = cache_dir(a.pack)
    m = json.load(open(os.path.join(cdir, 'manifest.json'), encoding='utf-8'))
    removed: list[str] = []
    by_file: dict[str, list] = {}
    for iid, rec in m.items():
        if 'skip' in rec or not os.path.exists(os.path.join(cdir, 'img', f'{iid}.webp')):
            continue
        by_file.setdefault(rec['file'], []).append((iid, rec))
    for rel, recs in by_file.items():
        path = os.path.join(ROOT, rel)
        data = json.load(open(path, encoding='utf-8'))
        index = {it['id']: (kind, it) for kind in ('persons', 'events', 'culture') for it in data.get(kind, [])}
        for iid, rec in recs:
            kind, it = index[iid]
            folder = {'persons': 'persons', 'events': 'events', 'culture': 'culture'}[kind]
            new_rel = f'images/{folder}/{iid}.webp'
            dst = os.path.join(ROOT, 'content/packs', a.pack, new_rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            old = it.get('image')
            if old and old != new_rel and not re.match(r'https?:', old):
                old_path = os.path.join(ROOT, 'content/packs', a.pack, old)
                if os.path.exists(old_path):
                    os.remove(old_path)
                    removed.append(os.path.relpath(old_path, ROOT))
            with open(os.path.join(cdir, 'img', f'{iid}.webp'), 'rb') as src, open(dst, 'wb') as out:
                out.write(src.read())
            meta = rec['meta']
            it['image'] = new_rel
            info = {k: meta[k] for k in ('title', 'author') if meta.get(k)}
            date = clean_date(meta.get('date', ''), meta.get('license', ''))
            if date:
                info['date'] = date
            info['about'] = author_line(meta, kind, it)
            info['license'] = meta['license']
            info['source'] = meta['source']
            it['imageInfo'] = info
            if kind == 'culture' and rec.get('found_article') and not wiki_title(it.get('refs'), it.get('wiki')):
                it['wiki'] = rec['found_article']
            it['imageInfo'] = sanitize_info(it['imageInfo'], kind, it)
        json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(path, 'a', encoding='utf-8').write('\n')
    json.dump(removed, open(os.path.join(cdir, 'removed.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'applied to {sum(len(v) for v in by_file.values())} items in {len(by_file)} files; removed {len(removed)} old files')


def cmd_gc(a):
    """Deletes image files nobody references and drops references to files that do not exist."""
    pack_dir = os.path.join(ROOT, 'content/packs', a.pack)
    used: set[str] = set()
    dropped = 0
    for f in sorted(glob.glob(os.path.join(pack_dir, 'data', '**', '*.json'), recursive=True)):
        data = json.load(open(f, encoding='utf-8'))
        changed = False
        for kind in ('persons', 'events', 'culture'):
            for it in data.get(kind, []):
                img = it.get('image')
                if not img or re.match(r'https?:|data:', img):
                    continue
                if os.path.exists(os.path.join(pack_dir, img)):
                    used.add(os.path.normpath(img))
                else:
                    it.pop('image'); it.pop('imageInfo', None); changed = True; dropped += 1
        if changed:
            json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            open(f, 'a', encoding='utf-8').write('\n')
    removed = 0
    for sub in ('persons', 'events', 'culture'):
        for path in glob.glob(os.path.join(pack_dir, 'images', sub, '*')):
            if os.path.normpath(os.path.relpath(path, pack_dir)) not in used:
                os.remove(path); removed += 1
    print(f'gc: removed {removed} unreferenced files, dropped {dropped} broken references')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('cmd', choices=['fetch', 'apply', 'report', 'gc'])
    p.add_argument('--pack', default='osnova')
    p.add_argument('--kinds', default='persons,events,culture', type=lambda s: s.split(','))
    p.add_argument('--missing-only', action='store_true')
    p.add_argument('--refresh', action='store_true', help='re-download images already in the cache')
    p.add_argument('--ids', default='', type=lambda s: [x for x in s.split(',') if x], help='only these entity ids')
    a = p.parse_args()
    {'fetch': cmd_fetch, 'apply': cmd_apply, 'report': cmd_report, 'gc': cmd_gc}[a.cmd](a)


if __name__ == '__main__':
    main()
