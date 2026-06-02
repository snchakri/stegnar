import sys
import os
import requests
import json

APP_KEY = "qbq7izx9kkjiatn"
APP_SECRET = "i7lrewwdsozwei8"

def main():
    auth_url = f"https://www.dropbox.com/oauth2/authorize?client_id={APP_KEY}&response_type=code&token_access_type=offline"
    print("\n" + "="*80)
    print("DROPBOX AUTHENTICATION SETUP")
    print("="*80)
    print("1. Open the following URL in your web browser:")
    print(f"\n{auth_url}\n")
    print("2. Log in to Dropbox and click 'Allow'.")
    print("3. Copy the access code provided by Dropbox.")
    print("="*80)
    
    code = input("Enter the authorization code here: ").strip()
    if not code:
        print("Error: No code entered.")
        sys.exit(1)

    # Exchange authorization code for access & refresh tokens
    token_url = "https://api.dropbox.com/oauth2/token"
    data = {
        "code": code,
        "grant_type": "authorization_code",
        "client_id": APP_KEY,
        "client_secret": APP_SECRET
    }
    
    try:
        resp = requests.post(token_url, data=data)
        if resp.status_code != 200:
            print(f"Error exchanging token: {resp.status_code} - {resp.text}")
            sys.exit(1)
            
        token_info = resp.json()
        refresh_token = token_info.get("refresh_token")
        
        if not refresh_token:
            print("Warning: No refresh token returned. Did you visit the URL with token_access_type=offline?")
            print(f"Response details: {json.dumps(token_info, indent=2)}")
            sys.exit(1)
            
        credentials = {
            "app_key": APP_KEY,
            "app_secret": APP_SECRET,
            "refresh_token": refresh_token
        }
        
        creds_path = os.path.join(os.path.dirname(__file__), "dropbox_credentials.json")
        with open(creds_path, "w") as f:
            json.dump(credentials, f, indent=4)
            
        print("\nSUCCESS!")
        print(f"Credentials saved to: {creds_path}")
        print("You can now run the testing suite, and it will automatically authenticate with Dropbox.")
        
    except Exception as e:
        print(f"Request failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
