from playwright.sync_api import sync_playwright

def verify_mobile_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate iPhone 12 Pro
        iphone = p.devices['iPhone 12 Pro']
        context = browser.new_context(**iphone)
        page = context.new_page()

        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        try:
            page.goto("http://localhost:4173/")
            # Wait for content to appear (e.g., the intro or dashboard)
            page.wait_for_selector("body", timeout=5000)

            # Allow some time for animations/scripts to initialize
            page.wait_for_timeout(2000)

            # Take a screenshot
            page.screenshot(path="verification.png")
            print("Screenshot taken.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_load()
