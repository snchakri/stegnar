import mitmproxy.http
import hashlib
import time
import asyncio
import grpc.experimental.aio as aio
import os
import sys

sys.path.insert(0, "/app/proto")
import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

ROUTER_ADDR = os.environ.get("ROUTER_GRPC_ADDR", "routing:50051")

class StegnarAddon:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.task = None

    def running(self):
        self.task = asyncio.create_task(self.stream_worker())

    async def stream_worker(self):
        while True:
            try:
                print(f"[StegnarAddon] Connecting to router at {ROUTER_ADDR}")
                async with aio.insecure_channel(ROUTER_ADDR) as channel:
                    stub = pb_grpc.RouterServiceStub(channel)
                    
                    async def _chunk_generator():
                        while True:
                            chunk = await self.queue.get()
                            yield chunk
                    
                    await stub.StreamPayload(_chunk_generator())
            except Exception as e:
                print(f"[StegnarAddon] gRPC stream error: {e}")
                await asyncio.sleep(5)

    def request(self, flow: mitmproxy.http.HTTPFlow):
        if flow.request and flow.request.content:
            content_type = flow.request.headers.get("Content-Type", "")
            if "image/" in content_type.lower() or _sniff_image(flow.request.content):
                self._process_image(flow, flow.request.content)

    def response(self, flow: mitmproxy.http.HTTPFlow):
        if flow.response and flow.response.content:
            content_type = flow.response.headers.get("Content-Type", "")
            if "image/" in content_type.lower() or _sniff_image(flow.response.content):
                self._process_image(flow, flow.response.content)

    def _process_image(self, flow, img_bytes):
        if len(img_bytes) > 1000:
            sha = hashlib.sha256(img_bytes).hexdigest()
            
            # Create payload chunk
            client_ip = flow.client_conn.peername[0] if flow.client_conn and flow.client_conn.peername else "0.0.0.0"
            client_port = flow.client_conn.peername[1] if flow.client_conn and flow.client_conn.peername else 0
            server_ip = flow.server_conn.peername[0] if flow.server_conn and flow.server_conn.peername else "0.0.0.0"
            server_port = flow.server_conn.peername[1] if flow.server_conn and flow.server_conn.peername else 443
            
            stream_id = f"{client_ip}:{client_port}-{server_ip}:{server_port}"
            
            chunk = pb.PayloadChunk(
                endpoint_id=f"proxy-{client_ip}",
                stream_id=stream_id,
                raw_bytes=img_bytes,
                sha256=sha,
                ssl_keylog="", # Not needed, payload is plaintext!
                src_ip=client_ip,
                dst_ip=server_ip,
                src_port=client_port,
                dst_port=server_port,
                captured_at=int(time.time() * 1000),
            )
            
            self.queue.put_nowait(chunk)
            print(f"[StegnarAddon] Intercepted image, sending to router...")

def _sniff_image(raw_bytes: bytes) -> bool:
    _IMAGE_MAGIC = {
        b'\xff\xd8\xff':   "jpeg",
        b'\x89PNG\r\n':    "png",
        b'RIFF':           "webp",
        b'BM':             "bmp",
        b'GIF87a':         "gif",
        b'GIF89a':         "gif",
    }
    for magic in _IMAGE_MAGIC:
        if raw_bytes[:len(magic)] == magic:
            return True
    return False

addons = [
    StegnarAddon()
]
