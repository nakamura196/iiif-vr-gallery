// main.js — エントリポイント。config を読み、各モジュールを初期化し、描画ループを回す。
//
// 元サイト(法隆寺金堂壁画デジタルビューア)の「3D空間を見回し、絵に近づいてクリックで超高精細
// ズーム」体験を IIIF で再構成したビューア。構成は責務ごとに分割:
//   state.js  共有状態      scene.js   描画基盤+画質    room.js   展示室の3D
//   controls.js 操作(見回す/歩く)  viewer.js  深ズーム(OSD)   gallery.js 展示の構築/破棄
//   entrance.js 入口(展示選択)      iiif.js    IIIF 解決
//
// 設定はすべて config.json 駆動。

import { G, $ } from "./state.js";
import { setLang, applyI18n } from "./i18n.js";
import { fetchJson, detectIiifType } from "./iiif.js";
import { setupScene, setupPostprocessing } from "./scene.js";
import { setupControls, setMode, updateWalk, updateThirdPerson, updateFlight, updateHover } from "./controls.js";
import { setupViewerUI } from "./viewer.js";
import { setupXR, bindXRInputSources, updateXR } from "./xr.js";
import { buildGalleryFromSource } from "./gallery.js";
import { setupEntranceUI, buildEntrance, buildEntranceFromCuration, selectExhibition } from "./entrance.js";

init().catch((err) => {
  console.error(err);
  $("#loading").innerHTML = `<div class="err">読み込みに失敗しました:<br>${err.message}</div>`;
});

async function init() {
  G.cfg = await fetch("./config.json").then((r) => r.json());
  // URLクエリで一部設定を上書き(デモ/共有用): ?quality=high|medium|low / ?vc=auto|always|off
  const q0 = new URLSearchParams(location.search);
  if (q0.get("quality")) G.cfg.quality = q0.get("quality");
  if (q0.get("vc")) G.cfg.virtualController = q0.get("vc");
  const lang = q0.get("lang") || G.cfg.lang || navigator.language;
  setLang(lang);
  applyI18n();
  document.title = G.cfg.title || "IIIF Gallery";

  setupScene();
  setupControls();
  setupPostprocessing();
  setupViewerUI();
  setupEntranceUI();
  setupXR();
  bindXRInputSources();

  if (window.__DEBUG) exposeDebug();

  G.renderer.setAnimationLoop(loop); // WebXR は setAnimationLoop 必須

  // 入力ソースの決定(優先順): URLクエリ → config.source(IIIF URL) → config.exhibitions(後方互換) → config直下
  const q = new URLSearchParams(location.search);
  const url = q.get("u") || q.get("curation") || q.get("collection") || q.get("manifest") || G.cfg.source;
  const selParam = parseSelections(q.get("selections"));
  const limit = parseInt(q.get("limit") || "", 10);
  const startMode = q.get("walk") === "1" ? "walk" : q.get("mode") || G.cfg.controlMode;

  if (url) {
    await enterByUrl(url, { selections: selParam, limit: Number.isFinite(limit) ? limit : undefined, startMode });
    return;
  }

  const ex = G.cfg.exhibitions;
  if (Array.isArray(ex) && ex.length > 1) buildEntrance(ex);
  else if (Array.isArray(ex) && ex.length === 1) await selectExhibition(ex[0]);
  else {
    await buildGalleryFromSource(G.cfg, { resetView: true });
    $("#loading").style.display = "none";
    if (startMode === "walk") setMode("walk");
    else if (G.cfg.autoRotate !== false) G.controls.autoRotate = true;
  }
}

// 任意の IIIF URL を判定して入室。複数 selection を持つ Curation は入口(展示選択)を出す。
async function enterByUrl(url, { selections, limit, startMode } = {}) {
  let doc;
  try {
    doc = await fetchJson(url);
  } catch (err) {
    $("#loading").innerHTML = `<div class="err">読み込みに失敗しました:<br>${url}<br>${err.message}</div>`;
    $("#loading").style.display = "flex";
    return;
  }
  const multiSelectionCuration =
    detectIiifType(doc) === "curation" && (doc.selections || []).length > 1 && !selections;
  if (multiSelectionCuration) {
    buildEntranceFromCuration(url, doc, startMode);
    return;
  }
  await buildGalleryFromSource({ auto: url, selections, limit }, { resetView: true });
  $("#loading").style.display = "none";
  if (startMode === "walk") setMode("walk");
  else if (G.cfg.autoRotate !== false) G.controls.autoRotate = true;
}

function parseSelections(s) {
  if (!s) return null;
  const a = s.split(",").map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
  return a.length ? a : null;
}

function loop() {
  const dt = Math.min(G.clock.getDelta(), 0.05);
  if (G.xrPresenting) {
    updateXR(dt);
    if (G.mixer) G.mixer.update(dt);
    G.renderer.render(G.scene, G.camera); // XR 中はポスト処理を使わない
    return;
  }
  updateFlight(dt);
  updateWalk(dt);
  updateThirdPerson(dt);
  if (G.mode === "orbit" || G.mode === "thirdperson") G.controls.update();
  updateHover();
  G.composer.render();
}

// puppeteer 等での検証用フック(window.__DEBUG 時のみ)
function exposeDebug() {
  window.__camera = () => G.camera;
  window.__getMode = () => G.mode;
  window.__walkBounds = () => G.walkBounds;
  window.__getPickables = () => G.pickables;
  window.__avatar = () => G.avatar;
  window.__charLoaded = () => !!G.mixer;
  window.__setCam = (p, t) => {
    G.controls.autoRotate = false;
    G.camera.position.set(p[0], p[1], p[2]);
    G.controls.target.set(t[0], t[1], t[2]);
    G.controls.update();
  };
  window.__openFirst = () => {
    const m = G.pickables[0];
    if (m) import("./viewer.js").then(({ openViewer }) => openViewer(m.userData.wallCfg, m.userData.resolved));
  };
  window.__selectExhibition = (i) => selectExhibition((G.cfg.exhibitions || [])[i]);
}
