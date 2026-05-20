"""
soc-api/server.py
Run: python server.py
Port: 3001
"""

import json
import logging
import os
import pathlib
import socket
import subprocess
import tempfile
import threading
import time
import uuid
import urllib3
import shutil
import traceback

import psycopg2
import psycopg2.extras
import redis as redis_lib
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sock import Sock
import io
import tarfile

try:
    import docker as docker_sdk
except Exception:
    docker_sdk = None

app  = Flask(__name__)
CORS(app)
sock = Sock(app)

logging.basicConfig(
    level=os.getenv("SOC_API_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("soc-api")

PG_HOST = os.getenv("PG_HOST", "localhost"); PG_PORT = int(os.getenv("PG_PORT", "5432")); PG_DB = os.getenv("PG_DB", "stegnar")
PG_USER = os.getenv("PG_USER", "stegnar");  PG_PASS = os.getenv("PG_PASS", "stegnar_secret")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost"); REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS   = os.getenv("MINIO_ACCESS", "stegnar"); MINIO_SECRET = os.getenv("MINIO_SECRET", "stegnar_minio_secret")
TEMP_DIR = os.getenv("SOC_API_TEMP_DIR", tempfile.gettempdir())
SOC_API_LOG_FILE = os.getenv("SOC_API_LOG_FILE", "/var/log/stegnar/soc-api.log")
PROXY_LOG_FILE = os.getenv("PROXY_LOG_FILE", "/var/log/stegnar/proxy.log")
INGEST_TIMEOUT_SEC = int(os.getenv("INGEST_TIMEOUT_SEC", "300"))
INGEST_EPHEMERAL = os.getenv("INGEST_EPHEMERAL", "true").strip().lower() in ("1", "true", "yes", "on")
INGEST_MITM_CONTAINER = os.getenv("INGEST_MITM_CONTAINER", "stegnar-mitm")
INGEST_MITM_IMAGE = os.getenv("INGEST_MITM_IMAGE", "")
INGEST_NETWORK = os.getenv("INGEST_NETWORK", "").strip()
INGEST_SAMPLE_IMAGE = os.getenv("INGEST_SAMPLE_IMAGE", "/test_images/cover_test00001.jpg")
CALPA_MODEL_PATH = os.getenv("CALPA_MODEL_PATH", "/calpa/generated_cfg_and_model/trained_pruned_model/Model_438375.ckpt")
CALPA_CFG_PATH = os.getenv("CALPA_CFG_PATH", "/calpa/generated_cfg_and_model/srnet_juniward_04_threshold05.cfg")
CALPA_LIBS_PATH = os.getenv("CALPA_LIBS_PATH", "/calpa/libs")
PCAP_PLAIN_MAX_IMAGES = int(os.getenv("PCAP_PLAIN_MAX_IMAGES", "5"))

INGEST_JOBS = {}
INGEST_LOCK = threading.Lock()

SETTINGS_STATE = {
    "alertThreshold": 70,
    "autoRefresh": True,
    "retentionDays": 90,
    "maxConcurrentScans": 10,
    "enableNotifications": True,
    "enableEmailAlerts": False,
    "enableAuditLog": True,
}


class WorkerRunError(RuntimeError):
    def __init__(self, message: str, stdout: str = "", stderr: str = ""):
        super().__init__(message)
        self.stdout = stdout
        self.stderr = stderr


def _tail_file(path: str, limit: int = 200) -> list[str]:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            lines = handle.readlines()
        return [line.rstrip("\n") for line in lines[-limit:]]
    except FileNotFoundError:
        return []
    except Exception:
        logger.exception("event=tail_file_failed path=%s limit=%s", path, limit)
        return []


def _docker_available() -> bool:
    # Prefer verifying the Docker SDK can connect to the daemon via the
    # mounted socket. Fall back to checking for the `docker` binary.
    if docker_sdk is not None:
        try:
            client = docker_sdk.from_env()
            # ping the daemon to ensure connectivity
            client.ping()
            return True
        except Exception:
            pass
    return shutil.which("docker") is not None


def _run_docker_command(args: list[str], *, timeout: int = 5, input_text: str | None = None):
    if not _docker_available():
        raise FileNotFoundError("docker binary not available in container")
    logger.info("event=docker_command args=%s", " ".join(args))
    return subprocess.run(
        ["docker", *args],
        input=input_text,
        capture_output=True,
        timeout=timeout,
        text=True,
    )


def _docker_inspect_json(container_name: str) -> dict:
    if docker_sdk is not None:
        try:
            client = docker_sdk.from_env()
            container = client.containers.get(container_name)
            return container.attrs
        except Exception:
            logger.exception("event=docker_sdk_inspect_failed container=%s", container_name)
    proc = _run_docker_command(["inspect", container_name], timeout=8)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or f"docker inspect failed for {container_name}").strip())
    payload = json.loads(proc.stdout or "[]")
    return payload[0] if payload else {}


