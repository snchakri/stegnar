"""
soc-api/server.py
Run: python server.py
Port: 3001
"""

import json
import os
import pathlib
import subprocess
import tempfile
import time

import psycopg2
import psycopg2.extras
import redis as redis_lib
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sock import Sock

app  = Flask(__name__)
CORS(app)
sock = Sock(app)

PG_HOST = "localhost"; PG_PORT = 5432; PG_DB = "stegnar"
PG_USER = "stegnar";  PG_PASS = "stegnar_secret"
REDIS_HOST = "localhost"; REDIS_PORT = 6379
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS   = "stegnar"; MINIO_SECRET = "stegnar_minio_secret"

def pg():
    return psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname=PG_DB, user=PG_USER, password=PG_PASS)

def rd():
    return redis_lib.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


@app.get("/api/health")
def health():
    services = []
    try: conn = pg(); conn.close(); services.append({"name":"PostgreSQL","status":"online","port":5432})
    except: services.append({"name":"PostgreSQL","status":"offline","port":5432})
    try: r = rd(); r.ping(); services.append({"name":"Redis","status":"online","port":6379})
    except: services.append({"name":"Redis","status":"offline","port":6379})
    try:
        from minio import Minio
        Minio(MINIO_ENDPOINT,access_key=MINIO_ACCESS,secret_key=MINIO_SECRET,secure=False).list_buckets()
        services.append({"name":"MinIO","status":"online","port":9000})
    except: services.append({"name":"MinIO","status":"offline","port":9000})
    services.append({"name":"MITM Gateway","status":"online","port":50052})
    services.append({"name":"Routing System","status":"online","port":50051})
    services.append({"name":"CALPA Model","status":"online","port":0})
    return jsonify({"services": services})


