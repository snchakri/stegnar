import ssl
import urllib.request
import os
import sys

def main():
    # 1. Locate test image
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    image_path = os.path.join(base_dir, "test_images", "demo_data", "stego", "10.jpg")
    
    if not os.path.exists(image_path):
        print(f"Error: Test image not found at {image_path}")
        sys.exit(1)
        
    print(f"Loading stego image: {image_path}")
    with open(image_path, "rb") as f:
        img_bytes = f.read()
        
    # 2. Configure SSL Context with Key Logging
    keylog_path = os.path.expandvars('%TEMP%\\ssl_keys.log')
    print(f"Configuring SSL key logging to: {keylog_path}")
    
    ctx = ssl.create_default_context()
    ctx.keylog_filename = keylog_path
    
    # 3. Perform HTTPS POST upload
    url = "https://httpbin.org/post"
    print(f"Uploading {len(img_bytes)} bytes to {url}...")
    
    req = urllib.request.Request(
        url,
        data=img_bytes,
        headers={"Content-Type": "image/jpeg"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            status = response.status
            print(f"Upload complete! Response status code: {status}")
            
    except Exception as e:
        print(f"Upload failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
