"""
Mascot drafts for СТОЛЫПИНЪ: one sitting cat, three looks. Writes docs/mascot/*.svg.
Usage: python3 docs/mascot/build.py
"""
from pathlib import Path

OUT = Path(__file__).parent
INK = "#1e1913"
BURGUNDY = "#7c1d2b"
GOLD = "url(#gold)"
PINK = "#e3a39c"

DEFS = f"""<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3d68e"/><stop offset=".5" stop-color="#c79a3e"/><stop offset="1" stop-color="#8c6420"/>
  </linearGradient>
</defs>"""

STROKE = f'stroke="{INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"'


def tail(fur):
    d = "M 160 236 C 204 240, 218 200, 198 176 C 192 168, 184 172, 188 182"
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="21" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{fur}" stroke-width="14" stroke-linecap="round"/>')


def body(fur, light):
    b = "M 84 148 C 66 172, 62 212, 70 236 C 74 249, 92 253, 120 253 C 148 253, 166 249, 170 236 C 178 212, 174 172, 156 148 Z"
    bib = "M 98 150 C 98 186, 108 206, 120 212 C 132 206, 142 186, 142 150 Z"
    return f'<path d="{b}" fill="{fur}" {STROKE}/><path d="{bib}" fill="{light}"/>'


def paws(light):
    out = ""
    for cx in (101, 139):
        out += f'<ellipse cx="{cx}" cy="248" rx="15" ry="9" fill="{light}" {STROKE}/>'
        out += f'<path d="M {cx-5} 244 L {cx-5} 251 M {cx+5} 244 L {cx+5} 251" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
    return out


def ears(fur):
    return (f'<path d="M 92 58 L 66 20 L 60 80 Z" fill="{fur}" {STROKE}/>'
            f'<path d="M 148 58 L 174 20 L 180 80 Z" fill="{fur}" {STROKE}/>'
            f'<path d="M 88 62 L 70 34 L 67 72 Z" fill="{PINK}"/>'
            f'<path d="M 152 62 L 170 34 L 173 72 Z" fill="{PINK}"/>')


def head(fur):
    d = ("M 120 46 C 160 46, 184 70, 184 101 C 184 119, 178 131, 170 139 L 182 143 L 167 148 L 174 155 L 152 156 "
         "C 142 159, 131 160, 120 160 C 109 160, 98 159, 88 156 L 66 155 L 73 148 L 58 143 L 70 139 "
         "C 62 131, 56 119, 56 101 C 56 70, 80 46, 120 46 Z")
    return f'<path d="{d}" fill="{fur}" {STROKE}/>'


def face(light, iris, mood="calm", whisker=INK):
    out = f'<ellipse cx="120" cy="132" rx="27" ry="18" fill="{light}"/>'
    for cx in (97, 143):
        if mood == "happy":  # eyes closed in a smile
            out += f'<path d="M {cx-12} 108 Q {cx} 94 {cx+12} 108" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
            continue
        out += f'<ellipse cx="{cx}" cy="105" rx="13.5" ry="15.5" fill="{iris}" stroke="{INK}" stroke-width="2.5"/>'
        out += f'<ellipse cx="{cx}" cy="106" rx="6" ry="11" fill="{INK}"/>'
        out += f'<circle cx="{cx+4.5}" cy="99" r="3.6" fill="#fff"/><circle cx="{cx-4}" cy="111" r="1.7" fill="#fff"/>'
    out += f'<path d="M 113 123 L 127 123 L 120 130 Z" fill="#c9777a" stroke="{INK}" stroke-width="2"/>'
    out += f'<path d="M 120 130 Q 120 138 111 138 M 120 130 Q 120 138 129 138" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>'
    for s in (1, -1):
        x0 = 120 - s * 34
        for y0, y1 in ((126, 119), (131, 131), (136, 143)):
            out += f'<path d="M {x0} {y0} L {x0 - s * 30} {y1}" stroke="{whisker}" stroke-width="1.8" stroke-linecap="round"/>'
    return out


HEAD_STRIPES = ["M 110 58 L 112 73", "M 120 54 L 120 71", "M 130 58 L 128 73",
                "M 60 106 L 74 108", "M 62 116 L 74 116", "M 180 106 L 166 108", "M 178 116 L 166 116"]
BODY_STRIPES = ["M 72 194 Q 82 197 89 190", "M 70 212 Q 80 215 88 208", "M 168 194 Q 158 197 151 190", "M 170 212 Q 160 215 152 208"]


