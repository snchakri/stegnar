import os
import sys
import time
import argparse
import subprocess
import json
import socket
import docker
import requests

def get_dropbox_access_token(creds_file="/app/testing/dropbox_credentials.json"):
    with open(creds_file, 'r') as f:
        creds = json.load(f)
    resp = requests.post(
        "https://api.dropbox.com/oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": creds["refresh_token"]
        },
        auth=(creds["app_key"], creds["app_secret"])
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    else:
        raise Exception(f"Failed to refresh Dropbox access token: {resp.status_code} - {resp.text}")

def upload_to_dropbox(access_token, remote_path, file_bytes):
    url = "https://content.dropboxapi.com/2/files/upload"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Dropbox-API-Arg": json.dumps({
            "path": remote_path,
            "mode": "overwrite",
            "autorename": False,
            "mute": True
        }),
        "Content-Type": "application/octet-stream"
    }
    resp = requests.post(url, headers=headers, data=file_bytes)
    if resp.status_code != 200:
        raise Exception(f"Dropbox upload failed: {resp.status_code} - {resp.text}")
    return resp.json().get("id")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--nodes', type=int, default=5, help="Number of virtual nodes")
    parser.add_argument('--stego-ratio', type=float, default=0.2, help="Stego ratio (0.0 to 1.0)")
    parser.add_argument('--uploads-per-node', type=int, default=3, help="Uploads per node")
    args = parser.parse_args()

    # Dynamic session name with timestamp
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    session_name = f"Stegnar_Session_{timestamp}"
    
    # Paths
    base_dir = "/app/testing"
    local_session_dir = os.path.join(base_dir, "reports", session_name)
    os.makedirs(local_session_dir, exist_ok=True)
    print(f"[Orchestrator] Starting session: {session_name}")
    print(f"[Orchestrator] Local directory: {local_session_dir}")

    # Dropbox credentials check
    config_file = os.path.join(base_dir, "dropbox_credentials.json")
    if not os.path.exists(config_file):
        print(f"[Orchestrator] Dropbox credentials file not found at {config_file}")
        sys.exit(1)

    try:
        access_token = get_dropbox_access_token(config_file)
        print("[Orchestrator] Dropbox credentials authenticated successfully.")
    except Exception as e:
        print(f"[Orchestrator] Dropbox authentication failed: {e}")
        sys.exit(1)

    # Resolve DinD Host Mount Paths dynamically
    client = docker.from_env()
    host_testing_dir = None
    host_test_images_dir = None
    host_cert_path = None

    try:
        hostname = socket.gethostname()
        me = client.containers.get(hostname)
        mounts = me.attrs.get('Mounts', [])
        for m in mounts:
            if m['Destination'] == '/app/testing':
                host_testing_dir = m['Source']
            elif m['Destination'] == '/app/test_images':
                host_test_images_dir = m['Source']
            elif m['Destination'] == '/etc/ssl/certs/mitmproxy-ca-cert.pem':
                host_cert_path = m['Source']
        print(f"[Orchestrator] Resolved DinD mounts. Host testing dir: {host_testing_dir}")
    except Exception as e:
        print(f"[Orchestrator] DinD mount resolution fallback: {e}")

    # Fallback to local paths if not running inside a container mounts layout
    if not host_testing_dir:
        host_testing_dir = os.path.abspath("./testing")
    if not host_test_images_dir:
        host_test_images_dir = os.path.abspath("./test_images")
    if not host_cert_path:
        host_cert_path = os.path.abspath("./runtime/current/proxy/mitmproxy-ca-cert.pem")

    # 1. Spawn Sibling Docker Containers for each client node
    print(f"[Orchestrator] Spinning up {args.nodes} separate container nodes...")
    containers = []
    
    for i in range(1, args.nodes + 1):
        node_id = f"node-{i:03d}"
        container_name = f"stegnar-test-node-{i}"
        
        # Cleanup pre-existing container if any collision exists
        try:
            old_c = client.containers.get(container_name)
            old_c.remove(force=True)
        except Exception:
            pass

        print(f"[Orchestrator] Spawning {container_name}...")
        c = client.containers.run(
            image="stegnar_prototype-test-runner:latest",
            command=[
                "python", "/app/testing/traffic_generator.py",
                "--node-id", str(i),
                "--uploads", str(args.uploads_per_node),
                "--stego-ratio", str(args.stego_ratio),
                "--dropbox-path", f"/Stegnar_Session_{timestamp}",
                "--session-dir", f"/app/testing/reports/Stegnar_Session_{timestamp}"
            ],
            name=container_name,
            network="stegnar_prototype_stegnar-net",
            environment={
                "HTTP_PROXY": "http://stegnar-proxy:8081",
                "HTTPS_PROXY": "http://stegnar-proxy:8081",
                "REQUESTS_CA_BUNDLE": "/etc/ssl/certs/mitmproxy-ca-cert.pem"
            },
            volumes={
                host_testing_dir: {"bind": "/app/testing", "mode": "rw"},
                host_test_images_dir: {"bind": "/app/test_images", "mode": "ro"},
                host_cert_path: {"bind": "/etc/ssl/certs/mitmproxy-ca-cert.pem", "mode": "ro"}
            },
            detach=True
        )
        containers.append(c)

    # 2. Block and monitor sibling container nodes
    print(f"[Orchestrator] Monitoring {len(containers)} test node containers...")
    active_containers = list(containers)
    
    while active_containers:
        for c in list(active_containers):
            c.reload()
            status = c.status
            if status == 'exited':
                logs = c.logs().decode(errors='ignore').strip()
                print(f"\n[Orchestrator] Sibling container {c.name} exited.")
                if logs:
                    print(f"--- Logs from {c.name} ---")
                    print(logs)
                    print(f"--- End logs from {c.name} ---\n")
                c.remove()
                active_containers.remove(c)
        time.sleep(1)

    print("[Orchestrator] All client container nodes have finished execution.")

    # 3. Extract DB and queue logs, and merge node-level CSVs
    export_script = os.path.join(base_dir, "export_test_report.py")
    print("[Orchestrator] Extracting pipeline statistics and merging node logs...")
    subprocess.run([sys.executable, export_script, local_session_dir])

    # 4. Upload all consolidated files to Dropbox folder
    print("[Orchestrator] Uploading reports to Dropbox...")
    for f in os.listdir(local_session_dir):
        file_path = os.path.join(local_session_dir, f)
        if os.path.isfile(file_path):
            try:
                remote_path = f"/Stegnar_Session_{timestamp}/{f}"
                with open(file_path, 'rb') as file_obj:
                    fid = upload_to_dropbox(access_token, remote_path, file_obj.read())
                print(f"[Orchestrator] Uploaded {f} successfully. File ID: {fid}")
            except Exception as e:
                print(f"[Orchestrator] Failed to upload {f}: {e}")

    print(f"[Orchestrator] Test execution completed for session {session_name}!")

if __name__ == "__main__":
    main()
