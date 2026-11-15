import subprocess
import time
import urllib.request
import sys
import os

port = 3015
proc = subprocess.Popen(f'npx next start -p {port}', shell=True)

try:
    print(f"Waiting for Next.js production server on port {port}...")
    server_ready = False
    for i in range(25):
        time.sleep(0.5)
        try:
            req = urllib.request.urlopen(f"http://localhost:{port}/", timeout=2)
            if req.status == 200:
                print(f"Server is UP! (took {i*0.5:.1f}s)")
                server_ready = True
                break
        except Exception as e:
            pass

    if not server_ready:
        print("Failed to connect to server within 12s")
        sys.exit(1)

    endpoints = [
        "/",
        "/generate",
        "/discover",
        "/dishes",
        "/saved",
        "/recipe/1918",
        "/manifest.json",
        "/icons/icon-192x192.png",
        "/icons/egg-logo.png",
    ]

    all_passed = True
    for ep in endpoints:
        url = f"http://localhost:{port}{ep}"
        try:
            res = urllib.request.urlopen(url, timeout=5)
            status = res.status
            content_type = res.headers.get("Content-Type", "")
            print(f"[PASS] {ep} -> {status} ({content_type})")
        except Exception as e:
            print(f"[FAIL] {ep} -> {e}")
            all_passed = False

    if all_passed:
        print("\nAll HTTP endpoints verified successfully with 200 OK!")
    else:
        sys.exit(1)

finally:
    subprocess.call(f'taskkill /F /T /PID {proc.pid}', shell=True)