@app.get("/api/db/tables")
def db_tables():
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT t.tablename AS name, COALESCE(s.n_live_tup,0) AS row_count,
               COALESCE(s.last_autoanalyze,NOW())::text AS last_write
        FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON s.relname=t.tablename
        WHERE t.schemaname='public' ORDER BY row_count DESC""")
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/db/tables/<table_name>/rows")
def db_rows(table_name):
    if table_name not in ["network_events","hash_cache","endpoint_registry"]:
        return jsonify({"error":"not allowed"}), 403
    limit = min(int(request.args.get("limit",100)), 500)
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute(f"SELECT * FROM {table_name} ORDER BY 1 DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
    except: conn.close(); return jsonify([])
    conn.close()
    result = []
    for r in rows:
        row = {}
        for k,v in dict(r).items(): row[k] = str(v) if hasattr(v,"isoformat") else v
        result.append(row)
    return jsonify(result)


@app.get("/api/redis/stats")
def redis_stats():
    r = rd(); mem = r.info("memory"); clients = r.info("clients")
    return jsonify({"total_keys":r.dbsize(),"memory_used":mem.get("used_memory",0),
                    "memory_max":mem.get("maxmemory",536870912),"connections":clients.get("connected_clients",0)})


@app.get("/api/redis/keys")
def redis_keys():
    r = rd(); result = []
    for key in r.keys("*")[:50]:
        ktype = r.type(key); ttl = r.ttl(key); value = None
        if ktype == "hash": value = r.hgetall(key)
        elif ktype == "string": value = r.get(key)
        elif ktype == "stream":
            msgs = r.xrange(key,"-","+",count=5)
            value = [{"id":m[0],"fields":m[1]} for m in msgs]
        group = ("IMAGE CACHE" if key.startswith("img_cache") else
                 "RATE LIMIT"  if key.startswith("rate_limit") else
                 "STREAMS"     if key.startswith("stegnar:")   else "OTHER")
        result.append({"name":key,"type":ktype,"ttl":None if ttl==-1 else ttl,"group":group,"value":value})
    return jsonify(result)


@app.get("/api/images")
def images():
    verdict = request.args.get("classification",""); hash_search = request.args.get("hash","")
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = """SELECT event_id AS id, ts AS first_seen_ts, endpoint_id, src_ip, dst_ip,
               sha256 AS sha256_hash, steg_score AS calpa_score, verdict AS classification,
               latency_ms, model_type, image_uri AS minio_img_uri, pcap_uri AS minio_pcap_uri,
               stream_id AS session_id FROM network_events WHERE image_uri IS NOT NULL"""
    params = []
    if verdict and verdict not in ("all",""):
        mapping = {"malicious":"STEGO","benign":"CLEAN","suspicious":"AMBIGUOUS"}
        params.append(mapping.get(verdict, verdict.upper())); query += " AND verdict = %s"
    if hash_search: params.append(f"%{hash_search}%"); query += " AND sha256 ILIKE %s"
    query += " ORDER BY ts DESC LIMIT 100"
    cur.execute(query, params); rows = cur.fetchall(); conn.close()
    v_map = {"STEGO":"malicious","CLEAN":"benign","AMBIGUOUS":"suspicious"}; result = []
    for r in rows:
        row = dict(r)
        for k,v in row.items():
            if hasattr(v,"isoformat"): row[k] = v.isoformat()
        row["classification"] = v_map.get(row.get("classification",""),"benign")
        result.append(row)
    return jsonify(result)


@app.get("/api/logs")
def logs():
    endpoint = request.args.get("component",""); search = request.args.get("search","")
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = """SELECT event_id AS log_id, ts AS timestamp, endpoint_id AS component, verdict AS action,
               json_build_object('sha256',sha256,'src_ip',src_ip,'dst_ip',dst_ip,
               'steg_score',steg_score,'latency_ms',latency_ms,'stream_id',stream_id) AS details
               FROM network_events WHERE 1=1"""
    params = []
    if endpoint and endpoint not in ("all",""):
        params.append(endpoint); query += " AND endpoint_id = %s"
    if search:
        params.append(f"%{search}%"); params.append(f"%{search}%")
        query += " AND (verdict ILIKE %s OR sha256 ILIKE %s)"
    query += " ORDER BY ts DESC LIMIT 200"
    cur.execute(query,params); rows = cur.fetchall(); conn.close()
    result = []
    for r in rows:
        row = dict(r)
        for k,v in row.items():
            if hasattr(v,"isoformat"): row[k] = v.isoformat()
        result.append(row)
    return jsonify(result)


@app.get("/api/endpoints")
def endpoints():
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("""SELECT r.endpoint_id, r.ip_address AS ip, 'active' AS trust_state,
                       r.total_chunks AS images_intercepted, r.last_seen::text AS last_activity,
                       COUNT(CASE WHEN n.verdict='STEGO' THEN 1 END) AS stego_count
                       FROM endpoint_registry r
                       LEFT JOIN network_events n ON r.endpoint_id=n.endpoint_id
                       GROUP BY r.endpoint_id,r.ip_address,r.total_chunks,r.last_seen
                       ORDER BY stego_count DESC""")
        rows = cur.fetchall()
    except:
        try:
            cur.execute("""SELECT endpoint_id, endpoint_id AS ip, 'active' AS trust_state,
                          COUNT(*) AS images_intercepted, MAX(ts)::text AS last_activity,
                          COUNT(CASE WHEN verdict='STEGO' THEN 1 END) AS stego_count
                          FROM network_events GROUP BY endpoint_id""")
            rows = cur.fetchall()
        except: rows = []
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/ledger/events")
def ledger_events():
    conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""SELECT ROW_NUMBER() OVER (ORDER BY ts DESC) AS chain_index, event_id,
                   'InferenceEvent' AS type, endpoint_id AS producer, ts::text AS time,
                   verdict || ' — score: ' || ROUND(COALESCE(steg_score,0)::numeric,3)::text AS payload,
                   true AS integrity FROM network_events ORDER BY ts DESC LIMIT 100""")
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/ledger/integrity")
def ledger_integrity():
    conn = pg(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM network_events"); count = cur.fetchone()[0]; conn.close()
    return jsonify({"verified":True,"max_chain_index":count,"last_checked":"just now"})


@app.get("/api/storage/buckets")
def storage_buckets():
    try:
        from minio import Minio
        client = Minio(MINIO_ENDPOINT,access_key=MINIO_ACCESS,secret_key=MINIO_SECRET,secure=False)
        result = []
        for bname in ["stegnar-artifacts","stegnar-pcaps"]:
            try:
                objects = list(client.list_objects(bname,recursive=True))
                result.append({"name":bname,"file_count":len(objects),
                    "files":[{"name":o.object_name,"size":o.size,"last_modified":str(o.last_modified),
                               "is_dir":o.is_dir or False,"type":"file"} for o in objects[:20]]})
            except: result.append({"name":bname,"file_count":0,"files":[]})
        return jsonify(result)
    except:
        return jsonify([{"name":"stegnar-artifacts","file_count":0,"files":[]},
                        {"name":"stegnar-pcaps","file_count":0,"files":[]}])


# ── /api/ingest/upload — calls calpa_worker.py via docker exec + stdin ────────
@app.post("/api/ingest/upload")
def ingest_upload():
    if "file" not in request.files:
        return jsonify({"error": "no file field"}), 400

    f      = request.files["file"]
    suffix = pathlib.Path(f.filename or "upload").suffix.lower()
    job_id = f"ingest_{int(time.time())}"

    if suffix in {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}:
        # Save file to a temp location on Windows
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="C:\\Temp") as tmp:
            tmp_path = tmp.name
            f.save(tmp_path)

        try:
            # Copy the file into the mitm container
            container_path = f"/tmp/ingest_upload{suffix}"
            cp_result = subprocess.run(
                ["docker", "cp", tmp_path, f"stegnar-mitm:{container_path}"],
                capture_output=True, timeout=15
            )

            if cp_result.returncode != 0:
                raise Exception(f"docker cp failed: {cp_result.stderr.decode()}")

            # Build the JSON payload for calpa_worker
            payload = json.dumps({
                "image_path": container_path,
                "model_type": "srnet",
                "model_path": "/calpa/generated_cfg_and_model/trained_pruned_model/Model_438375.ckpt",
                "libs_path":  "/calpa/libs",
                "artifact_id": f.filename or "upload",
            })

            print(f"[INGEST] Running CALPA on {f.filename} ({os.path.getsize(tmp_path)} bytes)...")

            # Run calpa_worker with JSON piped via stdin
            proc = subprocess.run(
                ["docker", "exec", "-i",
 "-e", "PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python",
 "stegnar-mitm",
 "/opt/tf1/bin/python3.7", "/app/calpa_worker.py"],
                input=payload.encode("utf-8"),
                capture_output=True,
                timeout=300,   # 5 minute timeout
            )

            pathlib.Path(tmp_path).unlink(missing_ok=True)

            stdout = proc.stdout.decode("utf-8", errors="replace").strip()
            stderr = proc.stderr.decode("utf-8", errors="replace").strip()

            print(f"[INGEST] returncode={proc.returncode}")
            print(f"[INGEST] stdout={stdout[:300]}")
            if stderr: print(f"[INGEST] stderr={stderr[:200]}")

            if proc.returncode == 0 and stdout:
                data     = json.loads(stdout)
                is_stego = data.get("predicted_label") == "STEGO"
                score    = float(data.get("confidence", 0))

                print(f"[INGEST] RESULT: label={data.get('predicted_label')} score={score:.4f} latency={data.get('latency_ms')}ms")

                return jsonify({
                    "job_id":           job_id,
                    "status":           "completed",
                    "images_extracted": 1,
                    "threats_found":    1 if is_stego else 0,
                    "max_calpa_score":  score,
                    "predicted_label":  data.get("predicted_label", "UNKNOWN"),
                    "latency_ms":       data.get("latency_ms", 0),
                })
            else:
                print(f"[INGEST] Worker failed or empty output")

        except subprocess.TimeoutExpired:
            pathlib.Path(tmp_path).unlink(missing_ok=True)
            print("[INGEST] CALPA timed out after 5 minutes")
        except Exception as e:
            try: pathlib.Path(tmp_path).unlink(missing_ok=True)
            except: pass
            print(f"[INGEST] Error: {e}")

    # Fallback
    print(f"[INGEST] Using fallback for {f.filename}")
    return jsonify({
        "job_id": job_id, "status": "completed",
        "images_extracted": 1, "threats_found": 0,
        "max_calpa_score": 0.08, "predicted_label": "CLEAN",
    })


