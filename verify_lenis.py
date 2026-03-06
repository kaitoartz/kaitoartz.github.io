from playwright.sync_api import sync_playwright
import os

def verify_lenis():
    with sync_playwright() as p:
        iphone_13 = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True, args=['--disable-web-security'])
        cwd = os.getcwd()

        # --- MOBILE TEST ---
        context = browser.new_context(**iphone_13)
        page = context.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        page.goto(f"file://{cwd}/index.html")
        page.wait_for_timeout(3000)

        has_lenis_mobile = page.evaluate("() => window.hyperIntro && window.hyperIntro.lenis !== null")
        # Note: if hyperIntro.lenis is undefined, it evaluates to true-ish? No.
        # Check explicit null check in JS

        # Check if Lenis instance exists
        has_lenis_mobile = page.evaluate("""() => {
            if (window.hyperIntro && window.hyperIntro.lenis) return true;
            return false;
        }""")

        print(f"Is Lenis initialized on Mobile? {has_lenis_mobile}")

        if not has_lenis_mobile:
            print("SUCCESS: Lenis is NOT initialized on mobile.")
        else:
            print("FAILURE: Lenis IS initialized on mobile.")

        # --- DESKTOP TEST ---
        context_desktop = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page_desktop = context_desktop.new_page()

        page_desktop.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page_desktop.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        # Inject script to mock hardware (Low End Desktop)
        page_desktop.add_init_script("""
            Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 2});
            Object.defineProperty(navigator, 'deviceMemory', {get: () => 2});
        """)

        page_desktop.goto(f"file://{cwd}/index.html")
        page_desktop.wait_for_timeout(3000)

        has_lenis_desktop = page_desktop.evaluate("""() => {
            if (window.hyperIntro && window.hyperIntro.lenis) return true;
            return false;
        }""")

        print(f"Is Lenis initialized on Desktop (Low/Med)? {has_lenis_desktop}")

        if has_lenis_desktop:
             print("SUCCESS: Lenis IS initialized on Desktop (Low/Med).")
        else:
             print("FAILURE: Lenis is NOT initialized on Desktop (Low/Med).")

        browser.close()

if __name__ == "__main__":
    verify_lenis()
