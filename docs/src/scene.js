// scene.js — レンダラ・シーン・カメラ・環境光・ポストプロセス(ブルーム)の初期化と画質プリセット。

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { G, $ } from "./state.js";

// quality: high/medium/low に応じて、重い処理(床反射・ブルーム・解像度・天井灯)を段階調整。
// 個別の room.* / bloom.enabled で false にすればプリセットより優先して無効化できる。
export function qualityPreset() {
  const presets = {
    high: { dpr: 2, reflector: 1024, bloom: true, downlights: true },
    medium: { dpr: 1.5, reflector: 640, bloom: true, downlights: true },
    low: { dpr: 1, reflector: 0, bloom: false, downlights: false },
  };
  const p = { ...(presets[G.cfg.quality] || presets.medium) };
  if (G.cfg.maxPixelRatio) p.dpr = G.cfg.maxPixelRatio;
  return p;
}

export function setupScene() {
  const room = G.cfg.room || {};
  const bg = new THREE.Color(room.bgColor || "#0a0b0d");
  G.scene = new THREE.Scene();
  G.scene.background = bg;
  const fog = room.fog ?? 0.022;
  if (fog > 0) G.scene.fog = new THREE.FogExp2(bg.getHex(), fog);

  const cam = G.cfg.camera || {};
  G.camera = new THREE.PerspectiveCamera(cam.fov || 58, window.innerWidth / window.innerHeight, 0.05, 1000);
  const s = cam.start || [0, 1.6, 0.2];
  G.camera.position.set(s[0], s[1], s[2]);

  G.QP = qualityPreset();
  G.renderer = new THREE.WebGLRenderer({ antialias: true });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, G.QP.dpr));
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = room.exposure ?? 1.1;
  $("#scene").appendChild(G.renderer.domElement);

  // 暗い室内: ごく弱い環境光のみ。明かりは作品/天井のスポットで作る。
  G.scene.add(new THREE.AmbientLight(0xffffff, room.ambient ?? 0.08));
  G.scene.add(new THREE.HemisphereLight(0x556070, 0x101015, room.hemi ?? 0.12));

  G.raycaster = new THREE.Raycaster();
  G.galleryRoot = new THREE.Group();
  G.scene.add(G.galleryRoot);

  window.addEventListener("resize", onResize);
}

export function setupPostprocessing() {
  const b = G.cfg.bloom || {};
  G.composer = new EffectComposer(G.renderer);
  G.composer.addPass(new RenderPass(G.scene, G.camera));
  if (b.enabled !== false && G.QP.bloom) {
    G.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        b.strength ?? 0.5,
        b.radius ?? 0.5,
        b.threshold ?? 0.85
      )
    );
  }
  G.composer.addPass(new OutputPass()); // トーンマッピング + sRGB 出力
}

function onResize() {
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.composer.setSize(window.innerWidth, window.innerHeight);
}
