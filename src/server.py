"""Small dependency-light web server for the ScamShield prototype."""

from __future__ import annotations

import ipaddress
import json
import mimetypes
import os
import socket
import ssl
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse

import certifi

try:
    from .core import MODEL_VERSION, explain, load_or_train
except ImportError:  # Supports both `python src/server.py` and package imports.
    from core import MODEL_VERSION, explain, load_or_train

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
BUILD_ID = os.environ.get("SCAMSHIELD_BUILD_ID") or os.environ.get("RENDER_GIT_COMMIT", "local-contextual-v5")
DATA = ROOT / "data" / "sample_messages.csv"
MODEL = ROOT / "artifacts" / "baseline_model.json"
EVIDENCE = ROOT / "data" / "public_evidence.json"
SCENARIOS = ROOT / "data" / "dashboard_scenarios.json"
EVALUATION = ROOT / "data" / "evaluation_results.json"
CHALLENGE_EVALUATION = ROOT / "data" / "challenge_evaluation.json"
model = load_or_train(MODEL, DATA)


class PublicUrlError(ValueError):
    """A readable validation failure for the public-web checker."""


class _NoAutomaticRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802 - stdlib API
        return None


def _normalise_public_url(raw: str) -> tuple[str, str, list[str]]:
    """Return a safe public URL, host and resolved addresses.

    The checker deliberately refuses local, private and reserved destinations.
    This prevents it becoming a proxy into the hosting provider's internal
    network while still allowing a user to verify a normal public website.
    """
    candidate = str(raw or "").strip()
    if not candidate:
        raise PublicUrlError("Paste a public web address to check.")
    if len(candidate) > 2048:
        raise PublicUrlError("The web address is too long to check safely.")
    if not candidate.lower().startswith(("http://", "https://")):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise PublicUrlError("Only normal HTTP or HTTPS web addresses can be checked.")
    if parsed.username or parsed.password:
        raise PublicUrlError("Web addresses containing embedded sign-in details are not checked.")
    if not parsed.hostname:
        raise PublicUrlError("The address does not contain a valid public hostname.")
    if parsed.port not in {None, 80, 443}:
        raise PublicUrlError("Only standard web ports (80 and 443) can be checked.")

    host = parsed.hostname.rstrip(".").lower()
    blocked_suffixes = (".local", ".internal", ".home", ".lan", ".localhost", ".test", ".invalid", ".example")
    if host == "localhost" or host.endswith(blocked_suffixes):
        raise PublicUrlError("Local, test and internal addresses cannot be checked.")
    try:
        literal = ipaddress.ip_address(host)
        addresses = [str(literal)]
    except ValueError:
        try:
            answers = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise PublicUrlError("The hostname could not be found on the public internet.") from error
        addresses = sorted({answer[4][0] for answer in answers})
    if not addresses:
        raise PublicUrlError("The hostname did not resolve to a public internet address.")
    if any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise PublicUrlError("Private, local and reserved network addresses cannot be checked.")

    clean = parsed._replace(fragment="")
    return urlunparse(clean), host, addresses


def inspect_public_url(raw: str) -> dict:
    """Inspect public reachability and response metadata without reading a page body.

    This is an internet-backed technical check, not a reputation verdict. Each
    redirect is revalidated to keep private-network destinations out of scope.
    """
    current, requested_host, addresses = _normalise_public_url(raw)
    redirects: list[dict[str, str | int]] = []
    tls_context = ssl.create_default_context(cafile=certifi.where())
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=tls_context), _NoAutomaticRedirect)
    response = None
    status = 0
    method = "HEAD"
    for _ in range(4):
        request = urllib.request.Request(
            current,
            method=method,
            headers={"User-Agent": "ScamShield-Research/1.0 (+public URL metadata check)", "Accept": "text/html,*/*;q=0.1"},
        )
        try:
            response = opener.open(request, timeout=6)
            status = int(response.getcode() or 0)
        except urllib.error.HTTPError as error:
            response = error
            status = int(error.code)
        except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
            raise PublicUrlError("The public site did not respond in time. Check the address or try again later.") from error

        if status == 405 and method == "HEAD":
            method = "GET"
            continue
        if status in {301, 302, 303, 307, 308}:
            location = response.headers.get("Location")
            if not location:
                break
            next_url, next_host, _ = _normalise_public_url(urljoin(current, location))
            redirects.append({"status": status, "host": next_host})
            current = next_url
            method = "HEAD"
            continue
        break
    else:
        raise PublicUrlError("The site redirected too many times to check safely.")

    final = urlparse(current)
    content_type = (response.headers.get("Content-Type") or "Not supplied").split(";", 1)[0]
    if method == "GET":
        try:
            response.read(1)
        except Exception:
            pass
    response.close()
    return {
        "status": status,
        "reachable": 100 <= status < 600,
        "requested_host": requested_host,
        "final_host": final.hostname or requested_host,
        "https": final.scheme == "https",
        "redirects": redirects,
        "content_type": content_type,
        "resolved_addresses": len(addresses),
        "checked_live": True,
        "meaning": "Live public-web reachability and response metadata only; this is not a malware scan, reputation score or proof that the site is safe.",
    }


