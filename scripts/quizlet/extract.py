#!/usr/bin/env python3
"""
Quizlet print-to-PDF → cards: stage 1 of the Quizlet import, done by a script (no model, no tokens).

  python3 scripts/quizlet/extract.py import/quizlet/*.pdf        # → import/quizlet/work/raw.json + work/img/*.webp
  python3 scripts/quizlet/extract.py import/quizlet/*.txt        # Quizlet «Экспорт»: термин<Tab>определение
  python3 scripts/quizlet/extract.py file.pdf --dump 3            # segments of page 3 with coordinates (layout tuning)
  python3 scripts/quizlet/extract.py file.pdf --preview 1-3       # pages with what was detected drawn → work/preview/

How a page is read: words → text segments (pdfplumber); the term and definition columns are found from the left
edges of segments over the whole file; rows are split by horizontal rules (table borders) or, without them, by
vertical gaps; pictures (pdfium, native resolution) go to the row they overlap. A large font starts a new set, and
«Terms in this set (N)» / «Термины в этом модуле (N)» gives the expected number of cards: a mismatch is reported.
Browser header and footer (date, URL, page numbers) and small print are dropped.

A text export («Экспорт» of a set you own, e.g. a copy of someone else's set) is read too: one card per line, term
and definition split by a tab; a line without a tab continues the previous definition; the file name is the title.

A definition that is only a picture becomes a «who/what is this» card: the picture with a question on the front,
the term on the back. Runbook of the whole import: scripts/quizlet/README.md.
"""
import argparse
import hashlib
import io
import json
import logging
import re
import statistics
import sys
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image, ImageDraw

logging.getLogger('pdfminer').setLevel(logging.ERROR)  # «Could not get FontBBox…» on browser-made PDFs

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'import' / 'quizlet' / 'work'

NOISE = re.compile(r'quizlet\.com|https?://|^\d{1,2}[./]\d{1,2}[./]\d{2,4}|^\d+\s*/\s*\d+$|^(page|стр\.?|seite)\s*\d+|^\d{1,2}:\d{2}', re.I)
COUNT = re.compile(r'(set|модул|набор|наборе|begriffe|términos|termes).*\((\d+)\)\s*$', re.I)
BOILER = re.compile(
    r'^(created by|автор|создано|создатель|erstellt von|teacher|учитель|students also viewed|study|учить|'
    r'flashcards|карточки|learn|заучивание|test|тест|match|подбор|other sets|похожие|preview|save|сохранить)\b', re.I)
IMAGE_QUESTION = 'Кто или что на изображении?'


# ——— reading a page ———————————————————————————————————————————————————————————————————————————————————

def segments(page):
    """Words grouped into lines, lines split into segments at wide gaps (term | definition)."""
    words = page.extract_words(extra_attrs=['size', 'fontname'], x_tolerance=1.5, y_tolerance=2.5)
    words.sort(key=lambda w: (w['top'], w['x0']))
    lines = []
    for w in words:
        if lines and abs(lines[-1][0]['top'] - w['top']) < 2.5:
            lines[-1].append(w)
        else:
            lines.append([w])
    out = []
    for ln in lines:
        ln.sort(key=lambda w: w['x0'])
        cur = [ln[0]]
        for w in ln[1:]:
            if w['x0'] - cur[-1]['x1'] > max(12.0, w['size'] * 1.2):
                out.append(_seg(cur))
                cur = [w]
            else:
                cur.append(w)
        out.append(_seg(cur))
    return out


def _seg(ws):
    return {
        'kind': 'text', 'x0': ws[0]['x0'], 'x1': ws[-1]['x1'],
        'top': min(w['top'] for w in ws), 'bottom': max(w['bottom'] for w in ws),
        'size': statistics.median(w['size'] for w in ws),
        'bold': sum('bold' in w['fontname'].lower() for w in ws) > len(ws) / 2,
        'text': ' '.join(w['text'] for w in ws),
    }


def rules(page):
    """Y of horizontal rules spanning a good part of the page (table borders)."""
    ys = []
    for r in page.rects:
        if r['height'] < 2.5 and r['width'] > page.width * 0.4:
            ys.append(r['top'])
    for ln in page.lines:
        if abs(ln['top'] - ln['bottom']) < 1 and ln['width'] > page.width * 0.4:
            ys.append(ln['top'])
    out = []
    for y in sorted(ys):
        if not out or y - out[-1] > 3:
            out.append(y)
    return out


