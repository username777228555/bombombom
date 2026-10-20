"""
Static copies of Василий (src/design/components/Vasily.svelte): an SVG per mood and PNGs with a transparent
background in docs/mascot/, plus his face for Android notifications (res/drawable-nodpi/vasily_face.png).
The drawing is taken from the running app («Мастерская Василия», #/vasily-lab), so the copies always match.
Usage: pnpm dev (on :5173), then python3 scripts/media/vasily_export.py
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5173/"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "mascot"
FACE = ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-nodpi" / "vasily_face.png"
CHROME = os.environ.get("PW_CHROMIUM") or "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
MOODS = ["idle", "smile", "happy", "think", "surprised", "sad", "sleep"]

# Bakes CSS transforms and opacity into attributes, drops classes and styles: a standalone SVG.
# Pupils keep their offset only where the mood sets it (thinking looks up, a sad cat looks down).
SNAPSHOT = """(mood) => {
  document.getAnimations().forEach((a) => a.cancel());
  const svg = document.querySelector('.lab .vasily svg');
  const clone = svg.cloneNode(true);
  const src = [...svg.querySelectorAll('*')], dst = [...clone.querySelectorAll('*')];
  const keepLook = mood === 'think' || mood === 'sad';
  src.forEach((el, i) => {
    const d = dst[i], cs = getComputedStyle(el);
    const pupil = el.classList.contains('pupil'), spark = !!el.closest('.sparkles'), zzz = !!el.closest('.zzz');
    d.removeAttribute('class');
    d.removeAttribute('style');
    if (cs.transform !== 'none' && !spark && !zzz && !(pupil && !keepLook)) {
      const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
      d.setAttribute('transform', ox || oy ? `translate(${ox} ${oy}) ${cs.transform} translate(${-ox} ${-oy})` : cs.transform);
    } else d.removeAttribute('transform');
    if (zzz && el.tagName === 'text') d.setAttribute('opacity', String(0.45 + 0.2 * [...el.parentNode.children].indexOf(el)));
    else if (cs.opacity !== '1') d.setAttribute('opacity', cs.opacity);
  });
  clone.querySelectorAll('[fill="currentColor"]').forEach((n) => n.setAttribute('fill', '#7d705f'));
  clone.removeAttribute('class');
  clone.removeAttribute('aria-hidden');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '740');
  clone.setAttribute('height', '990');
  clone.insertAdjacentHTML('afterbegin', '<title>Василий</title>');
  return clone.outerHTML.replace(/<!---->/g, '');
}"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"], executable_path=CHROME)
        page = await (await b.new_context(viewport={"width": 900, "height": 1000})).new_page()
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        if await page.locator(".tour .skip").count():  # first launch opens «Знакомство с Василием»
            await page.locator(".tour .skip").click()
        svgs = {}
        for mood in MOODS:
            await page.goto(BASE + f"#/vasily-lab?mood={mood}", wait_until="networkidle")
            await page.wait_for_selector(".lab .vasily svg")
            await page.wait_for_timeout(900)
            svgs[mood] = await page.evaluate(SNAPSHOT, mood)
            name = "vasily" if mood == "idle" else f"vasily-{mood}"
            (OUT / f"{name}.svg").write_text(svgs[mood] + "\n", encoding="utf-8")
        shot = await (await b.new_context(viewport={"width": 2100, "height": 1100})).new_page()
        await shot.set_content('<body style="margin:0;background:transparent">' + svgs["idle"].replace('width="740" height="990"', 'width="765" height="1024"') + "</body>")
        await shot.locator("svg").screenshot(path=str(OUT / "vasily.png"), omit_background=True)
        row = "".join(svgs[m].replace('width="740" height="990"', 'width="296" height="396"') for m in MOODS)
        await shot.set_content(f'<body style="margin:0;background:transparent"><div style="display:flex;width:max-content">{row}</div></body>')
        await shot.locator("div").screenshot(path=str(OUT / "vasily-moods.png"), omit_background=True)
        # Notification avatar: the face on a parchment square (Android rounds it).
        face = svgs["smile"].replace('viewBox="200 0 740 990"', 'viewBox="242 150 540 540"').replace('width="740" height="990"', 'width="256" height="256"')
        await shot.set_content(f'<body style="margin:0"><div style="width:256px;height:256px;background:#f3ecdf">{face}</div></body>')
        await shot.locator("div").screenshot(path=str(FACE))
        await b.close()
    print("ok:", ", ".join(f"{'vasily' if m == 'idle' else 'vasily-' + m}.svg" for m in MOODS), "+ vasily.png, vasily-moods.png,", FACE.relative_to(ROOT))


asyncio.run(main())