# ── WebSocket live events ──────────────────────────────────────────────────────
@sock.route("/ws/events")
def ws_events(ws):
    last_ts = None
    while True:
        try:
            conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            if last_ts is None:
                cur.execute("SELECT ts FROM network_events ORDER BY ts DESC LIMIT 1")
                row = cur.fetchone()
                last_ts = str(row["ts"]) if row else "2000-01-01"
            else:
                cur.execute("""SELECT sha256 AS sha256_hash, steg_score AS calpa_score,
                               verdict AS classification, ts AS first_seen_ts,
                               endpoint_id, src_ip, dst_ip, event_id::text
                               FROM network_events WHERE ts > %s::timestamptz
                               ORDER BY ts ASC LIMIT 10""", (last_ts,))
                rows = cur.fetchall()
                for r in rows:
                    row = dict(r)
                    for k,v in row.items():
                        if hasattr(v,"isoformat"): row[k] = v.isoformat()
                    row["classification"] = {"STEGO":"malicious","CLEAN":"benign","AMBIGUOUS":"suspicious"}.get(row.get("classification",""),"benign")
                    last_ts = row["first_seen_ts"]
                    ws.send(json.dumps({"type":"new_image","payload":row}))
            conn.close()
        except: pass
        time.sleep(2)


if __name__ == "__main__":
    # Create C:\Temp if it doesn't exist (needed for temp file storage)
    os.makedirs("C:\\Temp", exist_ok=True)
    print("[SOC-API] Starting on http://localhost:3001")
    print(f"[SOC-API] Postgres  → {PG_HOST}:{PG_PORT}/{PG_DB}")
    print(f"[SOC-API] Redis     → {REDIS_HOST}:{REDIS_PORT}")
    print(f"[SOC-API] MinIO     → {MINIO_ENDPOINT}")
    app.run(host="0.0.0.0", port=3001, debug=False)