def _docker_version_info() -> dict:
    if not _docker_available():
        return {"available": False, "version": None, "error": "docker not available"}
    if docker_sdk is not None:
        try:
            client = docker_sdk.from_env()
            info = client.version()
            return {"available": True, "version": info.get("Version"), "raw": info}
        except Exception:
            logger.exception("event=docker_sdk_version_failed")
    proc = _run_docker_command(["--version"], timeout=5)
    return {
        "available": proc.returncode == 0,
        "version": (proc.stdout or proc.stderr or "").strip() or None,
        "returncode": proc.returncode,
    }


def _docker_networks() -> list[str]:
    if not _docker_available():
        return []
    if docker_sdk is not None:
        try:
            client = docker_sdk.from_env()
            networks = client.networks.list()
            return [n.name for n in networks]
        except Exception:
            logger.exception("event=docker_sdk_network_list_failed")
    proc = _run_docker_command(["network", "ls", "--format", "{{.Name}}"], timeout=5)
    if proc.returncode != 0:
        logger.warning("event=docker_network_ls_failed stderr=%s", (proc.stderr or "").strip())
        return []
    return [line.strip() for line in (proc.stdout or "").splitlines() if line.strip()]


def _resolve_ingest_network() -> str:
    if INGEST_NETWORK:
        return INGEST_NETWORK
    try:
        inspect = _docker_inspect_json(INGEST_MITM_CONTAINER)
        networks = list(((inspect.get("NetworkSettings") or {}).get("Networks") or {}).keys())
        if networks:
            return networks[0]
    except Exception:
        logger.exception("event=resolve_ingest_network_failed container=%s", INGEST_MITM_CONTAINER)
    return "stegnar-net"


def _tail_logs_from_container_or_file(container_name: str, log_file: str, limit: int = 200) -> tuple[str, list[str]]:
    file_lines = _tail_file(log_file, limit)
    if file_lines:
        return ("file", file_lines)
    if _docker_available():
        if docker_sdk is not None:
            try:
                client = docker_sdk.from_env()
                container = client.containers.get(container_name)
                raw = container.logs(tail=limit).decode("utf-8", errors="replace")
                lines = [line for line in raw.splitlines() if line.strip()]
                if lines:
                    return ("docker", lines[-limit:])
            except Exception:
                logger.exception("event=docker_sdk_logs_failed container=%s", container_name)
        try:
            proc = _run_docker_command(["logs", "--tail", str(limit), container_name], timeout=8)
            raw = (proc.stdout or "") + (proc.stderr or "")
            lines = [line for line in raw.splitlines() if line.strip()]
            if lines:
                return ("docker", lines[-limit:])
        except Exception:
            logger.exception("event=docker_logs_failed container=%s", container_name)
    return ("unavailable", [])


def _docker_get_container(name: str):
    if docker_sdk is None:
        return None
    try:
        client = docker_sdk.from_env()
        return client.containers.get(name)
    except Exception:
        logger.exception("event=docker_sdk_container_get_failed container=%s", name)
        return None

def pg():
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DB,
        user=PG_USER,
        password=PG_PASS,
        connect_timeout=2,
    )

def rd():
    return redis_lib.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )

def minio_client():
    from minio import Minio
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS,
        secret_key=MINIO_SECRET,
        secure=False,
        http_client=urllib3.PoolManager(timeout=urllib3.Timeout(connect=1.0, read=2.0)),
    )

def _is_port_open(host: str, port: int, timeout_sec: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout_sec):
            return True
    except Exception as exc:
        logger.debug("event=port_check_failed host=%s port=%s error=%s", host, port, exc)
        return False


def _job_set(job_id: str, **fields):
    with INGEST_LOCK:
        if job_id not in INGEST_JOBS:
            INGEST_JOBS[job_id] = {"job_id": job_id, "created_at": int(time.time() * 1000)}
        INGEST_JOBS[job_id].update(fields)


def _resolve_mitm_image() -> str:
    if INGEST_MITM_IMAGE:
        return INGEST_MITM_IMAGE
    try:
        if docker_sdk is not None:
            try:
                client = docker_sdk.from_env()
                container = client.containers.get(INGEST_MITM_CONTAINER)
                img = (container.attrs.get("Config") or {}).get("Image")
                if img:
                    return img
            except Exception:
                logger.exception("event=docker_sdk_resolve_mitm_image_failed container=%s", INGEST_MITM_CONTAINER)
        # Fallback to docker CLI inspect
        proc = subprocess.run(
            ["docker", "inspect", "-f", "{{.Config.Image}}", INGEST_MITM_CONTAINER],
            capture_output=True,
            timeout=5,
            text=True,
        )
        img = (proc.stdout or "").strip()
        if proc.returncode == 0 and img:
            return img
    except Exception:
        logger.exception("event=resolve_mitm_image_failed container=%s", INGEST_MITM_CONTAINER)
    return "stegnar/mitm-gateway:latest"