def stripes(color, paths):
    if not color:
        return ""
    return "".join(f'<path d="{d}" stroke="{color}" stroke-width="4.5" stroke-linecap="round" fill="none"/>' for d in paths)


def cat(fur, light, iris, stripe=None, mood="calm", before="", over_body="", over_head="", whisker=INK):
    return (tail(fur) + before + body(fur, light) + stripes(stripe, BODY_STRIPES) + over_body + ears(fur) + head(fur)
            + stripes(stripe, HEAD_STRIPES) + face(light, iris, mood, whisker) + paws(light) + over_head)


def svg(inner, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 270" width="480" height="540">'
            f"<title>{title}</title>{DEFS}{inner}</svg>\n")


# 1. «Учёный кот» — Пушкин: «и днём и ночью кот учёный всё ходит по цепи кругом». Gold chain, open book, oak sprig.
def chain(points):
    out = ""
    for i, (x, y) in enumerate(points):
        rot = -32 if i % 2 else 58
        out += f'<ellipse cx="{x}" cy="{y}" rx="6.5" ry="4" transform="rotate({rot} {x} {y})" fill="none" stroke="{INK}" stroke-width="5"/>'
        out += f'<ellipse cx="{x}" cy="{y}" rx="6.5" ry="4" transform="rotate({rot} {x} {y})" fill="none" stroke="{GOLD}" stroke-width="2.6"/>'
    return out


links = [(84 + i * 8.6, 158 + i * 6.3 + (i * i) * 0.12) for i in range(10)]
book = (f'<path d="M 92 222 Q 106 214 120 222 Q 134 214 148 222 L 148 246 Q 134 238 120 246 Q 106 238 92 246 Z" fill="#fffbf4" {STROKE}/>'
        f'<path d="M 120 222 L 120 246" stroke="{INK}" stroke-width="2.5"/>'
        f'<path d="M 99 228 L 113 226 M 99 233 L 113 231 M 127 226 L 141 228 M 127 231 L 141 233" stroke="#b9ad99" stroke-width="2" stroke-linecap="round"/>'
        f'<path d="M 90 246 L 92 222 M 150 246 L 148 222" stroke="{BURGUNDY}" stroke-width="5" stroke-linecap="round"/>')
oak = (f'<path d="M 206 246 C 200 232, 202 220, 210 208" fill="none" stroke="#5b6b2e" stroke-width="3" stroke-linecap="round"/>'
       f'<path d="M 210 210 C 214 202, 222 204, 220 210 C 228 208, 230 216, 223 219 C 230 222, 226 231, 218 228 C 218 236, 208 236, 209 228 Z" fill="#7e8f3e" {STROKE}/>'
       f'<path d="M 211 213 L 219 224" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>'
       f'<circle cx="203" cy="236" r="6" fill="{GOLD}" stroke="{INK}" stroke-width="2.5"/><path d="M 197 233 Q 203 226 209 233" fill="#6b4a1e" stroke="{INK}" stroke-width="2"/>')
learned = cat("#a59c90", "#f1eadf", "#d9a441", stripe="#6e655a", over_body=chain(links) + book, before=oak)

# 2. «Гимназист» — ученик гимназии начала XX века, как и сам пользователь, готовится к испытаниям.
cap = (f'<path d="M 72 70 C 70 46, 92 36, 120 36 C 148 36, 170 46, 168 70 Z" fill="#26324a" {STROKE}/>'
       f'<path d="M 74 70 L 166 70 L 166 78 L 74 78 Z" fill="#f2efe8" stroke="{INK}" stroke-width="2.5"/>'
       f'<path d="M 82 78 C 96 94, 144 94, 158 78 Z" fill="{INK}"/>'
       f'<path d="M 111 62 C 103 56, 103 46, 110 41 M 129 62 C 137 56, 137 46, 130 41" fill="none" stroke="#d9dde3" stroke-width="2.4" stroke-linecap="round"/>'
       + "".join(f'<ellipse cx="{x}" cy="{y}" rx="3.2" ry="1.8" transform="rotate({r} {x} {y})" fill="#d9dde3"/>'
                 for x, y, r in ((104, 54, -60), (105, 47, -80), (136, 54, 60), (135, 47, 80), (107, 60, -30), (133, 60, 30)))
       + f'<text x="120" y="56" text-anchor="middle" font-family="Georgia,serif" font-size="10" font-weight="700" fill="#d9dde3">Г</text>')
