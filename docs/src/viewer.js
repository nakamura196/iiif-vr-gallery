// viewer.js — クリックした作品を OpenSeadragon で深ズーム表示するオーバーレイ。
// IIIF info.json をそのまま tileSource にし、切り抜き領域があればそこに寄せて開く。

import { G, $, IDLE_MS, labelHtml } from "./state.js";

export function isOverlayOpen() {
  return $("#osd-overlay").classList.contains("show");
}

export function openViewer(wallCfg, resolved) {
  $("#osd-overlay").classList.add("show");
  $("#osd-title").innerHTML = labelHtml(wallCfg);
  G.pendingRegion = resolved.region || null;

  if (G.osd) {
    G.osd.open(resolved.osdTileSource);
  } else {
    G.osd = OpenSeadragon({
      id: "osd",
      prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/",
      tileSources: resolved.osdTileSource,
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      crossOriginPolicy: "Anonymous",
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
      maxZoomPixelRatio: 2.5,
      animationTime: 0.6,
    });
    // 開くたびに、切り抜き領域があればその範囲へフィット
    G.osd.addHandler("open", () => {
      const R = G.pendingRegion;
      if (R && R.imgW) {
        G.osd.viewport.fitBounds(
          new OpenSeadragon.Rect(R.x / R.imgW, R.y / R.imgW, R.w / R.imgW, R.h / R.imgW),
          true
        );
      }
      if (window.__DEBUG) console.log("OSD open");
    });
    if (window.__DEBUG) {
      window.__osd = G.osd;
      G.osd.addHandler("open-failed", (e) => console.log("OSD open-failed:", e.message));
    }
  }
  // OSD は autoResize で自動的にコンテナ寸法に追従するため、手動 resize は呼ばない。
}

export function closeViewer() {
  $("#osd-overlay").classList.remove("show");
  if (G.mode === "walk") {
    // 歩行モードに復帰。× クリックは操作ジェスチャなので即座に視点ロックを試みる
    // (失敗時=Esc 直後などは unlock ハンドラがプロンプトを出す)。
    $("#walk-prompt").classList.add("show");
    try { G.walkControls.lock(); } catch {}
    return;
  }
  G.controls.enabled = true;
  if (G.idleTimer) clearTimeout(G.idleTimer);
  G.idleTimer = setTimeout(() => {
    if (G.mode === "orbit" && !G.flight && !isOverlayOpen())
      G.controls.autoRotate = G.cfg.autoRotate !== false;
  }, IDLE_MS);
}

export function setupViewerUI() {
  $("#osd-close").addEventListener("click", closeViewer);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOverlayOpen()) closeViewer();
  });
}