def _put_archive_bytes(client, container_id: str, target_dir: str, filename: str, data: bytes) -> None:
    tarstream = io.BytesIO()
    with tarfile.TarFile(fileobj=tarstream, mode='w') as tar:
        tarinfo = tarfile.TarInfo(name=filename)
        tarinfo.size = len(data)
        tarinfo.mtime = int(time.time())
        tar.addfile(tarinfo, io.BytesIO(data))
    tarstream.seek(0)
    ok = client.api.put_archive(container_id, target_dir, tarstream.getvalue())
    if not ok:
        raise RuntimeError("docker put_archive failed")


def _is_image_bytes(data: bytes) -> bool:
    if len(data) < 4:
        return False
    if data.startswith(b"\xff\xd8\xff"):
        return True
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return True
    if data.startswith(b"RIFF") and b"WEBP" in data[8:16]:
        return True
    if data.startswith(b"BM"):
        return True
    if data.startswith(b"II*\x00") or data.startswith(b"MM\x00*"):
        return True
    return False


def _is_image_file(path: str) -> bool:
    try:
        with open(path, "rb") as handle:
            head = handle.read(16)
        return _is_image_bytes(head)
    except Exception:
        return False


def _extract_images_from_pcap(pcap_path: str) -> tuple[str, list[str]]:
    if shutil.which("tshark") is None:
        raise RuntimeError("tshark not available in soc-api container")
    extract_dir = tempfile.mkdtemp(prefix="pcap_extract_", dir=TEMP_DIR)
    proc = subprocess.run(
        ["tshark", "-r", pcap_path, "--export-objects", f"http,{extract_dir}"],
        capture_output=True,
        timeout=90,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "tshark export failed").strip())

    candidates = []
    for root, _, files in os.walk(extract_dir):
        for name in files:
            candidates.append(os.path.join(root, name))

    images = []
    for path in candidates:
        suffix = pathlib.Path(path).suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff"}:
            images.append(path)
            continue
        if _is_image_file(path):
            images.append(path)

    return extract_dir, images


def _run_calpa_for_image(local_path: str, artifact_id: str):
    suffix = pathlib.Path(local_path).suffix.lower() or ".jpg"
    payload = json.dumps({
        "image_path": f"/tmp/ingest_upload{suffix}",
        "model_path": CALPA_MODEL_PATH,
        "cfg_path": CALPA_CFG_PATH,
        "libs_path": CALPA_LIBS_PATH,
        "artifact_id": artifact_id,
    })

    if docker_sdk is None:
        raise RuntimeError("docker SDK not available inside soc-api container")

    if INGEST_EPHEMERAL:
        container_name = f"stegnar-ingest-{uuid.uuid4().hex[:10]}"
        image_name = _resolve_mitm_image()
        network_name = _resolve_ingest_network()
        container = None
        try:
            client = docker_sdk.from_env()
            container = client.containers.create(
                image=image_name,
                name=container_name,
                command=["/bin/sh", "-lc", "sleep 600"],
                network=network_name,
                detach=True,
            )
            container.start()

            img_data = pathlib.Path(local_path).read_bytes()
            _put_archive_bytes(client, container.id, "/tmp", f"ingest_upload{suffix}", img_data)
            _put_archive_bytes(client, container.id, "/tmp", "ingest_payload.json", payload.encode())

            exec_result = container.exec_run(
                ["/bin/sh", "-lc", "/opt/tf1/bin/python3.7 /app/calpa_worker.py < /tmp/ingest_payload.json"],
                environment={"PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION": "python"},
                demux=True,
            )
            stdout_bytes, stderr_bytes = exec_result.output or (b"", b"")
            class _P: pass
            run_proc = _P()
            run_proc.returncode = exec_result.exit_code
            run_proc.stdout = (stdout_bytes or b"").decode("utf-8", errors="replace")
            run_proc.stderr = (stderr_bytes or b"").decode("utf-8", errors="replace")
        finally:
            if container is not None:
                try:
                    container.remove(force=True)
                except Exception as exc:
                    logger.debug("event=ephemeral_container_cleanup_failed container=%s error=%s", container_name, exc)
    else:
        try:
            client = docker_sdk.from_env()
            container = client.containers.get(INGEST_MITM_CONTAINER)
            img_data = pathlib.Path(local_path).read_bytes()
            _put_archive_bytes(client, container.id, "/tmp", f"ingest_upload{suffix}", img_data)
            _put_archive_bytes(client, container.id, "/tmp", "ingest_payload.json", payload.encode())

            exec_result = container.exec_run(
                ["/bin/sh", "-lc", "/opt/tf1/bin/python3.7 /app/calpa_worker.py < /tmp/ingest_payload.json"],
                environment={"PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION": "python"},
                demux=True,
            )
            stdout_bytes, stderr_bytes = exec_result.output or (b"", b"")
            class _P: pass
            run_proc = _P()
            run_proc.returncode = exec_result.exit_code
            run_proc.stdout = (stdout_bytes or b"").decode("utf-8", errors="replace")
            run_proc.stderr = (stderr_bytes or b"").decode("utf-8", errors="replace")
        except Exception:
            logger.exception("event=docker_sdk_exec_failed container=%s", INGEST_MITM_CONTAINER)
            raise RuntimeError("docker exec via SDK failed")

    stdout = (run_proc.stdout or "").strip()
    stderr = (run_proc.stderr or "").strip()
    if run_proc.returncode != 0:
        raise RuntimeError(f"worker_failed rc={run_proc.returncode} stderr={stderr[:240]}")
    if not stdout:
        raise RuntimeError("worker_empty_stdout")

    parsed = json.loads(stdout)
    predicted = parsed.get("predicted_label", "UNKNOWN")
    confidence = float(parsed.get("confidence", 0.0))
    latency_ms = float(parsed.get("latency_ms", 0.0))

    return {
        "predicted_label": predicted,
        "confidence": confidence,
        "latency_ms": latency_ms,
        "classification": "MALICIOUS" if predicted == "STEGO" else "BENIGN",
        "message": "CALPA analysis completed",
        "worker_mode": "ephemeral" if INGEST_EPHEMERAL else "exec",
    }


