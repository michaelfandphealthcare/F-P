"""Small dependency-light web server for the ScamShield prototype."""

from __future__ import annotations

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from .core import explain, load_or_train
except ImportError:  # Supports both `python src/server.py` and package imports.
    from core import explain, load_or_train

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DATA = ROOT / "data" / "sample_messages.csv"
MODEL = ROOT / "artifacts" / "baseline_model.json"
EVIDENCE = ROOT / "data" / "public_evidence.json"
SCENARIOS = ROOT / "data" / "dashboard_scenarios.json"
EVALUATION = ROOT / "data" / "evaluation_results.json"
model = load_or_train(MODEL, DATA)


def dashboard_payload() -> dict:
    """Load dashboard content from versioned data files, not from the UI."""
    with open(EVIDENCE, encoding="utf-8") as f:
        evidence = json.load(f)
    with open(SCENARIOS, encoding="utf-8") as f:
        scenarios = json.load(f)
    with open(EVALUATION, encoding="utf-8") as f:
        evaluation = json.load(f)
    return {"evidence": evidence, "scenarios": scenarios, "evaluation": evaluation}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send(200, "text/html; charset=utf-8", (WEB / "index.html").read_bytes())
        elif path == "/health":
            self._send(200, "application/json", b'{"status":"ok","prototype":"baseline"}')
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
        if urlparse(self.path).path != "/api/analyse":
            self._send(404, "application/json", b'{"error":"Not found"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 20_000:
                raise ValueError("The request is too large for this prototype.")
            payload = json.loads(self.rfile.read(length) or b"{}")
            text = str(payload.get("text", "")).strip()
            if len(text) < 12:
                raise ValueError("Please enter a longer message so the system has enough context to analyse it.")
            if len(text) > 4000:
                raise ValueError("Please keep the message below 4,000 characters for this prototype.")
            probability = model.predict_probability(text)
            result = explain(text, probability, model)
            self._send(200, "application/json", json.dumps(result).encode("utf-8"))
        except ValueError as e:
            self._send(400, "application/json", json.dumps({"error": str(e)}).encode("utf-8"))
        except json.JSONDecodeError:
            self._send(400, "application/json", b'{"error":"Please send a valid JSON request."}')
        except Exception:
            self._send(500, "application/json", b'{"error":"The prototype could not analyse this message."}')


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"ScamShield running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
