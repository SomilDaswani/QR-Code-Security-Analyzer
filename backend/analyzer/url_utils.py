import requests
from urllib.parse import urljoin


def follow_redirects(url: str, max_hops: int = 5, timeout: int = 5) -> dict:
    chain = [url]
    current = url

    print(f"[REDIRECT] Starting follow for: {url}", flush=True)

    for hop in range(max_hops):
        try:
            # Use GET+stream instead of HEAD — some services (e.g. qrco.de) return
            # 200 on HEAD but issue a proper 3xx on GET. stream=True skips the body.
            resp = requests.get(
                current,
                allow_redirects=False,
                timeout=timeout,
                stream=True,
                headers={"User-Agent": "Mozilla/5.0 (QR-Security-Analyzer/1.0)"},
            )
            resp.close()
            status = resp.status_code
            print(f"[REDIRECT] Hop {hop + 1}: {current} -> HTTP {status}", flush=True)

            if status in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location", "").strip()
                if not location:
                    print("[REDIRECT] No Location header — stopping", flush=True)
                    break
                if not location.startswith(("http://", "https://")):
                    location = urljoin(current, location)
                current = location
                chain.append(current)
                print(f"[REDIRECT]   -> {current}", flush=True)
            else:
                print(f"[REDIRECT] Non-redirect status {status} — stopping", flush=True)
                break

        except requests.exceptions.Timeout:
            print(f"[REDIRECT] Timeout at hop {hop + 1}", flush=True)
            break
        except requests.exceptions.ConnectionError as exc:
            print(f"[REDIRECT] Connection error at hop {hop + 1}: {exc}", flush=True)
            break
        except Exception as exc:
            print(f"[REDIRECT] Unexpected error at hop {hop + 1}: {exc}", flush=True)
            break

    had_redirect = len(chain) > 1
    print(
        f"[REDIRECT] Done — final_url={current!r}  hops={len(chain) - 1}  chain={chain}",
        flush=True,
    )
    return {
        "final_url": current,
        "redirect_chain": chain,
        "had_redirect": had_redirect,
        "hop_count": len(chain) - 1,
    }