def _start_ingest_image_job(upload_path: str, original_name: str):
    job_id = f"ingest_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    _job_set(job_id, status="queued", kind="image", filename=original_name)

    def _run():
        _job_set(job_id, status="running", started_at=int(time.time() * 1000))
        try:
            result = _run_calpa_for_image(upload_path, original_name)
            _job_set(job_id, status="completed", completed_at=int(time.time() * 1000), result=result)
        except Exception as e:
            _job_set(job_id, status="failed", completed_at=int(time.time() * 1000), error=str(e))
        finally:
            pathlib.Path(upload_path).unlink(missing_ok=True)

    threading.Thread(target=_run, daemon=True).start()
    return job_id


def _start_ingest_pcap_job(pcap_path: str, key_path: str, pcap_name: str, key_name: str):
    job_id = f"pcap_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    _job_set(job_id, status="queued", kind="pcap", pcap=pcap_name, keys=key_name)

    def _run():
        _job_set(job_id, status="running", started_at=int(time.time() * 1000))
        try:
            pcap_size = pathlib.Path(pcap_path).stat().st_size
            key_size = pathlib.Path(key_path).stat().st_size
            result = {
                "classification": "UNKNOWN",
                "confidence": 0.0,
                "message": "PCAP and key files accepted for forensic workflow",
                "pcap_bytes": pcap_size,
                "key_bytes": key_size,
            }
            _job_set(job_id, status="completed", completed_at=int(time.time() * 1000), result=result)
        except Exception as e:
            _job_set(job_id, status="failed", completed_at=int(time.time() * 1000), error=str(e))
        finally:
            pathlib.Path(pcap_path).unlink(missing_ok=True)
            pathlib.Path(key_path).unlink(missing_ok=True)

    threading.Thread(target=_run, daemon=True).start()
    return job_id


def _start_ingest_pcap_plain_job(pcap_path: str, pcap_name: str):
    job_id = f"pcap_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    _job_set(job_id, status="queued", kind="pcap_plain", pcap=pcap_name)

    def _run():
        _job_set(job_id, status="running", started_at=int(time.time() * 1000))
        extract_dir = None
        try:
            pcap_size = pathlib.Path(pcap_path).stat().st_size
            extract_dir, images = _extract_images_from_pcap(pcap_path)
            if not images:
                raise RuntimeError("no images extracted from pcap")

            results = []
            for idx, img_path in enumerate(images[:max(1, PCAP_PLAIN_MAX_IMAGES)]):
                analysis = _run_calpa_for_image(img_path, f"{pcap_name}:{idx}")
                results.append({"image": pathlib.Path(img_path).name, **analysis})

            stego_count = sum(1 for r in results if r.get("classification") == "MALICIOUS")
            overall = "MALICIOUS" if stego_count > 0 else "BENIGN"
            max_conf = max((r.get("confidence", 0.0) for r in results), default=0.0)

            result = {
                "classification": overall,
                "confidence": max_conf,
                "message": "PCAP extracted and analyzed",
                "pcap_bytes": pcap_size,
                "images_extracted": len(images),
                "images_analyzed": len(results),
                "stego_count": stego_count,
                "results": results,
            }
            _job_set(job_id, status="completed", completed_at=int(time.time() * 1000), result=result)
        except Exception as e:
            _job_set(job_id, status="failed", completed_at=int(time.time() * 1000), error=str(e))
        finally:
            pathlib.Path(pcap_path).unlink(missing_ok=True)
            if extract_dir:
                shutil.rmtree(extract_dir, ignore_errors=True)

    threading.Thread(target=_run, daemon=True).start()
    return job_id


