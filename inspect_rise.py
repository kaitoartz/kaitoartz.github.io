from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to the target URL (should redirect to login)
        print("Navigating to URL...")
        target_url = "https://rise.articulate.com/authoring/cU0CEIOccW-_bc_BpF4YQRNCpIrFgPUb/lesson/cml10a2rz002h357hdv5lwzcu"
        page.goto(target_url)
        page.wait_for_load_state("networkidle")
        
        # Check if we are on login page (common Articulate ID login)
        if "signin" in page.url or "account.articulate.com" in page.url:
            print(f"Redirected to login: {page.url}")
            print("Filling credentials...")
            
            # Articulate often uses a multi-step or single form. Trying generic selectors first.
            try:
                page.wait_for_selector('input[type="email"]', timeout=10000)
                page.fill('input[type="email"]', "elearning.isteduca@gmail.com")
                
                # Check if there is a 'Next' button or if password field is visible immediately
                # Some login flows split email and password
                if page.is_visible('button:has-text("Next")'):
                     page.click('button:has-text("Next")')
                     page.wait_for_selector('input[type="password"]', state="visible")
                
                page.fill('input[type="password"]', "2Lucia84")
                
                # Submit
                page.click('button[type="submit"]')
                
                print("Submitted login form. Waiting for navigation...")
                page.wait_for_load_state("networkidle")
                time.sleep(10) # Give it time to load the heavy SPA
                
            except Exception as e:
                print(f"Login failed or selectors changed: {e}")
                # Save screenshot to debug
                page.screenshot(path="login_error.png")
        
        print(f"Current URL: {page.url}")
        
        # Save content to file for inspection
        with open("rise_page_content.html", "w", encoding="utf-8") as f:
            f.write(page.content())
            
        print("Page content saved to rise_page_content.html")
        browser.close()

if __name__ == "__main__":
    run()