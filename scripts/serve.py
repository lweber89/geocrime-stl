#!/usr/bin/env python3
"""Serve the dashboard locally: dashboard/ at "/", and the data feed (data/web) at "/data/".

    python scripts/serve.py [port]

Open http://localhost:8000. A plain file:// URL will not work, because browsers block fetch().
Uses only the standard library, so it runs without installing the package.
"""
from __future__ import annotations

import functools
import http.server
import os
import posixpath
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "dashboard"
DATA = Path(os.environ.get("GEOCRIME_DATA_DIR") or ROOT / "data")
WEB = (DATA / "web").resolve()


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        url_path = unquote(urlsplit(path).path)
        if url_path.startswith("/data/"):
            rel = posixpath.normpath(url_path[len("/data/"):]).lstrip("/")
            target = (WEB / rel).resolve()
            if target == WEB or WEB in target.parents:
                return str(target)
            return str(WEB / "__not_found__")  # path escaped the feed folder -> 404
        return super().translate_path(path)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")  # always show the latest files while developing
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    if not (WEB / "manifest.json").exists():
        print(f"Note: {WEB / 'manifest.json'} not found yet. Build the feed first:\n"
              "      python -m geocrime_stl.utils.web_export")
    handler = functools.partial(Handler, directory=str(DASHBOARD))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Serving http://localhost:{port}  (Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print()


if __name__ == "__main__":
    main()
