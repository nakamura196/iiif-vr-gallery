# IIIF ホスト側の CORS 設定(画像が表示されない時)

IIIF VR Gallery は **別オリジン**(`nakamura196.github.io` / `localhost` など)で動き、
IIIF の JSON と画像を IIIF ホストから取得します。ブラウザのセキュリティ上、これらは
**CORS(`Access-Control-Allow-Origin`)ヘッダが無いと使えません**。

特に **3D の壁テクスチャは WebGL で描画するため CORS が必須**です(CORS の無いクロスオリジン
画像は WebGL にアップロードできず `SecurityError` になる)。OpenSeadragon の深ズームも
`crossOriginPolicy: "Anonymous"` で読むため同様です。

## 症状と原因の切り分け

| 症状 | 原因 |
|---|---|
| 「collection から画像を抽出できませんでした」等のエラー | Manifest 構造(Image Service の有無)。ビューア側で対応済み |
| ロビーは出るが**壁がグレーのまま**/作品が出ない | **画像ファイルに CORS が無い**(本ドキュメントの対象) |
| 一覧(目次)のサムネは出るが 3D 壁や拡大は出ない | 同上(`<img>` は CORS 不要なので目次だけ表示される) |

## 確認コマンド

`Origin` を付けて、レスポンスに `access-control-allow-origin` が返るか見る:

```zsh
curl -sI -H "Origin: https://nakamura196.github.io" "https://<host>/path/to/image.webp" | grep -i access-control-allow-origin
```

- 何も返らなければ CORS 無効 → 下記で有効化する
- `access-control-allow-origin: *`(または該当オリジン)が返れば OK

> 実測メモ(2026-07): `kojima.archiving.jp` は `/app/api/...`(JSON)には `*` を返すが、
> **`/files/medium/` `/files/original/`(画像本体)には CORS が無い**。ここが表示不良の原因。
> 画像を配信するパス(`/files/`)に CORS を付ける必要がある。

## サーバ別の設定

IIIF の **JSON と画像の両方**、特に**実ファイルを配信するパス**に付けること。

### nginx

```nginx
location /files/ {
    add_header Access-Control-Allow-Origin "*" always;
    # 画像のみなら単純リクエストなのでこれで足りる。
    # プリフライトが要るなら OPTIONS を 204 で返す:
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Max-Age 86400 always;
        return 204;
    }
}
```

`add_header` は同一 `location` 内に他の `add_header` があると無効化されるので、
その場合は各ブロックに再掲するか `always` を付ける。

### Apache (.htaccess / vhost、mod_headers 必要)

```apache
<Directory "/var/www/files">
    Header set Access-Control-Allow-Origin "*"
</Directory>
```

### Cloudflare(オリジンを変更できない時)

Transform Rules → **Modify Response Header** で、対象パス(例 `URI Path starts with /files/`)に
`Access-Control-Allow-Origin: *` を追加する。

### 画像配信が S3 / オブジェクトストレージの場合

バケットの CORS 設定に以下を追加(例, S3 JSON):

```json
[{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
```

## 適用後の確認

1. `curl -sI -H "Origin: ..."` で `access-control-allow-origin` が返ることを再確認
2. ブラウザのハードリロード(キャッシュに CORS 無しレスポンスが残るため)
3. 3D の壁に画像が乗り、作品の拡大(OSD)が開けば成功

## オリジンを絞りたい場合

`*` の代わりに配信元を列挙(nginx なら `$http_origin` をマップして echo)する。
公開ビューアなら `*` が運用は楽。画像に Cookie/認証を使っていない限り `*` で問題ない。