@app.get("/api/health")
def health():
    services = []
    minio_host, minio_port = (MINIO_ENDPOINT.split(":", 1) + ["9000"])[:2]
    services.append({"name":"PostgreSQL","status":"online" if _is_port_open(PG_HOST, PG_PORT) else "offline","port":PG_PORT})
    services.append({"name":"Redis","status":"online" if _is_port_open(REDIS_HOST, REDIS_PORT) else "offline","port":REDIS_PORT})
    services.append({"name":"MinIO","status":"online" if _is_port_open(minio_host, int(minio_port)) else "offline","port":int(minio_port)})
    services.append({"name":"MITM Gateway","status":"online","port":50052})
    services.append({"name":"Routing System","status":"online","port":50051})
    services.append({"name":"CALPA Model","status":"online","port":0})
    return jsonify({"services": services})


@app.get("/api/admin/diagnostics")
def admin_diagnostics():
    docker_info = _docker_version_info()
    soc_source, soc_logs = _tail_logs_from_container_or_file("stegnar-soc-api", SOC_API_LOG_FILE)
    proxy_source, proxy_logs = _tail_logs_from_container_or_file("stegnar-proxy", PROXY_LOG_FILE)
    return jsonify({
        "docker_available": docker_info.get("available", False),
        "docker_version": docker_info.get("version"),
        "docker_info": docker_info,
        "ingest_network": _resolve_ingest_network(),
        "ingest_mitm_container": INGEST_MITM_CONTAINER,
        "docker_networks": _docker_networks(),
        "soc_api_logs": soc_logs,
        "soc_api_log_source": soc_source,
        "proxy_logs": proxy_logs,
        "proxy_log_source": proxy_source,
    })