def pictures(pdf_page, height):
    """Image objects with their boxes (top-left origin) and pixels at native resolution."""
    out = []
    for obj in pdf_page.get_objects(filter=[pdfium_c.FPDF_PAGEOBJ_IMAGE], max_depth=4):
        left, bottom, right, top = obj.get_bounds()
        if right - left < 36 and top - bottom < 36:
            continue  # icons, avatars
        try:
            pil = obj.get_bitmap(render=True).to_pil()
        except Exception:  # noqa: BLE001 — exotic encodings: crop from a page render below
            pil = None
        out.append({'kind': 'image', 'x0': left, 'x1': right, 'top': height - top, 'bottom': height - bottom, 'pil': pil})
    return out


def crop_render(pdf_page, box, scale=2.5):
    bmp = pdf_page.render(scale=scale).to_pil()
    return bmp.crop((int(box['x0'] * scale), int(box['top'] * scale), int(box['x1'] * scale), int(box['bottom'] * scale)))


def save_picture(pil, img_dir):
    pil = pil.convert('RGB')
    pil.thumbnail((800, 800))
    buf = io.BytesIO()
    pil.save(buf, 'WEBP', quality=80, method=5)
    data = buf.getvalue()
    name = hashlib.sha1(data).hexdigest()[:12] + '.webp'
    (img_dir / name).write_bytes(data)
    return f'img/{name}'


def from_text(path):
    """Quizlet text export → one set (no pictures: the export has none)."""
    cards = []
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        if '\t' in line:
            front, _, back = line.partition('\t')
            cards.append({'n': len(cards) + 1, 'front': clean([front]), 'back': clean([back]), 'page': 0})
        elif line.strip() and cards:
            cards[-1]['back'] = clean([cards[-1]['back'], line])
    return {'title': Path(path).stem, 'source': Path(path).name, 'pages': [0, 0], 'expected': None, 'cards': cards}


# ——— layout ————————————————————————————————————————————————————————————————————————————————————————

