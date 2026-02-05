from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        url = "file:///app/index.html"
        print(f"Loading {url}")
        page.goto(url)

        # Wait for Enter System button
        print("Waiting for enter button...")
        enter_btn = page.locator("#enterSystemBtn")
        enter_btn.wait_for(state="visible", timeout=10000)

        # Click it to start warp
        print("Clicking enter button...")
        enter_btn.click()

        # Wait for intro to finish and dashboard to appear
        # The intro takes about ~1-2s warp + fade
        print("Waiting for dashboard...")
        dashboard = page.locator(".dashboard")

        # Wait for dashboard to be visible (it gets .visible class or opacity change)
        # In script.js: dashboard.classList.add('visible');
        # But this happens in 'startBootSequence' which is triggered... wait.
        # HyperScrollIntro.endIntro triggers: main.style.animation = "fadeIn 1s ease forwards";

        time.sleep(3) # Wait for animation

        # Take screenshot
        os.makedirs("verification", exist_ok=True)
        path = "verification/dashboard.png"
        page.screenshot(path=path)
        print(f"Screenshot saved to {path}")

        browser.close()

if __name__ == "__main__":
    run()
