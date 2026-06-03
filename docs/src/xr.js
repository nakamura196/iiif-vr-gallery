// xr.js — WebXR(VR)対応。Enter VR ボタン、プレイヤー用ドリー(rig)、コントローラのスティック移動。
// XR 中はポストプロセス(ブルーム等)を使わず renderer.render で直接描画する(EffectComposer は XR 非対応)。

import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { G } from "./state.js";

let dolly = null;
let controllers = [];

export function setupXR() {
  if (G.cfg.xr === false) return;
  G.renderer.xr.enabled = true;

  // プレイヤー rig(これを動かして移動する)。XR 中だけカメラをこの配下に入れる。
  dolly = new THREE.Group();
  dolly.name = "xr-dolly";
  G.xrDolly = dolly;

  controllers = [0, 1].map((i) => {
    const c = G.renderer.xr.getController(i);
    dolly.add(c);
    return c;
  });

  // Enter VR ボタン(WebXR 非対応環境では自動で無効表示)
  const btn = VRButton.createButton(G.renderer);
  btn.id = "vr-button";
  document.body.appendChild(btn);

  G.renderer.xr.addEventListener("sessionstart", onSessionStart);
  G.renderer.xr.addEventListener("sessionend", onSessionEnd);
}

function onSessionStart() {
  // カメラを dolly 配下へ。ヘッドセットが頭の姿勢を、dolly が立ち位置を担う。
  G.scene.add(dolly);
  dolly.add(G.camera);
  const off = Math.min(3, (G.walkBounds || 6) * 0.5);
  dolly.position.set(0, 0, off);
  dolly.rotation.set(0, 0, 0);
  G.xrPresenting = true;
  // 通常操作とアバターは止める
  if (G.controls) G.controls.enabled = false;
  if (G.avatar) G.avatar.visible = false;
}

function onSessionEnd() {
  // カメラをシーン直下に戻し、通常モードに復帰
  G.scene.add(G.camera);
  G.xrPresenting = false;
  if (G.controls) {
    G.controls.enabled = G.mode === "orbit" || G.mode === "thirdperson";
    G.controls.update();
  }
  if (G.avatar) G.avatar.visible = G.mode === "thirdperson";
}

const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
let _turnCooldown = 0;
// XR 中の移動: 左スティックで滑走、右スティックで45°スナップターン
export function updateXR(dt) {
  if (!G.xrPresenting || !dolly) return;
  const speed = (G.cfg.walkSpeed ?? 5.5) * 0.7;
  _turnCooldown = Math.max(0, _turnCooldown - dt);

  for (const c of controllers) {
    const gp = c.userData.inputSource && c.userData.inputSource.gamepad;
    const src = gp || (c.gamepad ?? null);
    const pad = src || (c.userData.gamepad ?? null);
    const axes = pad?.axes;
    if (!axes || axes.length < 4) continue;
    const x = axes[2] || axes[0] || 0;
    const y = axes[3] || axes[1] || 0;
    if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) continue;

    if (Math.abs(y) >= 0.15 || (Math.abs(x) >= 0.15 && Math.abs(x) < 0.7)) {
      // 滑走: 頭の向きを基準に水平移動
      G.camera.getWorldDirection(_dir);
      _dir.y = 0;
      if (_dir.lengthSq() < 1e-6) continue;
      _dir.normalize();
      const right = new THREE.Vector3(_dir.z, 0, -_dir.x);
      dolly.position.addScaledVector(_dir, -y * speed * dt);
      dolly.position.addScaledVector(right, x * speed * dt);
      const r = Math.hypot(dolly.position.x, dolly.position.z);
      if (r > G.walkBounds) { dolly.position.x *= G.walkBounds / r; dolly.position.z *= G.walkBounds / r; }
    } else if (Math.abs(x) >= 0.7 && _turnCooldown === 0) {
      // スナップターン
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), x > 0 ? -Math.PI / 4 : Math.PI / 4);
      dolly.quaternion.multiply(_q);
      _turnCooldown = 0.35;
    }
  }
}

// XR セッション中のコントローラ入力ソースを拾えるよう保持
export function bindXRInputSources() {
  controllers.forEach((c) => {
    c.addEventListener("connected", (e) => (c.userData.inputSource = e.data));
    c.addEventListener("disconnected", () => (c.userData.inputSource = null));
  });
}
