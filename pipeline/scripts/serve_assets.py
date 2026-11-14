"""Local stand-in for the assets host: serve DATA_DIR over HTTP with CORS.

Until the server's assets.<domain> is up (task N2), the web app can load real assets from here:
  python pipeline/scripts/serve_assets.py            # http://localhost:8001/
  VITE_ASSETS_URL=http://localhost:8001/ npm run dev  # in web/
Files are served from DATA_DIR (default ~/ariadne-data/assets), e.g. /bright-angel/ortho_1m.jpg.
"""

from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from aoi import DATA_DIR


class CorsHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".f32": "application/octet-stream",
                      ".geojson": "application/geo+json"}

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8001)
    ap.add_argument("--bind", default="127.0.0.1")
    args = ap.parse_args()
    handler = functools.partial(CorsHandler, directory=str(DATA_DIR))
    print(f"serving {DATA_DIR} on http://{args.bind}:{args.port}/")
    ThreadingHTTPServer((args.bind, args.port), handler).serve_forever()


if __name__ == "__main__":
    main()
