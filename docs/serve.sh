#!/usr/bin/env zsh
# ローカルプレビュー用の簡易サーバ(no-cache)。
# ES module と fetch(config.json) は file:// では動かないので http で配信する。
# モジュールを編集してもブラウザが古いキャッシュを読まないよう、Cache-Control: no-store を付与する。
#   使い方:  ./serve.sh        (既定 http://localhost:8000)
#            ./serve.sh 8080   (ポート指定)
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "→ http://localhost:${PORT}/  (Ctrl+C で停止 / no-cache 配信)"
python3 - "$PORT" <<'PY'
import sys, http.server, socketserver
PORT = int(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()
class S(socketserver.TCPServer):
    allow_reuse_address = True
with S(("", PORT), H) as httpd:
    httpd.serve_forever()
PY
