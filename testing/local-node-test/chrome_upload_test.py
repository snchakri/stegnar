"""
Chrome-based stego image upload test using Selenium.
Uploads a stego JPEG to httpbin.org/post via Chrome to trigger SSL key logging
and let the Stegnar endpoint agent intercept + analyze it.
"""
import os
import sys
import time
import subprocess

STEGO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "test_images", "demo_data", "stego"
)

# Pick the largest JPEG stego image for best chance of detection
TARGET_IMAGE = os.path.join(STEGO_DIR, "11.jpg")  # 36KB JPEG

def get_chrome_path():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Chrome not found!")

def main():
    if not os.path.exists(TARGET_IMAGE):
        print(f"[ERROR] Stego image not found: {TARGET_IMAGE}")
        sys.exit(1)

    print(f"[*] Target stego image: {TARGET_IMAGE} ({os.path.getsize(TARGET_IMAGE)} bytes)")

    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from webdriver_manager.chrome import ChromeDriverManager
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        print("Run: pip install selenium webdriver-manager")
        sys.exit(1)

    # SSL Key logging is handled by the persistent SSLKEYLOGFILE env var
    keylog_path = os.path.expandvars(r'%APPDATA%\..\Local\Temp\ssl_keys.log')
    print(f"[*] SSL keys will be logged to: {keylog_path}")
    print(f"[*] Current SSLKEYLOGFILE env: {os.environ.get('SSLKEYLOGFILE', 'NOT SET')}")

    chrome_path = get_chrome_path()
    print(f"[*] Chrome: {chrome_path}")

    opts = Options()
    opts.binary_location = chrome_path
    # Run in background but NOT headless so SSL keys actually log
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,800")
    # Force SSL key logging via Chrome pref
    ssl_key_log_dir = os.path.dirname(os.path.expandvars(r'%APPDATA%\..\Local\Temp\ssl_keys.log'))
    opts.add_argument(f"--ssl-key-log-file={keylog_path}")

    print("[*] Launching Chrome via Selenium (WebDriverManager)...")
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=opts)
    except Exception as e:
        print(f"[ERROR] Failed to start Chrome: {e}")
        sys.exit(1)

    try:
        # Navigate to httpbin.org which just echoes back what we POST
        upload_url = "https://httpbin.org/post"
        print(f"[*] Navigating to: {upload_url}")
        driver.get("https://httpbin.org/")
        time.sleep(2)

        # Use JavaScript fetch to POST the image file directly
        print(f"[*] Reading stego image bytes...")
        with open(TARGET_IMAGE, "rb") as f:
            img_data = f.read()

        # Encode as base64 and send via fetch
        import base64
        b64_data = base64.b64encode(img_data).decode()

        js_upload = f"""
        async function uploadImage() {{
            const b64 = '{b64_data}';
            const byteChars = atob(b64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {{
                byteNumbers[i] = byteChars.charCodeAt(i);
            }}
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {{type: 'image/jpeg'}});
            
            const response = await fetch('https://httpbin.org/post', {{
                method: 'POST',
                body: blob,
                headers: {{'Content-Type': 'image/jpeg'}}
            }});
            return response.status;
        }}
        return await uploadImage();
        """

        print("[*] Uploading stego JPEG via Chrome fetch (HTTPS)...")
        status = driver.execute_async_script(
            """
            const callback = arguments[0];
            const b64 = arguments[1];
            const byteChars = atob(b64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/jpeg'});
            fetch('https://httpbin.org/post', {
                method: 'POST',
                body: blob,
                headers: {'Content-Type': 'image/jpeg', 'X-Stegnar-Test': 'true'}
            }).then(r => callback(r.status)).catch(e => callback('ERROR: ' + e.message));
            """,
            b64_data
        )

        print(f"[✓] Upload complete! HTTP status: {status}")
        print("[*] Waiting 3 seconds to let SSL keys flush to disk...")
        time.sleep(3)

        # Check key log file
        if os.path.exists(keylog_path):
            size = os.path.getsize(keylog_path)
            print(f"[✓] SSL key log exists: {keylog_path} ({size} bytes)")
        else:
            print(f"[!] SSL key log NOT found at: {keylog_path}")

        print("\n[✓] Done! The Stegnar endpoint agent should have intercepted this traffic.")
        print("    Check http://localhost:3000 (SOC Dashboard) for the detection event.")

    finally:
        driver.quit()
        print("[*] Chrome closed.")

if __name__ == "__main__":
    main()