jacket = (f'<path d="M 84 148 C 66 172, 62 212, 70 236 L 98 236 L 98 152 Z" fill="#26324a" {STROKE}/>'
          f'<path d="M 156 148 C 174 172, 178 212, 170 236 L 142 236 L 142 152 Z" fill="#26324a" {STROKE}/>'
          + "".join(f'<circle cx="{x}" cy="{y}" r="3.6" fill="#d9dde3" stroke="{INK}" stroke-width="1.8"/>' for x, y in ((92, 176), (92, 200), (148, 176), (148, 200)))
          + f'<g transform="translate(150 172) scale(1.45)"><path d="M 0 0 L 12 -6 L 12 6 Z M 0 0 L -12 -6 L -12 6 Z" fill="#fff" stroke="{INK}" stroke-width="1.6"/>'
          f'<path d="M -2 2 L -6 18 L -1 15 Z" fill="#1f5fae" stroke="{INK}" stroke-width="1.4"/><path d="M 2 2 L 6 18 L 1 15 Z" fill="#c8312b" stroke="{INK}" stroke-width="1.4"/>'
          f'<circle r="3.2" fill="#1f5fae" stroke="{INK}" stroke-width="1.4"/></g>')
student = cat("#e09a52", "#f8e9d4", "#5e9b52", stripe="#b4682c", over_body=jacket, over_head=cap)

# 3. «Карамзин» — чёрный кот («кара» по-тюркски «чёрный»: род Карамзиных вёл себя от Кара-Мурзы); монокль, перо,
#    тома «Истории государства Российского». Потомок казанских котов, которых Елизавета в 1745 году велела привезти
#    в Зимний дворец, — нынешних эрмитажных.
volumes = ""
for i, (x, w) in enumerate(((180, 52), (176, 56), (184, 46))):
    y = 241 - i * 14
    volumes += (f'<rect x="{x}" y="{y}" width="{w}" height="13" rx="2" fill="{BURGUNDY if i != 1 else "#5b1520"}" {STROKE}/>'
                f'<path d="M {x + 7} {y} L {x + 7} {y + 13} M {x + w - 7} {y} L {x + w - 7} {y + 13}" stroke="{GOLD}" stroke-width="2.6"/>'
                f'<text x="{x + w / 2}" y="{y + 10}" text-anchor="middle" font-family="Georgia,serif" font-size="8.5" font-weight="700" fill="#f3d68e">{["I", "II", "III"][i]}</text>')
monocle = (f'<circle cx="143" cy="105" r="18" fill="none" stroke="{INK}" stroke-width="5"/>'
           f'<circle cx="143" cy="105" r="18" fill="none" stroke="{GOLD}" stroke-width="2.8"/>'
           f'<path d="M 159 114 C 172 134, 166 152, 152 168" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="3 2.5"/>')
quill = (f'<path d="M 60 236 C 46 210, 46 182, 66 156 C 74 176, 76 204, 66 236 Z" fill="#fffbf4" {STROKE}/>'
         + "".join(f'<path d="M {64 - k * 0.4} {226 - k * 9} L {52 + k * 0.6} {218 - k * 9} M {64 - k * 0.4} {226 - k * 9} L {72 - k * 0.2} {214 - k * 9}" stroke="#b9ad99" stroke-width="1.5" stroke-linecap="round"/>' for k in range(6))
         + f'<path d="M 63 236 C 61 208, 61 182, 66 158" fill="none" stroke="{INK}" stroke-width="2"/>'
         f'<path d="M 61 236 L 63 252 L 66 236 Z" fill="{GOLD}" stroke="{INK}" stroke-width="2"/>')
bow = (f'<path d="M 120 158 L 102 150 L 102 168 Z M 120 158 L 138 150 L 138 168 Z" fill="{BURGUNDY}" {STROKE}/>'
       f'<circle cx="120" cy="159" r="5" fill="{GOLD}" stroke="{INK}" stroke-width="2"/>')
karamzin = cat("#2c2724", "#f1eadf", "#d9b44a", before=volumes, over_body=quill, over_head=monocle + bow, whisker="#e9e0d0")

# The «Карамзин» face in a happy mood — for «верно», orders, the end of a lesson.
karamzin_happy = cat("#2c2724", "#f1eadf", "#d9b44a", mood="happy", before=volumes, over_body=quill, over_head=bow, whisker="#e9e0d0")

for name, inner, title in (("1-uchenyy-kot", learned, "Учёный кот"), ("2-gimnazist", student, "Кот-гимназист"),
                           ("3-karamzin", karamzin, "Кот Карамзин"), ("3-karamzin-rad", karamzin_happy, "Кот Карамзин — радуется")):
    (OUT / f"{name}.svg").write_text(svg(inner, title), encoding="utf-8")
print("ok")
