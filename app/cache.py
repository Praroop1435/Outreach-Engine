import time
from typing import Any, Optional, Dict

class SimpleTTLCache:
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._cache.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._cache[key]
            return None
        return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: int = 30):
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds
        }

    def invalidate(self, prefix: Optional[str] = None):
        if prefix is None:
            self._cache.clear()
        else:
            keys_to_del = [k for k in self._cache if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]

app_cache = SimpleTTLCache()
