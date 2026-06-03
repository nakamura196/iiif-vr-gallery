# IIIF VR Gallery

任意の **IIIF**（Curation / Collection / Manifest）を、3D の仮想美術館として歩いて鑑賞できるビューア。
壁の作品にカーソルを合わせて拡大すると、[OpenSeadragon](https://openseadragon.github.io/) で IIIF サーバのタイルを
そのまま超高精細ズームできます。

法隆寺金堂壁画デジタルビューア（ https://view.horyuji-kondohekiga.jp/ ）の
「3D空間を歩いて作品に近づき、深くズームする」体験を、IIIF で誰のコレクションでも再現できるようにしたものです。

## 特長

- **3つのモード**: 見回す / 一人称で歩く / 三人称で歩く（既定は三人称）
- **入口(ロビー)**: モードと展示を選んで入室。IIIF Curation の各 selection が展示として自動的に並びます
- **URLで指定**: `?u=<IIIF URL>`（Curation / Collection / Manifest を自動判定）
- **暗い美術館の雰囲気**: 連続した壁・作品ごとのスポット照明・天井ダウンライト・実寸大の掛け方
- **スマホ対応**: タッチ端末ではバーチャルコントローラ（オンスクリーン・スティック）を表示
- **多言語**: 日本語 / English（`?lang=en` または `navigator.language`）

## 公開 (GitHub Pages)

このリポジトリの `docs/` を GitHub Pages のソースに設定すると、そのまま公開できます。
（Settings → Pages → Source: `main` / `/docs`）

## ローカルで動かす

```
cd docs
./serve.sh        # http://localhost:8000 (no-cache)
```

## 使い方・設定

詳細は [`docs/README.md`](docs/README.md) を参照。中身の差し替えは `docs/config.json` の `source`
（IIIF の URL）または `?u=` だけ。新しい独自フォーマットは不要で、標準の IIIF をそのまま使います。

## ライセンス / 権利

- ビューア本体のコードは自作。
- サンプルの画像は東京大学総合図書館バーチャルミュージアム（ https://utda.github.io/tenjiroom/ ）の
  IIIF を参照しています。各画像の権利は提供機関に帰属します。
- 着想元の法隆寺ビューアの取得物（解析用）はリポジトリに含めていません（`reference/` は `.gitignore`）。
- 三人称アバター `docs/assets/character.glb` は three.js examples の Soldier モデル（MIT License, © three.js authors）。
- 3D は [three.js](https://threejs.org/)（MIT）、深ズームは [OpenSeadragon](https://openseadragon.github.io/)（New BSD）。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
