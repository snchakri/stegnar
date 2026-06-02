"""
key_store.py — In-memory store for TLS session keys.

Keys from SSLKEYLOGFILE are accumulated globally per endpoint_id.
When Tshark decrypts a stream, ALL known keys for that endpoint are
provided, covering any session regardless of stream_id timing.
"""

import logging
from collections import defaultdict

logger = logging.getLogger("stegnar.routing.keys")


class KeyStore:
    def __init__(self):
        # endpoint_id -> set of keylog lines
        self._endpoint_keys = defaultdict(set)

    def add_keys(self, endpoint_id: str, keylog_text: str):
        if not keylog_text or not endpoint_id:
            return
        lines = keylog_text.strip().split("\n")
        count = 0
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#"):
                if line not in self._endpoint_keys[endpoint_id]:
                    self._endpoint_keys[endpoint_id].add(line)
                    count += 1
        if count > 0:
            logger.debug("Added %d new TLS keys for endpoint %s", count, endpoint_id)

    def get_keys(self, endpoint_id: str) -> str:
        """Return all known keys for the given endpoint as a keylog string."""
        return "\n".join(self._endpoint_keys[endpoint_id])
