"""Small local server behind the dashboard's Refresh DMs button.

X has to be read from your logged-in Brave on this Mac, which the hosted backend can't reach, so the
button calls this instead. It listens on 127.0.0.1 only and accepts requests only from the dashboard.
launchd keeps it running: see scripts/site.praroop.xdmhelper.plist.
"""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8439
ALLOWED_ORIGINS = {
    "https://outreach.praroop.site",
    "https://frontend-praroop-anands-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
}


class Handler(BaseHTTPRequestHandler):
    def _respond(self, status: int, body: dict | None = None):
        self.send_response(status)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())

    def do_OPTIONS(self):
        self._respond(204)

    def do_POST(self):
        if self.path != "/refresh" or self.headers.get("Origin") not in ALLOWED_ORIGINS:
            return self._respond(403, {"ok": False, "error": "Not allowed"})
        try:
            done = subprocess.run([sys.executable, str(ROOT / "scripts" / "x_dm_sync.py")], cwd=ROOT, capture_output=True, text=True, timeout=600)
            last_line = (done.stdout.strip().splitlines() or [""])[-1]
            self._respond(200, json.loads(last_line))
        except subprocess.TimeoutExpired:
            self._respond(200, {"ok": False, "error": "The DM check took too long"})
        except ValueError:
            self._respond(200, {"ok": False, "error": "The DM check failed, see ~/Library/Logs/xdmhelper.log"})

    def log_message(self, format, *args):
        print(format % args, flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