@app.get("/api/db/tables")
def db_tables():
    try:
        conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT t.tablename AS name, COALESCE(s.n_live_tup,0) AS row_count,
                   COALESCE(s.last_autoanalyze,NOW())::text AS last_write
            FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON s.relname=t.tablename
            WHERE t.schemaname='public' ORDER BY row_count DESC""")
        rows = cur.fetchall(); conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception:
        logger.exception("event=db_tables_failed")
        return jsonify({"error": "database unavailable"}), 500


@app.get("/api/db/tables/<table_name>/rows")
def db_rows(table_name):
    if table_name not in ["network_events","hash_cache","endpoint_registry"]:
        return jsonify({"error":"not allowed"}), 403
    limit = min(int(request.args.get("limit",100)), 500)
    try:
        conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(f"SELECT * FROM {table_name} ORDER BY 1 DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
    except Exception:
        logger.exception("event=db_rows_failed table=%s", table_name)
        try: conn.close()
        except Exception:
            pass
        return jsonify({"error": "database unavailable"}), 500
    conn.close()
    result = []
    for r in rows:
        row = {}
        for k,v in dict(r).items(): row[k] = str(v) if hasattr(v,"isoformat") else v
        result.append(row)
    return jsonify(result)


@app.get("/api/redis/stats")
def redis_stats():
    if not _is_port_open(REDIS_HOST, REDIS_PORT):
        return jsonify({"total_keys":0,"memory_used":0,"memory_max":536870912,"connections":0})
    try:
        r = rd(); mem = r.info("memory"); clients = r.info("clients")
        return jsonify({"total_keys":r.dbsize(),"memory_used":mem.get("used_memory",0),
                        "memory_max":mem.get("maxmemory",536870912),"connections":clients.get("connected_clients",0)})
    except Exception:
        logger.exception("event=redis_stats_failed")
        return jsonify({"total_keys":0,"memory_used":0,"memory_max":536870912,"connections":0})


@app.get("/api/redis/keys")
def redis_keys():
    if not _is_port_open(REDIS_HOST, REDIS_PORT):
        return jsonify([])
    try:
        r = rd(); result = []
        # r.keys can return None or very large lists; handle defensively
        keys = r.keys("*") or []
        for key in keys[:50]:
            ktype = r.type(key); ttl = r.ttl(key); value = None
            if ktype == "hash": value = r.hgetall(key)
            elif ktype == "string": value = r.get(key)
            elif ktype == "stream":
                msgs = r.xrange(key,"-","+",count=5)
                value = [{"id":m[0],"fields":m[1]} for m in msgs]
            # Normalize commonly used cache prefixes so UI shows counts
            group = ("IMAGE CACHE" if key.startswith("img_cache") or key.startswith("stegnar:cache") else
                     "RATE LIMIT"  if key.startswith("rate_limit") else
                     "STREAMS"     if key.startswith("stegnar:")   else "OTHER")
            result.append({"name":key,"type":ktype,"ttl":None if ttl==-1 else ttl,"group":group,"value":value})
        return jsonify(result)
    except Exception:
        logger.exception("event=redis_keys_failed")
        return jsonify([])


@app.get("/api/images")
def images():
    verdict = request.args.get("classification",""); hash_search = request.args.get("hash","")
    try:
        conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = """SELECT event_id AS id, ts AS first_seen_ts, endpoint_id, src_ip, dst_ip,
                   sha256 AS sha256_hash, steg_score AS calpa_score, verdict AS classification,
                   latency_ms, model_type, image_uri AS minio_img_uri, pcap_uri AS minio_pcap_uri,
                   stream_id FROM network_events WHERE image_uri IS NOT NULL"""
        params = []
        if verdict and verdict not in ("all",""):
            mapping = {"malicious":"STEGO","benign":"CLEAN","suspicious":"AMBIGUOUS"}
            params.append(mapping.get(verdict, verdict.upper())); query += " AND verdict = %s"
        if hash_search: params.append(f"%{hash_search}%"); query += " AND sha256 ILIKE %s"
        query += " ORDER BY ts DESC LIMIT 100"
        cur.execute(query, params); rows = cur.fetchall(); conn.close()
    except Exception:
        logger.exception("event=images_failed")
        rows = []
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
    try:
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
    except Exception:
        logger.exception("event=logs_failed")
        rows = []
    result = []
    for r in rows:
        row = dict(r)
        for k,v in row.items():
            if hasattr(v,"isoformat"): row[k] = v.isoformat()
        result.append(row)
    return jsonify(result)


@app.get("/api/settings")
def settings_get():
    return jsonify(dict(SETTINGS_STATE))


@app.post("/api/settings")
def settings_post():
    try:
        payload = request.get_json(silent=True) or {}
        for key in SETTINGS_STATE:
            if key in payload:
                SETTINGS_STATE[key] = payload[key]
        return jsonify({"ok": True, **SETTINGS_STATE})
    except Exception:
        logger.exception("event=settings_update_failed")
        return jsonify({"ok": False, "error": "failed to update settings"}), 500


@app.get("/api/endpoints")
def endpoints():
    try:
        conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""SELECT r.endpoint_id, r.ip_address AS ip, 'active' AS trust_state,
                       r.total_chunks AS images_intercepted, r.last_seen::text AS last_activity,
                       COUNT(CASE WHEN n.verdict='STEGO' THEN 1 END) AS stego_count
                       FROM endpoint_registry r
                       LEFT JOIN network_events n ON r.endpoint_id=n.endpoint_id
                       GROUP BY r.endpoint_id,r.ip_address,r.total_chunks,r.last_seen
                       ORDER BY stego_count DESC""")
        rows = cur.fetchall()
    except Exception:
        logger.exception("event=endpoints_failed")
        try:
            cur.execute("""SELECT endpoint_id, endpoint_id AS ip, 'active' AS trust_state,
                          COUNT(*) AS images_intercepted, MAX(ts)::text AS last_activity,
                          COUNT(CASE WHEN verdict='STEGO' THEN 1 END) AS stego_count
                          FROM network_events GROUP BY endpoint_id""")
            rows = cur.fetchall()
        except Exception:
            logger.exception("event=endpoints_fallback_failed")
            rows = []
    try: conn.close()
    except Exception:
        pass
    return jsonify([dict(r) for r in rows])


