"""
Tiny static file server for the Decision Intelligence dashboard, plus
several custom routes that each serve a live source file from ANY
absolute path on this server -- neither has to be inside this app's
folder at all.

  /source-data.xlsx                 <- source_path.txt                 (demand, Excel)
  /source-data-inventory.xlsx       <- source_path_inventory.txt       (inventory, Excel)
  /source-data-sensing.xlsx         <- source_path_sensing.txt         (sensing, Excel)
  /source-data-recommendations.csv  <- source_path_recommendations.txt (AI recommendations, CSV)
  /source-data-insights.csv         <- source_path_insights.txt         (AI forecast/sensing insights, CSV)
  /source-data-kpi.csv              <- source_path_kpi.txt              (KPI tile values, CSV)
  /source-data-summary.csv          <- source_path_summary.txt          (per-screen AI summaries, CSV)

Each path is read from its config file on every request, so you can
change where any of them points without restarting this server -- just
edit the .txt file and click Refresh in the browser again.

Everything else (index.html, live_data.js, etc.) is served normally
from this folder, exactly like `python -m http.server` did before.

Run:   python server.py
Stop:  close this window / Ctrl+C
Bound to 127.0.0.1 only -- reachable only from a browser on this same
server, not from other PCs on the network.

  POST /api/chat            -- AI assistant. See chat_backend.py.
  POST /api/redeploy-agent  -- redeploy-matching agent. See chat_backend.py.
"""
import http.server
import json
from pathlib import Path
import chat_backend

PORT = 8000
BIND = '127.0.0.1'
APP_DIR = Path(__file__).parent

ROUTES = {
    '/source-data.xlsx':                APP_DIR / 'source_path.txt',
    '/source-data-inventory.xlsx':      APP_DIR / 'source_path_inventory.txt',
    '/source-data-sensing.xlsx':        APP_DIR / 'source_path_sensing.txt',
    '/source-data-recommendations.csv': APP_DIR / 'source_path_recommendations.txt',
    '/source-data-insights.csv':        APP_DIR / 'source_path_insights.txt',
    '/source-data-kpi.csv':             APP_DIR / 'source_path_kpi.txt',
    '/source-data-summary.csv':         APP_DIR / 'source_path_summary.txt',
}
# Content-Type per route -- everything defaults to the Excel mimetype except
# the recommendations route, which is a real CSV. Harmless either way since
# the frontend parses raw bytes itself rather than trusting this header, but
# worth being accurate.
ROUTE_CONTENT_TYPE = {
    '/source-data-recommendations.csv': 'text/csv',
    '/source-data-insights.csv': 'text/csv',
    '/source-data-kpi.csv': 'text/csv',
    '/source-data-summary.csv': 'text/csv',
}
DEFAULT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self):
        route = self.path.split('?')[0]
        if route in ROUTES:
            self.serve_configured_file(ROUTES[route], ROUTE_CONTENT_TYPE.get(route, DEFAULT_CONTENT_TYPE))
        else:
            super().do_GET()

    def do_POST(self):
        route = self.path.split('?')[0]
        if route == '/api/chat':
            self.handle_chat()
        elif route == '/api/redeploy-agent':
            self.handle_redeploy_agent()
        else:
            self.send_plain_error(404, 'Not found')

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > 20_000_000:
            return None
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def handle_chat(self):
        try:
            body = self._read_json_body()
            if body is None:
                self.send_json_error(400, 'Missing or oversized request body')
                return
            message = (body.get('message') or '').strip()
            if not message:
                self.send_json_error(400, "Missing 'message'")
                return
            history = body.get('history') or []
            data = body.get('data') or {}
            answer = chat_backend.handle_chat(message, history, data)
            self.send_json(200, {'answer': answer})
        except chat_backend.ChatError as e:
            self.send_json_error(502, str(e))
        except json.JSONDecodeError:
            self.send_json_error(400, 'Invalid JSON body')
        except Exception as e:
            self.send_json_error(500, f'Unexpected error: {e}')

    def handle_redeploy_agent(self):
        try:
            body = self._read_json_body()
            if body is None:
                self.send_json_error(400, 'Missing or oversized request body')
                return
            data = body.get('data') or {}
            answer = chat_backend.handle_redeploy_agent(data)
            self.send_json(200, {'answer': answer})
        except chat_backend.ChatError as e:
            self.send_json_error(502, str(e))
        except json.JSONDecodeError:
            self.send_json_error(400, 'Invalid JSON body')
        except Exception as e:
            self.send_json_error(500, f'Unexpected error: {e}')

    def send_json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, code, message):
        self.send_json(code, {'error': message})

    def serve_configured_file(self, config_file, content_type=DEFAULT_CONTENT_TYPE):
        if not config_file.is_file():
            self.send_plain_error(500, f'Config file not found: {config_file}. Create it with the full path to your source file on the first line.')
            return
        raw_path = config_file.read_text(encoding='utf-8').strip()
        # Windows "Copy as path" wraps the path in double quotes -- strip
        # them so pasting that straight into the config file just works.
        if len(raw_path) >= 2 and raw_path[0] == '"' and raw_path[-1] == '"':
            raw_path = raw_path[1:-1]
        if not raw_path:
            self.send_plain_error(500, f'{config_file.name} is empty -- put the full path to the source file in it.')
            return
        source_path = Path(raw_path)
        if not source_path.is_file():
            self.send_plain_error(404, f'File not found at configured path: {source_path}')
            return
        try:
            data = source_path.read_bytes()
        except PermissionError:
            self.send_plain_error(423, f'File is locked/in use, could not read: {source_path}')
            return
        except OSError as e:
            self.send_plain_error(500, f'Could not read file: {e}')
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def send_plain_error(self, code, message):
        body = message.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer((BIND, PORT), Handler) as httpd:
        print(f'Serving {APP_DIR} at http://{BIND}:{PORT}/')
        for route, cfg in ROUTES.items():
            configured = cfg.read_text(encoding='utf-8').strip() if cfg.is_file() else f'({cfg.name} not found yet)'
            print(f'  {route}  <-  {configured}')
        httpd.serve_forever()
