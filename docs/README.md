# IIIF VR Gallery — docs

任意の IIIF を 3D 仮想美術館として鑑賞するビューア（静的サイト。GitHub Pages の `/docs` 配信用）。

- **3D**: [Three.js](https://threejs.org/)（見回す=OrbitControls / 一人称=PointerLock+WASD / 三人称=追従カメラ）
- **深ズーム**: [OpenSeadragon](https://openseadragon.github.io/)（IIIF `info.json` を tileSource に。Curation の `#xywh` 切り抜きにも対応）
- 依存はすべて CDN（three / OpenSeadragon）。ビルド不要。

## 動かす

ES Modules と `fetch` のため `file://` 不可。簡易サーバで配信：

```
./serve.sh        # http://localhost:8000 (no-cache 配信)
./serve.sh 8080
```

## 入力ソース（標準 IIIF のみ。独自フォーマット不要）

優先順: **URLクエリ → `config.json` の `source` → フォールバック**。

### URLクエリ
- `?u=<URL>` … Curation / Collection / Manifest を**自動判定**して配置
- `?u=<curation>&selections=0,2` … Curation の特定 selection だけ
- `?mode=thirdperson|walk|orbit` … 入室モード / `?lang=en|ja` … 言語 / `?limit=N`
- 別名: `?curation=` `?collection=` `?manifest=`

### config.json（`source` に IIIF の URL を入れるだけ）
```jsonc
"source": "./sample/genelib-curation.json"
```
- **Curation で selection が複数** → 入口(ロビー)を自動表示。各 selection が1展示（カードのラベル＝selection名、表紙＝先頭画像の切り抜き）。
- **単一 selection / Manifest / Collection** → そのまま入室。

## 操作

入口で **モード**（三人称／一人称／見回す）と**展示**を選び「入室する」。

- 見回す: ドラッグ＝回転 / ホイール＝前後
- 歩く（一人称）: クリックで視点ロック → WASD・矢印で移動 / Esc 解除（PointerLock 必須のため**デスクトップ向け**）
- 歩く（三人称）: ドラッグで視点 / WASD で移動（スマホ可。既定）
- 拡大: 作品にカーソル → **🔍ボタン**（歩行中は **E** キー）。素のクリックでは拡大しません
- スマホ: 画面左下の**バーチャルスティック**で移動（`config.virtualController`: `auto`/`always`/`off`）
- VR（WebXR 対応ヘッドセット）: 「VRで入室」→ **左スティック=前後左右に連続移動**（頭の向き基準）/ **右スティック=左右に倒すと30°スナップターン**（VR酔い対策の離散回転。倒し続けると素早く連続的に回る）。作品に歩いて近づくと自動で高精細化します（VRでは深ズーム画面の代わり）

## 主な設定（config.json）

- `quality` … `high`/`medium`/`low`（重ければ low。床反射・ブルーム・解像度を調整）
- `controlMode` … 既定モード（`thirdperson` 既定）/ `walkSpeed`
- `room` … 色・照明・`hangCenter`（掛け高さ）・`artMaxHeight/Width`（作品の最大寸法）・`spotlights`/`downlights`/`furniture`
- `bloom` … 発光（重ければ `enabled:false`）
- `polygon.wallWidth` + `gap` … 1辺の幅＝作品の間隔
- `lang` … 既定言語（`ja`/`en`）

## 構成（src/）

```
main.js     エントリ/ループ      state.js   共有状態          i18n.js  多言語
scene.js    描画基盤・画質        room.js    展示室の3D        controls.js 操作(3モード)+スティック
viewer.js   深ズーム(OSD)         gallery.js 展示の構築/破棄    entrance.js 入口
iiif.js     IIIF 解決(Manifest/Collection/Curation, 自動判定, 切り抜き)
```

## CORS の注意

別オリジンの IIIF はブラウザから読むのに `Access-Control-Allow-Origin` が必要です。
Wellcome / Harvard IDS / 東京大学(U-Tokyo) などは `*` で安定。CORS 非対応の提供元はプロキシか自前 IIIF 配信が必要です。
