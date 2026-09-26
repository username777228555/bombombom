"""
Smoke test of key screens (needs `pnpm dev` on :5173 and Python Playwright). Prints what each screen shows
and any page errors; the last line must be `errors: []`. Usage: python3 scripts/qa/smoke.py
"""
import asyncio
from playwright.async_api import async_playwright

import os

BASE = os.environ.get("BASE", "http://127.0.0.1:5173/")  # or BASE=http://127.0.0.1:4173/ with `pnpm preview`


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        page = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:300]))
        page.on("console", lambda m: errs.append(m.text[:300]) if m.type == "error" else None)
        async def go(r, wait=1800):
            await page.goto(BASE + "#" + r, wait_until="networkidle")
            await page.wait_for_timeout(wait)
        await go("/", 2000)

        # Rulers ladder
        await go("/rulers")
        names = await page.locator(".ladder li strong").all_inner_texts()
        print("rulers:", len(names), "| napoleon:", any("Наполеон" in n for n in names), "| hitler:", any("Гитлер" in n for n in names),
              "| first/last:", names[0], "/", names[-1])
        await page.fill(".finder input", "1480")
        await page.wait_for_timeout(500)
        print("1480 →", await page.locator(".answer .hit b").all_inner_texts(), "| events:", (await page.locator(".yev").all_inner_texts())[:2])
        await page.fill(".finder input", "1611")
        await page.wait_for_timeout(400)
        print("1611 →", (await page.locator(".answer .gap").inner_text())[:140])

        # Timeline synchronizer
        await go("/timeline?period=muscovy", 2200)
        print("timeline sync:", (await page.locator(".sync").inner_text()).replace("\n", " | ")[:160])

        # Reign game
        await go("/games/reign")
        await page.get_by_role("button", name="Играть").click()
        await page.wait_for_timeout(700)
        opts = page.locator(".opt")
        print("reign game: options", await opts.count(), "| event:", await page.locator(".event h2").inner_text())
        await opts.first.click()
        await page.wait_for_timeout(500)
        print("   after answer: ok-marked", await page.locator(".opt.ok").count(), "| date:", await page.locator(".event .date").inner_text())

        # Dates self-check
        await go("/dates")
        await page.get_by_role("tab", name="Скрыть годы").click()
        await page.wait_for_timeout(300)
        hidden = page.locator(".year.hidden")
        n_hidden = await hidden.count()
        await hidden.first.click()
        await page.wait_for_timeout(300)
        print("dates: hidden", n_hidden, "→ after tap", await page.locator(".year.hidden").count(), "| counter", await page.locator(".count").inner_text())

        # Essay builder
        await go("/essay")
        await page.select_option("select", index=40)
        await page.wait_for_timeout(700)
        plan = await page.locator(".plan pre").inner_text()
        print("essay: events", await page.locator(".ev").count(), "chosen", await page.locator(".ev.on").count(), "| plan:", plan.split("\n")[0])

        # Gallery
        await go("/gallery?open=e-kreshchenie-rusi", 2000)
        print("gallery viewer:", await page.locator(".viewer h2").inner_text() if await page.locator(".viewer").count() else "NOT OPEN")
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(500)
        print("   next →", await page.locator(".viewer h2").inner_text())
        await page.keyboard.press("Escape")
        await page.get_by_role("tab", name="Что это?").click()
        await page.wait_for_timeout(800)
        print("gallery quiz options:", await page.locator(".opt").count())
        await page.get_by_role("tab", name="Кто автор?").click()
        await page.wait_for_timeout(800)
        print("gallery author quiz options:", await page.locator(".opt").count(), "|", (await page.locator(".opt").all_inner_texts())[:4])

        # Home
        await go("/", 2500)
        print("home: art of day:", await page.locator(".art-t").inner_text() if await page.locator(".art-t").count() else "none",
              "| hero art:", await page.locator(".hero-art").count(), "| tiles:", await page.locator(".grid-2 .tile").count())
        print("errors:", errs[:5])
        await b.close()

asyncio.run(main())