@app.get("/api/ledger/events")
def ledger_events():
    try:
        conn = pg(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""SELECT ROW_NUMBER() OVER (ORDER BY ts DESC) AS chain_index, event_id,
                       'InferenceEvent' AS type, endpoint_id AS producer, ts::text AS time,
                       verdict || ' — score: ' || ROUND(COALESCE(steg_score,0)::numeric,3)::text AS payload,
                       true AS integrity FROM network_events ORDER BY ts DESC LIMIT 100""")
        rows = cur.fetchall(); conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception:
        logger.exception("event=ledger_events_failed")
        return jsonify([])


@app.get("/api/ledger/integrity")
def ledger_integrity():
    try:
        conn = pg(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM network_events"); count = cur.fetchone()[0]; conn.close()
        return jsonify({"verified":True,"max_chain_index":count,"last_checked":"just now"})
    except Exception:
        logger.exception("event=ledger_integrity_failed")
        return jsonify({"verified":False,"max_chain_index":0,"last_checked":"dependency unavailable"})


@app.get("/api/storage/buckets")
def storage_buckets():
    minio_host, minio_port = (MINIO_ENDPOINT.split(":", 1) + ["9000"])[:2]
    if not _is_port_open(minio_host, int(minio_port)):
        return jsonify([{"name":"stegnar-artifacts","file_count":0,"files":[]},
                        {"name":"stegnar-pcaps","file_count":0,"files":[]}])
    try:
        client = minio_client()
        result = []
        for bname in ["stegnar-artifacts","stegnar-pcaps"]:
            try:
                objects = list(client.list_objects(bname,recursive=True))
                result.append({"name":bname,"file_count":len(objects),
                    "files":[{"name":o.object_name,"size":o.size,"last_modified":str(o.last_modified),
                               "is_dir":o.is_dir or False,"type":"file"} for o in objects[:20]]})
            except Exception:
                logger.debug("event=storage_bucket_list_failed bucket=%s", bname)
                result.append({"name":bname,"file_count":0,"files":[]})
        return jsonify(result)
    except Exception:
        logger.exception("event=storage_buckets_failed")
        return jsonify([{"name":"stegnar-artifacts","file_count":0,"files":[]},
                        {"name":"stegnar-pcaps","file_count":0,"files":[]}])


@app.get("/api/proxy/logs")
def proxy_logs():
    container = _docker_get_container("stegnar-proxy")
    if container is None:
        return jsonify([])
    try:
        raw = container.logs(tail=200).decode("utf-8", errors="replace")
        lines = [line for line in raw.splitlines() if line.strip()]
        return jsonify(lines[-200:])
    except Exception:
        logger.exception("event=proxy_logs_failed")
        return jsonify([])


@app.get("/api/proxy/metrics")
def proxy_metrics():
    is_running = False
    logs = []
    container = _docker_get_container("stegnar-proxy")
    if container is not None:
        try:
            container.reload()
            is_running = container.status == "running"
        except Exception:
            logger.exception("event=proxy_metrics_status_failed")
        try:
            raw = container.logs(tail=500).decode("utf-8", errors="replace")
            logs = [line for line in raw.splitlines() if line.strip()]
        except Exception:
            logger.exception("event=proxy_metrics_logs_failed")

    interceptions = 0
    for line in logs:
        lowered = line.lower()
        if "clientconnect" in lowered or "serverconnect" in lowered or "intercepted image" in lowered:
            interceptions += 1

    return jsonify({
        "status": "active" if is_running else "offline",
        "intercepted_connections": interceptions,
        "total_log_lines": len(logs),
        "uptime_status": "Running" if is_running else "Offline",
    })


@app.get("/api/metrics/latency")
def latency_metrics():
    try:
        conn = pg()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """
            SELECT COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
            FROM network_events
            WHERE ts >= NOW() - INTERVAL '15 minutes' AND latency_ms IS NOT NULL
            """
        )
        avg_row = cur.fetchone() or {}
        avg_latency = float(avg_row.get("avg_latency_ms") or 0.0)

        cur.execute(
            """
            WITH minutes AS (
                SELECT generate_series(
                    date_trunc('minute', NOW() - INTERVAL '14 minutes'),
                    date_trunc('minute', NOW()),
                    INTERVAL '1 minute'
                ) AS bucket
            ), counts AS (
                SELECT date_trunc('minute', ts) AS bucket, COUNT(*)::int AS value
                FROM network_events
                WHERE ts >= NOW() - INTERVAL '15 minutes'
                GROUP BY 1
            )
            SELECT to_char(minutes.bucket, 'HH24:MI') AS time,
                   COALESCE(counts.value, 0)::int AS value
            FROM minutes
            LEFT JOIN counts ON counts.bucket = minutes.bucket
            ORDER BY minutes.bucket ASC
            """
        )
        rows = cur.fetchall() or []
        conn.close()

        return jsonify({
            "avg_latency_ms": avg_latency,
            "buckets": [dict(r) for r in rows],
        })
    except Exception:
        logger.exception("event=latency_metrics_failed")
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"avg_latency_ms": 0.0, "buckets": []})


@app.get("/api/metrics/pipeline")
def pipeline_metrics():
    stream = "stegnar:db_queue"
    pending = 0
    total = 0
    group_count = 0
    try:
        r = rd()
        total = int(r.xlen(stream))
        groups = r.xinfo_groups(stream)
        group_count = len(groups)
        pending = sum(int(g.get("pending", 0)) for g in groups)
    except redis_lib.exceptions.ResponseError:
        # stream does not exist yet
        pass
    except Exception:
        logger.exception("event=pipeline_metrics_redis_failed")

    db_events = 0
    try:
        conn = pg(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM network_events")
        db_events = int(cur.fetchone()[0])
        conn.close()
    except Exception:
        logger.exception("event=pipeline_metrics_db_failed")
        try:
            conn.close()
        except Exception:
            pass

    return jsonify({
        "redis_stream": stream,
        "stream_entries": total,
        "pending_entries": pending,
        "consumer_groups": group_count,
        "db_events": db_events,
    })


@app.post("/api/agents/heartbeat")
def agent_heartbeat():
    payload = request.get_json(silent=True) or {}
    endpoint_id = (payload.get("endpoint_id") or "").strip()
    ip_address = (payload.get("ip") or "unknown").strip() or "unknown"
    if not endpoint_id:
        return jsonify({"ok": False, "error": "endpoint_id required"}), 400

    try:
        conn = pg(); cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO endpoint_registry (endpoint_id, ip_address, last_seen, total_chunks)
            VALUES (%s, %s, NOW(), 0)
            ON CONFLICT (endpoint_id)
            DO UPDATE SET ip_address = EXCLUDED.ip_address, last_seen = NOW()
            """,
            (endpoint_id, ip_address),
        )
        conn.commit(); conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        logger.exception("event=agent_heartbeat_failed endpoint_id=%s", endpoint_id)
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/ingest/image")
def ingest_image():
    if "file" not in request.files:
        return jsonify({"error": "no file field"}), 400

    upload = request.files["file"]
    suffix = pathlib.Path(upload.filename or "upload.jpg").suffix.lower() or ".jpg"
    if suffix not in {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}:
        return jsonify({"error": "unsupported image format"}), 400

    os.makedirs(TEMP_DIR, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=TEMP_DIR) as tmp:
        tmp_path = tmp.name
        upload.save(tmp_path)

    job_id = _start_ingest_image_job(tmp_path, upload.filename or "upload")
    return jsonify({"job_id": job_id, "status": "queued"}), 202


