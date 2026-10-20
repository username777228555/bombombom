"""
Static copies of Василий (src/design/components/Vasily.svelte) for docs/mascot/: SVG per mood and PNG with a
transparent background. The drawing is taken from the running app, so the copies always match the component.
Usage: pnpm dev (on :5173), then python3 scripts/media/vasily_export.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5173/"
OUT = Path(__file__).resolve().parents[2] / "docs" / "mascot"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
# Tour step → mood shown there (src/app/Onboarding.svelte).
STEPS = {"": 1, "-smile": 0, "-think": 2, "-surprised": 4, "-happy": 8}

# Bakes CSS transforms and opacity into attributes, drops classes and styles: a standalone SVG.
SNAPSHOT = """(think) => {
  document.getAnimations().forEach((a) => a.cancel());
  const svg = document.querySelector('.tour .vasily svg');
  const clone = svg.cloneNode(true);
  const src = [...svg.querySelectorAll('*')], dst = [...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const d = dst[i], cs = getComputedStyle(el);
    const pupil = el.classList.contains('pupil'), spark = !!el.closest('.sparkles');
    d.removeAttribute('class');
    d.removeAttribute('style');
    if (cs.transform !== 'none' && !spark && !(pupil && !think)) {
      const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
      d.setAttribute('transform', ox || oy ? `translate(${ox} ${oy}) ${cs.transform} translate(${-ox} ${-oy})` : cs.transform);
    } else d.removeAttribute('transform');
    if (cs.opacity !== '1') d.setAttribute('opacity', cs.opacity);
  });
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
        page = await (await b.new_context(viewport={"width": 390, "height": 900})).new_page()
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_selector(".tour")
        svgs = {}
        for suffix, step in STEPS.items():
            await page.locator(".dots button").nth(step).click()
            await page.wait_for_timeout(600)
            await page.locator(".bubble").click()
            await page.wait_for_timeout(900)
            svgs[suffix] = await page.evaluate(SNAPSHOT, suffix == "-think")
            (OUT / f"vasily{suffix}.svg").write_text(svgs[suffix] + "\n", encoding="utf-8")
        # PNG renders on a transparent page: one big idle portrait and a row of all moods.
        shot = await (await b.new_context(viewport={"width": 1600, "height": 1100})).new_page()
        await shot.set_content('<body style="margin:0;background:transparent">' + svgs[""].replace('width="740" height="990"', 'width="765" height="1024"') + "</body>")
        await shot.locator("svg").screenshot(path=str(OUT / "vasily.png"), omit_background=True)
        row = "".join(s.replace('width="740" height="990"', 'width="296" height="396"') for s in svgs.values())
        await shot.set_content(f'<body style="margin:0;background:transparent"><div style="display:flex;width:max-content">{row}</div></body>')
        await shot.locator("div").screenshot(path=str(OUT / "vasily-moods.png"), omit_background=True)
        await b.close()
    print("ok:", ", ".join(f"vasily{s}.svg" for s in STEPS), "+ vasily.png, vasily-moods.png")


asyncio.run(main())
