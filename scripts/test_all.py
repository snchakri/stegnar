import urllib.request, json, os, glob, time
API = 'http://localhost:3001/api/ingest/image'
boundary = '----WebKitFormBoundarystest'
files = glob.glob('test_images/*.jpg')
for fpath in files:
    with open(fpath, 'rb') as f: img = f.read()
    name = os.path.basename(fpath)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/jpeg\r\n\r\n').encode('utf-8') + img + (f'\r\n--{boundary}--\r\n').encode('utf-8')
    req = urllib.request.Request(API, data=body, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    res = json.loads(urllib.request.urlopen(req).read().decode())
    job_id = res['job_id']
    while True:
        try:
            r = json.loads(urllib.request.urlopen(f'http://localhost:3001/api/ingest/jobs/{job_id}').read().decode())
            if r.get('status') in ('completed', 'failed'):
                print(f'{name}: {r.get("result", {}).get("predicted_label")} ({r.get("result", {}).get("confidence")})')
                break
            time.sleep(1)
        except Exception as e:
            time.sleep(1)
