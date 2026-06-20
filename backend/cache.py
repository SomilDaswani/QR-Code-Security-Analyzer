import time

_store: dict = {}  # url_hash -> (result, expires_at)
TTL_SECONDS = 3600


def get_cached(url_hash: str) -> dict | None:
    entry = _store.get(url_hash)
    if entry is None:
        return None
    result, expires_at = entry
    if time.time() > expires_at:
        del _store[url_hash]
        return None
    return result


def set_cached(url_hash: str, result: dict) -> None:
    _store[url_hash] = (result, time.time() + TTL_SECONDS)


def cache_size() -> int:
    return len(_store)
