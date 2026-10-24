"""What an olympiad asks that the base does not have: people with initials («С. Ю. Витте», «Витте С. Ю.») whose surname
is unknown to the base and «quoted titles» found nowhere in it. Input — plain text of tasks and keys:
olimpiada.ru keeps finals as PDFs, `https://tasks.olimpiada.ru/upload/files/tasks/<id>/<start year>/<id>-<tasks|ans>-hist-<class>-final-<yy-yy>.pdf`
(ids: Высшая проба 147, Ломоносов 353, РГГУ 392, РАНХиГС 5285, Изумруд 5617), text via `pdftotext -layout`.
The output is a list of leads, not of cards: read each task, find the recurring type behind it and fill that.

  python3 scripts/qa/olymp_gaps.py tasks-11.txt ans-11.txt
"""
import os
import json, glob, re, sys, collections
def norm(s): return re.sub(r'\s+', ' ', re.sub(r'[«»"“”„()\[\],.:;!?—–-]', ' ', (s or '').lower().replace('ё', 'е'))).strip()
names, stems, texts = set(), set(), []
for f in glob.glob(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'content/packs/*/data/*.json')):
    d = json.load(open(f))
    for p in d.get('persons', []):
        for n in [p.get('name'), p.get('short')] + (p.get('aliases') or []):
            if n:
                names.add(norm(n))
                for w in norm(n).split():
                    if len(w) > 3: stems.add(w[:max(4, len(w) - 3)])
    for k in ['persons', 'events', 'culture', 'terms', 'sources']:
        for x in d.get(k, []):
            names.add(norm(x.get('title') or x.get('term') or x.get('name') or ''))
            texts.append(norm(json.dumps(x, ensure_ascii=False)))
alltext = ' '.join(texts); namestr = ' | '.join(names)
def known_person(sur):
    s = norm(sur)
    return any(s.startswith(st) for st in stems if len(st) >= 4 and s[:4] == st[:4] and (s.startswith(st)))
out = collections.defaultdict(set)
PER = re.compile(r'\b([А-ЯЁ]\.\s?(?:[А-ЯЁ]\.\s?)?)([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)|([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\s([А-ЯЁ]\.\s?[А-ЯЁ]\.)')
for path in sys.argv[1:]:
    t = re.sub(r'\s+', ' ', open(path).read())
    tag = path.split('/')[-1].replace('.txt', '')
    for m in PER.finditer(t):
        sur = m.group(2) or m.group(3)
        if not known_person(sur): out['person'].add((m.group(0).strip(), tag))
    for m in re.finditer(r'«([^«»]{3,80})»', t):
        q = m.group(1).strip(); n = norm(q)
        if n and n not in namestr and n not in alltext: out['title'].add((q, tag))
for k in out:
    print('==', k, len(out[k]))
    for v in sorted(out[k]): print('  ', v[0], '|', v[1])
