"""Likely duplicates of a batch file in the base: the same normalized title, name, short name, term or wiki article.
Keyword searches miss existing entries (p-scherbatov vs a new p-shcherbatov), so run it on every `-plus` file
before `pnpm content:check` and relink to the old id instead of adding a second card.

  python3 scripts/qa/dups.py content/packs/osnova/data/10-late-ussr-plus.json [more files…]
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KINDS = ('events', 'persons', 'culture', 'terms', 'sources')


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[«»"().,:;!?]', '', (s or '').lower().replace('ё', 'е'))).strip()


def keys(x):
    return [norm(k) for k in (x.get('title'), x.get('name'), x.get('short'), x.get('term'), x.get('wiki')) if k]


found = 0
for plus in sys.argv[1:]:
    base = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'content/packs/*/data/*.json'))):
        if os.path.samefile(f, plus):
            continue
        for kind in KINDS:
            for x in json.load(open(f, encoding='utf-8')).get(kind, []):
                for k in keys(x):
                    base.setdefault(k, set()).add(x['id'])
    data = json.load(open(plus, encoding='utf-8'))
    for kind in KINDS:
        for x in data.get(kind, []):
            for k in keys(x):
                others = base.get(k, set()) - {x['id']}
                if others:
                    found += 1
                    print(f'{os.path.basename(plus)}: {x["id"]} ~ «{k}» → {", ".join(sorted(others))}')
print(f'possible duplicates: {found}')
sys.exit(1 if found else 0)