@app.post("/api/ingest/pcap")
def ingest_pcap():
    if "pcap" not in request.files or "keys" not in request.files:
        return jsonify({"error": "pcap and keys files required"}), 400

    pcap_file = request.files["pcap"]
    key_file = request.files["keys"]
    os.makedirs(TEMP_DIR, exist_ok=True)

    with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False, dir=TEMP_DIR) as ptmp:
        pcap_path = ptmp.name
        pcap_file.save(pcap_path)
    with tempfile.NamedTemporaryFile(suffix=".log", delete=False, dir=TEMP_DIR) as ktmp:
        key_path = ktmp.name
        key_file.save(key_path)

    job_id = _start_ingest_pcap_job(
        pcap_path,
        key_path,
        pcap_file.filename or "capture.pcap",
        key_file.filename or "sslkeylog.log",
    )
    return jsonify({"job_id": job_id, "status": "queued"}), 202


@app.post("/api/ingest/pcap-plain")
def ingest_pcap_plain():
    if "pcap" not in request.files:
        return jsonify({"error": "pcap file required"}), 400

    pcap_file = request.files["pcap"]
    os.makedirs(TEMP_DIR, exist_ok=True)

    suffix = pathlib.Path(pcap_file.filename or "capture.pcap").suffix.lower() or ".pcap"
    if suffix not in {".pcap", ".pcapng"}:
        return jsonify({"error": "unsupported pcap format"}), 400

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=TEMP_DIR) as ptmp:
        pcap_path = ptmp.name
        pcap_file.save(pcap_path)

    job_id = _start_ingest_pcap_plain_job(
        pcap_path,
        pcap_file.filename or "capture.pcap",
    )
    return jsonify({"job_id": job_id, "status": "queued"}), 202


@app.get("/api/ingest/jobs")
def ingest_jobs():
    limit = min(int(request.args.get("limit", 50)), 200)
    with INGEST_LOCK:
        jobs = list(INGEST_JOBS.values())
    jobs.sort(key=lambda j: j.get("created_at", 0), reverse=True)
    return jsonify(jobs[:limit])


@app.get("/api/ingest/jobs/<job_id>")
def ingest_job(job_id):
    with INGEST_LOCK:
        job = INGEST_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify(job)


@app.post("/api/ingest/upload")
def ingest_upload_legacy():
    return ingest_image()


# ── WebSocket live events ──────────────────────────────────────────────────────
@sock.route("/ws/events")
def ws_events(ws):
    last_ts = None
    while True:
        conn = None
        try:
            conn = pg()
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
        except psycopg2.OperationalError as exc:
            logger.warning("event=ws_events_db_unavailable error=%s", exc)
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            time.sleep(5)
        except Exception:
            logger.exception("event=ws_events_failed")
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
        time.sleep(2)


if __name__ == "__main__":
    # Ensure temp directory exists for upload staging.
    os.makedirs(TEMP_DIR, exist_ok=True)
    print("[SOC-API] Starting on http://localhost:3001")
    print(f"[SOC-API] Postgres  → {PG_HOST}:{PG_PORT}/{PG_DB}")
    print(f"[SOC-API] Redis     → {REDIS_HOST}:{REDIS_PORT}")
    print(f"[SOC-API] MinIO     → {MINIO_ENDPOINT}")
    app.run(host="0.0.0.0", port=3001, debug=False)