def dashboard_payload() -> dict:
    """Load dashboard content from versioned data files, not from the UI."""
    with open(EVIDENCE, encoding="utf-8") as f:
        evidence = json.load(f)
    with open(SCENARIOS, encoding="utf-8") as f:
        scenarios = json.load(f)
    with open(EVALUATION, encoding="utf-8") as f:
        evaluation = json.load(f)
    with open(CHALLENGE_EVALUATION, encoding="utf-8") as f:
        challenge_evaluation = json.load(f)
    return {"evidence": evidence, "scenarios": scenarios, "evaluation": evaluation, "challenge_evaluation": challenge_evaluation}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-ScamShield-Build", BUILD_ID)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send(200, "text/html; charset=utf-8", (WEB / "index.html").read_bytes())
        elif path == "/health":
            self._send(200, "application/json", json.dumps({"status": "ok", "prototype": "baseline", "build_id": BUILD_ID}).encode("utf-8"))
        elif path == "/api/meta":
            self._send(200, "application/json", json.dumps({"build_id": BUILD_ID, "model_version": MODEL_VERSION, "ocr": "browser-local-tesseract"}).encode("utf-8"))
        elif path == "/api/dashboard":
            self._send(200, "application/json", json.dumps(dashboard_payload()).encode("utf-8"))
        elif path.startswith("/static/"):
            file = WEB / "static" / path.removeprefix("/static/")
            if file.exists() and file.is_file():
                guessed = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
                content_type = f"{guessed}; charset=utf-8" if guessed.startswith(("text/", "application/javascript")) else guessed
                self._send(200, content_type, file.read_bytes())
            else:
                self._send(404, "text/plain", b"Not found")
        elif path.startswith("/data/"):
            file = ROOT / "data" / path.removeprefix("/data/")
            if file.exists() and file.is_file() and file.suffix == ".json":
                self._send(200, "application/json; charset=utf-8", file.read_bytes())
            else:
                self._send(404, "text/plain", b"Not found")
        else:
            self._send(404, "text/plain", b"Not found")

    def do_HEAD(self) -> None:
        """Support platform health checks without returning a misleading 501."""
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            file = WEB / "index.html"
        elif path.startswith("/static/"):
            file = WEB / "static" / path.removeprefix("/static/")
        else:
            file = None
        if file and file.exists() and file.is_file():
            guessed = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", guessed)
            self.send_header("Content-Length", str(file.stat().st_size))
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in {"/api/analyse", "/api/link-inspect"}:
            self._send(404, "application/json", b'{"error":"Not found"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 20_000:
                raise ValueError("The request is too large for this prototype.")
            payload = json.loads(self.rfile.read(length) or b"{}")
            if path == "/api/link-inspect":
                result = inspect_public_url(str(payload.get("url", "")))
                self._send(200, "application/json", json.dumps(result).encode("utf-8"))
                return
            text = str(payload.get("text", "")).strip()
            if len(text) < 12:
                raise ValueError("Please enter a longer message so the system has enough context to analyse it.")
            if len(text) > 4000:
                raise ValueError("Please keep the message below 4,000 characters for this prototype.")
            probability = model.predict_probability(text)
            result = explain(text, probability, model)
            self._send(200, "application/json", json.dumps(result).encode("utf-8"))
        except json.JSONDecodeError:
            self._send(400, "application/json", b'{"error":"Please send a valid JSON request."}')
        except PublicUrlError as e:
            self._send(400, "application/json", json.dumps({"error": str(e)}).encode("utf-8"))
        except ValueError as e:
            self._send(400, "application/json", json.dumps({"error": str(e)}).encode("utf-8"))
        except Exception:
            self._send(500, "application/json", b'{"error":"The prototype could not analyse this message."}')


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"ScamShield running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