def body_size(all_segs):
    sizes = [s['size'] for s in all_segs for _ in range(max(1, len(s['text']) // 10))]
    return statistics.median(sizes) if sizes else 12.0


def columns(all_segs, body):
    """Left edges of the term and definition columns: two biggest clusters of segment starts."""
    xs = sorted(round(s['x0']) for s in all_segs if abs(s['size'] - body) < body * 0.3)
    clusters = []
    for x in xs:
        if clusters and x - clusters[-1][-1] <= 25:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    big = sorted((c for c in clusters if len(c) >= max(3, len(xs) * 0.05)), key=lambda c: c[0])
    if len(big) < 2:
        return None
    return big[0][0], big[1][0]


def clean(lines):
    text = ''
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if (re.search(r'\S[-–—/]$', text) and ln[:1].isalnum()) or (re.search(r'\d$', text) and re.match(r'[-–—]\d', ln)):
            text += ln  # «северо-» + «западный», «1773—» + «1775»
        else:
            text += (' ' if text else '') + ln
    text = re.sub(r'\s+([,.;:!?»)])', r'\1', text)
    text = re.sub(r'([«(])\s+', r'\1', text)
    return re.sub(r'\s{2,}', ' ', text).strip()


def extract(pdfs, args):
    img_dir = WORK / 'img'
    img_dir.mkdir(parents=True, exist_ok=True)
    pages = []  # (pdf name, page no, plumber page, pdfium page)
    handles = []
    for path in pdfs:
        pl = pdfplumber.open(path)
        pm = pdfium.PdfDocument(str(path))
        handles.append((pl, pm))
        for i, page in enumerate(pl.pages):
            pages.append((Path(path).name, i + 1, page, pm[i]))

    per_page = []
    for name, no, page, pmp in pages:
        segs = segments(page)
        per_page.append({'name': name, 'no': no, 'page': page, 'pm': pmp, 'segs': segs, 'rules': rules(page)})
    body = body_size([s for p in per_page for s in p['segs']])
    cols = columns([s for p in per_page for s in p['segs']], body)
    warnings = []
    if not cols:
        sys.exit('Не нашёл двух колонок «термин | определение». Посмотрите --dump и --preview и поправьте разбор (README).')
    split = cols[1] - 10
    rule_mode = sum(len(p['rules']) for p in per_page) >= len(per_page) * 2
    row_gap = args.row_gap * body

    sets, cur_set, row = [], None, None

    def flush():
        nonlocal row
        if row and cur_set is not None and (row['front'] or row['back']):  # pictures without text: decoration
            cur_set['rows'].append(row)
        row = None

    def new_row(no):
        nonlocal row
        flush()
        row = {'front': [], 'back': [], 'images': [], 'page': no, 'bottom': None}

    rule_seen = False  # a table border passed since the last element: the next element starts a row
    for p in per_page:
        page, no = p['page'], p['no']
        elems = []
        for s in p['segs']:
            margin = s['top'] < 45 or s['bottom'] > page.height - 45
            if NOISE.search(s['text']) or (s['size'] < body * 0.8 and (margin or not row)):
                continue
            elems.append(s)
        elems += pictures(p['pm'], page.height)
        elems.sort(key=lambda e: (e['top'], e['x0']))
        page_rules = list(p['rules'])
        page_start = True
        for e in elems:
            while page_rules and page_rules[0] <= e['top'] + 1:
                page_rules.pop(0)
                rule_seen = True
            if e['kind'] == 'text' and e['size'] >= body * 1.35:
                flush()
                rule_seen = False
                if cur_set and not cur_set['rows'] and cur_set['pages'][-1] == no and e['top'] - cur_set['last_title_bottom'] < body * 2.5:
                    cur_set['title'] += ' ' + e['text']  # title on two lines
                else:
                    cur_set = {'title': e['text'], 'expected': None, 'rows': [], 'pages': [no], 'source': p['name']}
                    sets.append(cur_set)
                cur_set['last_title_bottom'] = e['bottom']
                page_start = False
                continue
            if cur_set is None:
                cur_set = {'title': Path(p['name']).stem, 'expected': None, 'rows': [], 'pages': [no], 'source': p['name'], 'last_title_bottom': 0}
                sets.append(cur_set)
            if no not in cur_set['pages']:
                cur_set['pages'].append(no)
            if e['kind'] == 'text' and row is None:
                m = COUNT.search(e['text'])
                if m:
                    cur_set['expected'] = int(m.group(2))
                    continue
                if BOILER.search(e['text']):
                    continue
            col = 0 if e['x0'] < split else 1
            if rule_mode:
                if rule_seen:
                    new_row(no)
                    rule_seen = False
                elif row is None:
                    continue  # header of a set (author, counters, avatar) before the first border
            elif row is None or (page_start and col == 0):
                new_row(no)
            elif row['bottom'] is not None:
                gap = e['top'] - row['bottom']
                if (col == 0 and gap > row_gap * 0.5) or gap > row_gap:
                    new_row(no)
            page_start = False
            if e['kind'] == 'image':
                pil = e['pil'] or crop_render(p['pm'], e)
                row['images'].append({'col': col, 'file': save_picture(pil, img_dir)})
            else:
                (row['front'] if col == 0 else row['back']).append(e['text'])
            row['bottom'] = e['bottom'] if row['bottom'] is None else max(row['bottom'], e['bottom'])
        # A row may continue on the next page: keep it open, forget where it ended.
        if row is not None:
            row['bottom'] = None
    flush()

    out_sets = []
    total = 0
    for s in sets:
        cards = []
        for i, r in enumerate(s['rows'], 1):
            front, back = clean(r['front']), clean(r['back'])
            image = r['images'][0]['file'] if r['images'] else None
            card = {'n': i, 'front': front, 'back': back, 'page': r['page']}
            if image:
                card['image'] = image
            if len(r['images']) > 1:
                card['moreImages'] = [x['file'] for x in r['images'][1:]]
            if not back and image:
                card.update(front=IMAGE_QUESTION, back=front, imageOnly=True)
            if not card['front'] or not card['back']:
                warnings.append(f'«{s["title"]}», карточка {i} (стр. {r["page"]}): пустая сторона — «{front[:40]}» / «{back[:40]}»')
            cards.append(card)
        total += len(cards)
        if s['expected'] is not None and s['expected'] != len(cards):
            warnings.append(f'«{s["title"]}»: в Quizlet {s["expected"]}, найдено {len(cards)}')
        out_sets.append({'title': s['title'], 'source': s['source'], 'pages': [s['pages'][0], s['pages'][-1]], 'expected': s['expected'], 'cards': cards})
    for pl, pm in handles:
        pl.close()
        pm.close()
    return {'version': 1, 'layout': {'body': round(body, 1), 'columns': cols, 'rules': rule_mode}, 'sets': out_sets, 'warnings': warnings}, total


# ——— tuning helpers ——————————————————————————————————————————————————————————————————————————————————

def page_range(spec, n):
    a, _, b = spec.partition('-')
    return range(int(a), min(n, int(b or a)) + 1)


def dump(pdf, spec):
    with pdfplumber.open(pdf) as pl:
        for no in page_range(spec, len(pl.pages)):
            page = pl.pages[no - 1]
            print(f'— стр. {no} ({page.width:.0f}×{page.height:.0f}), линии: {[round(y) for y in rules(page)]}')
            for s in segments(page):
                print(f'{s["top"]:6.1f} {s["x0"]:6.1f}–{s["x1"]:6.1f} {s["size"]:4.1f}{" b" if s["bold"] else "  "} {s["text"][:90]}')


def preview(pdf, spec):
    out = WORK / 'preview'
    out.mkdir(parents=True, exist_ok=True)
    with pdfplumber.open(pdf) as pl:
        pm = pdfium.PdfDocument(str(pdf))
        for no in page_range(spec, len(pl.pages)):
            page, k = pl.pages[no - 1], 1.5
            im = pm[no - 1].render(scale=k).to_pil().convert('RGB')
            d = ImageDraw.Draw(im)
            for y in rules(page):
                d.line([(0, y * k), (im.width, y * k)], fill=(150, 150, 150), width=1)
            for s in segments(page):
                d.rectangle([s['x0'] * k, s['top'] * k, s['x1'] * k, s['bottom'] * k], outline=(30, 90, 220), width=1)
            for e in pictures(pm[no - 1], page.height):
                d.rectangle([e['x0'] * k, e['top'] * k, e['x1'] * k, e['bottom'] * k], outline=(220, 30, 30), width=3)
            path = out / f'page-{no:03}.png'
            im.save(path)
            print(path)
        pm.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf', nargs='+', help='PDF-распечатки и/или текстовые экспорты .txt')
    ap.add_argument('--dump', metavar='PAGES', help='вывести сегменты страниц (например 3 или 2-4)')
    ap.add_argument('--preview', metavar='PAGES', help='нарисовать разбор страниц в work/preview/')
    ap.add_argument('--row-gap', type=float, default=1.0, help='промежуток между карточками в долях кегля (без линий таблицы)')
    args = ap.parse_args()
    if args.dump:
        return dump(args.pdf[0], args.dump)
    if args.preview:
        return preview(args.pdf[0], args.preview)
    pdfs = [p for p in args.pdf if p.lower().endswith('.pdf')]
    texts = [p for p in args.pdf if not p.lower().endswith('.pdf')]
    data, total = extract(pdfs, args) if pdfs else ({'version': 1, 'layout': None, 'sets': [], 'warnings': []}, 0)
    for t in texts:
        s = from_text(t)
        data['sets'].append(s)
        total += len(s['cards'])
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / 'raw.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    pics = sum(1 for s in data['sets'] for c in s['cards'] if c.get('image'))
    print(f'Наборов: {len(data["sets"])}, карточек: {total}, с картинкой: {pics} → {(WORK / "raw.json").relative_to(ROOT)}')
    for s in data['sets']:
        exp = f' (в Quizlet {s["expected"]})' if s['expected'] is not None else ''
        print(f'  {s["title"]}: {len(s["cards"])}{exp}, стр. {s["pages"][0]}–{s["pages"][1]}')
    for w in data['warnings']:
        print('  ! ' + w)


if __name__ == '__main__':
    main()
