"""
key_store.py — In-memory store for TLS session keys.

Accumulates SSLKEYLOGFILE lines per stream_id so that even if keys
arrive late, they can be used to decrypt the entire session.
"""

import logging
from collections import defaultdict

logger = logging.getLogger("stegnar.routing.keys")


class KeyStore:
    def __init__(self):
        # map stream_id -> set of keylog lines
        self._keys = defaultdict(set)

    def add_keys(self, stream_id: str, keylog_text: str):
        if not keylog_text:
            return
            
        lines = keylog_text.strip().split("\n")
        count = 0
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#"):
                if line not in self._keys[stream_id]:
                    self._keys[stream_id].add(line)
                    count += 1
        
        if count > 0:
            logger.debug("Added %d new keys for stream %s", count, stream_id)

    def get_keys(self, stream_id: str) -> str:
        return "\n".join(self._keys[stream_id])
