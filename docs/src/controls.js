// controls.js — 操作系。見回す(OrbitControls)/一人称で歩く(PointerLock+WASD)の2モード、
// ホバー判定、クリック時の挙動(前進アニメ or 視点ロック)、毎フレーム更新を担う。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { G, $, IDLE_MS, easeInOutCubic, labelHtml } from "./state.js";
import { openViewer, isOverlayOpen } from "./viewer.js";
import { t } from "./i18n.js";

const CENTER = new THREE.Vector2(0, 0);

export function setupControls() {
  const cam = G.cfg.camera || {};
  G.eyeY = G.cfg.polygon?.eyeHeight ?? 1.6;

  G.controls = new OrbitControls(G.camera, G.renderer.domElement);
  G.controls.enableDamping = true;
  G.controls.dampingFactor = 0.08;
  G.controls.minDistance = cam.minDistance ?? 0.5;
  G.controls.maxDistance = cam.maxDistance ?? 40;
  G.controls.maxPolarAngle = Math.PI * 0.92;
  G.controls.autoRotateSpeed = G.cfg.autoRotateSpeed ?? 0.6;
  G.controls.target.set(0, G.eyeY, 0);
  G.controls.update();
  G.controls.addEventListener("start", () => {
    G.controls.autoRotate = false;
    if (G.idleTimer) clearTimeout(G.idleTimer);
  });
  G.controls.addEventListener("end", () => {
    if (G.idleTimer) clearTimeout(G.idleTimer);
    G.idleTimer = setTimeout(() => {
      if (G.mode === "orbit" && !G.flight && !isOverlayOpen())
        G.controls.autoRotate = G.cfg.autoRotate !== false;
    }, IDLE_MS);
  });

  // 三人称用のアバター(常設・既定は非表示)。リグなしの簡易フィギュア。
  G.avatar = makeAvatar();
  G.avatar.visible = false;
  G.scene.add(G.avatar);
  G.baseMinDistance = G.controls.minDistance;

  G.walkControls = new PointerLockControls(G.camera, G.renderer.domElement);
  G.walkControls.addEventListener("lock", () => {
    $("#walk-prompt").classList.remove("show");
    $("#crosshair").classList.add("show");
  });
  G.walkControls.addEventListener("unlock", () => {
    $("#crosshair").classList.remove("show");
    if (G.mode === "walk" && !isOverlayOpen()) $("#walk-prompt").classList.add("show");
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  G.renderer.domElement.addEventListener("pointermove", onPointerMove);
  G.renderer.domElement.addEventListener("click", onClick);
  $("#mode-toggle").addEventListener("click", () => setMode(G.mode === "orbit" ? "walk" : "orbit"));
  $("#walk-prompt").addEventListener("click", () => {
    if (G.mode === "walk") G.walkControls.lock();
  });
  // 拡大は明示操作のみ: 見回しは🔍ボタン、歩行は E キー(誤クリックで開かない)
  $("#hud-zoom").addEventListener("click", (e) => {
    e.stopPropagation();
    zoomFocused();
  });
  setupJoystick();
}

// --- バーチャルコントローラ(スマホ用) ---
function joystickEnabled() {
  const v = G.cfg.virtualController || "auto";
  if (v === "off") return false;
  if (v === "always") return true;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0; // auto: タッチ端末のみ
}

function setupJoystick() {
  if (!joystickEnabled()) return;
  const base = $("#joystick");
  const knob = $("#joystick-knob");
  const R = 46;
  let active = false, id = null;
  const reset = () => {
    active = false;
    knob.style.transform = "translate(-50%, -50%)";
    G.move.f = G.move.b = G.move.l = G.move.r = false;
  };
  const apply = (e) => {
    const r = base.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    knob.style.transform = `translate(calc(-50% + ${(dx / len) * cl}px), calc(-50% + ${(dy / len) * cl}px))`;
    const nx = dx / R, ny = dy / R; // ny: 下が正
    G.move.f = ny < -0.35;
    G.move.b = ny > 0.35;
    G.move.l = nx < -0.35;
    G.move.r = nx > 0.35;
  };
  base.addEventListener("pointerdown", (e) => { active = true; id = e.pointerId; base.setPointerCapture(id); apply(e); });
  base.addEventListener("pointermove", (e) => { if (active && e.pointerId === id) apply(e); });
  base.addEventListener("pointerup", (e) => { if (e.pointerId === id) reset(); });
  base.addEventListener("pointercancel", () => reset());
}

function showJoystick(on) {
  const el = $("#joystick");
  if (!el) return;
  el.classList.toggle("show", on && joystickEnabled());
}

// 選択中の作品を拡大表示する(見回しは近づいてから、歩行はその場で開く)
function zoomFocused() {
  const art = G.focused;
  if (!art) return;
  if (G.mode === "orbit") {
    if (!G.flight) startFlight(art); // 見回しモードだけ近づいてから開く
  } else {
    // 一人称/三人称: その場で開く(カメラを動かさない=戻った時にずれない)
    if (G.mode === "walk") G.walkControls.unlock();
    openViewer(art.userData.wallCfg, art.userData.resolved);
  }
}

export function setMode(next) {
  if (next === G.mode) return;
  // 退出処理(共通)
  G.walkControls.unlock();
  G.avatar.visible = false;
  $("#walk-prompt").classList.remove("show");
  $("#crosshair").classList.remove("show");
  if (G.idleTimer) clearTimeout(G.idleTimer);

  G.mode = next;
  G.hovered = null;
  clearFocus();

  if (G.mode === "walk") {
    G.controls.autoRotate = false;
    G.controls.enabled = false;
    G.camera.position.set(0, G.eyeY, 0.1);
    $("#mode-toggle").textContent = t("toLook");
    $("#walk-prompt").classList.add("show");
    document.body.style.cursor = "";
  } else if (G.mode === "thirdperson") {
    // 追従カメラ + アバター。OrbitControls で見回し、WASD でアバターを移動。
    G.controls.autoRotate = false;
    G.controls.enabled = true;
    G.controls.minDistance = 1.5;
    // 中央の台座と重ならないよう、壁寄りにスポーン
    const off = Math.min(3, (G.walkBounds || 6) * 0.4);
    G.avatar.position.set(0, 0, off);
    G.avatar.rotation.y = Math.PI; // 中心(=作品)側を向く
    G.avatar.visible = true;
    G.controls.target.set(0, 1.1, off);
    G.camera.position.set(0, 2.2, off + 6.5);
    G.controls.update();
    $("#mode-toggle").textContent = t("toLook");
  } else {
    G.controls.enabled = true;
    G.controls.minDistance = G.baseMinDistance;
    G.controls.target.set(0, G.eyeY, 0);
    G.controls.update();
    $("#mode-toggle").textContent = t("toWalk");
  }
  showJoystick(G.mode === "walk" || G.mode === "thirdperson");
}

// 三人称アバター。まず簡易フィギュアを置き、リグ付き glTF を読み込めたら差し替える。
function makeAvatar() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fb3c8, roughness: 0.6, emissive: 0x223040, emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 12), mat);
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat);
  head.position.y = 1.45;
  const placeholder = new THREE.Group();
  placeholder.add(body, head);
  g.add(placeholder);
  // アバターを常に視認できる追従フィル光(1灯のみ・コスト一定)
  const fill = new THREE.PointLight(0xfff2e0, 3.5, 8, 2);
  fill.position.set(0, 2.4, 1.4);
  g.add(fill);
  loadCharacter(g, placeholder);
  return g;
}

function loadCharacter(group, placeholder) {
  const url = G.cfg.characterModel || "./assets/character.glb";
  new GLTFLoader().load(
    url,
    (gltf) => {
      const model = gltf.scene;
      // スキンメッシュの bbox は当てにならないので、固定スケールで配置(Soldier等は原点が足元・実寸大)。
      model.scale.setScalar(G.cfg.characterScale ?? 1);
      // PBR(金属)マテリアルは環境マップ無しだと真っ黒になるので、マットにしてフィル光で見えるように
      model.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          m.metalness = 0;
          if (m.roughness !== undefined) m.roughness = Math.max(0.7, m.roughness);
          m.envMapIntensity = 0;
          // 暗い展示室でも沈まないよう、ごく弱く自己発光(ブルームで膨らまない程度)
          if (m.emissive && m.color) {
            m.emissive.copy(m.color);
            m.emissiveIntensity = 0.06;
          }
        }
      });
      group.remove(placeholder);
      group.add(model);
      // アニメーション(歩行/待機)
      const clips = gltf.animations || [];
      const find = (re) => clips.find((c) => re.test(c.name));
      G.mixer = new THREE.AnimationMixer(model);
      const idle = find(/idle/i) || clips[0];
      const walk = find(/walk/i) || find(/run/i) || idle;
      G.actIdle = idle ? G.mixer.clipAction(idle) : null;
      G.actWalk = walk ? G.mixer.clipAction(walk) : null;
      if (G.actIdle) G.actIdle.play();
      if (G.actWalk && G.actWalk !== G.actIdle) { G.actWalk.play(); G.actWalk.setEffectiveWeight(0); }
      G.charMoving = false;
      G.charForwardOffset = G.cfg.characterForwardOffset ?? 0; // モデルの正面補正(rad)
    },
    undefined,
    (err) => console.warn("character model load failed:", err?.message || err)
  );
}

// 歩行/待機アニメをクロスフェード
function setCharAnim(moving) {
  if (!G.mixer || !G.actWalk || !G.actIdle || G.actWalk === G.actIdle) return;
  if (moving === G.charMoving) return;
  G.charMoving = moving;
  const to = moving ? G.actWalk : G.actIdle;
  const from = moving ? G.actIdle : G.actWalk;
  to.enabled = true;
  to.setEffectiveTimeScale(1);
  to.crossFadeFrom(from, 0.25, false);
  to.setEffectiveWeight(1);
}

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();
export function updateThirdPerson(dt) {
  if (G.mode !== "thirdperson") {
    if (G.mixer) G.mixer.update(dt); // 念のため(非表示時は描画されない)
    return;
  }
  const speed = G.cfg.walkSpeed ?? 5.5;
  const dz = (G.move.f ? 1 : 0) - (G.move.b ? 1 : 0);
  const dx = (G.move.r ? 1 : 0) - (G.move.l ? 1 : 0);
  let moving = false;
  if (dz || dx) {
    G.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _right.set(_fwd.z, 0, -_fwd.x); // 右方向
    _delta.set(0, 0, 0).addScaledVector(_fwd, dz).addScaledVector(_right, dx);
    if (_delta.lengthSq() > 0) {
      _delta.normalize().multiplyScalar(speed * dt);
      const a = G.avatar.position;
      let nx = a.x + _delta.x, nz = a.z + _delta.z;
      const r = Math.hypot(nx, nz);
      if (r > G.walkBounds) { nx *= G.walkBounds / r; nz *= G.walkBounds / r; }
      if (G.pedestalR > 0 && r < G.pedestalR) { const s = G.pedestalR / (r || 1e-6); nx *= s; nz *= s; }
      const mx = nx - a.x, mz = nz - a.z;
      a.x = nx; a.z = nz;
      // ターゲットとカメラを同じだけ動かして追従(視点の向きは保つ)
      G.controls.target.x += mx; G.controls.target.z += mz;
      G.camera.position.x += mx; G.camera.position.z += mz;
      G.avatar.rotation.y = Math.atan2(_delta.x, _delta.z) + (G.charForwardOffset || 0);
      moving = Math.hypot(mx, mz) > 1e-5;
    }
  }
  setCharAnim(moving);
  if (G.mixer) G.mixer.update(dt);
}

function onKeyDown(e) {
  if (e.code === "KeyE" && G.mode === "walk" && G.walkControls.isLocked && G.focused) {
    zoomFocused(); // 歩行中: 照準を合わせた作品を E で拡大
    return;
  }
  if (G.mode !== "walk" && G.mode !== "thirdperson") return;
  switch (e.code) {
    case "KeyW": case "ArrowUp": G.move.f = true; break;
    case "KeyS": case "ArrowDown": G.move.b = true; break;
    case "KeyA": case "ArrowLeft": G.move.l = true; break;
    case "KeyD": case "ArrowRight": G.move.r = true; break;
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case "KeyW": case "ArrowUp": G.move.f = false; break;
    case "KeyS": case "ArrowDown": G.move.b = false; break;
    case "KeyA": case "ArrowLeft": G.move.l = false; break;
    case "KeyD": case "ArrowRight": G.move.r = false; break;
  }
}

export function updateWalk(dt) {
  if (G.mode !== "walk" || (!G.walkControls.isLocked && !window.__forceWalk)) return;
  const speed = G.cfg.walkSpeed ?? 5.5;
  const v = G.walkVel;
  v.x -= v.x * 10 * dt;
  v.z -= v.z * 10 * dt;
  const dz = (G.move.f ? 1 : 0) - (G.move.b ? 1 : 0);
  const dx = (G.move.r ? 1 : 0) - (G.move.l ? 1 : 0);
  if (dz) v.z += dz * speed * 10 * dt;
  if (dx) v.x += dx * speed * 10 * dt;
  G.walkControls.moveRight(v.x * dt);
  G.walkControls.moveForward(v.z * dt);
  const p = G.camera.position;
  p.y = G.eyeY;
  const r = Math.hypot(p.x, p.z);
  if (r > G.walkBounds) { p.x *= G.walkBounds / r; p.z *= G.walkBounds / r; }
  if (G.pedestalR > 0 && r < G.pedestalR) {
    const s = G.pedestalR / (r || 1e-6);
    p.x *= s; p.z *= s;
  }
}

function onPointerMove(e) {
  G.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  G.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

export function updateHover() {
  if (G.flight) return;
  if (G.mode === "walk" && !G.walkControls.isLocked) return;
  G.raycaster.setFromCamera(G.mode === "walk" ? CENTER : G.pointer, G.camera);
  const hit = G.raycaster.intersectObjects(G.pickables, false)[0]?.object || null;
  if (hit !== G.hovered) {
    G.hovered = hit;
    if (hit) setFocus(hit);
    else if (G.mode === "walk") clearFocus(); // 歩行は照準が外れたら解除
    // 見回しは外れても focus を保持(🔍ボタンへマウスを動かせるように)
  }
}

function setFocus(art) {
  if (G.focused && G.focused !== art) G.focused.userData.frame.material.emissive?.setHex(0x000000);
  G.focused = art;
  art.userData.frame.material.emissive?.setHex(0x222018);
  const hud = $("#hud");
  $("#hud-text").innerHTML =
    labelHtml(art.userData.wallCfg) + (G.mode === "walk" ? ` <span class="hint">${t("zoomHintE")}</span>` : "");
  $("#hud-zoom").style.display = G.mode === "walk" ? "none" : ""; // 歩行は E キー、見回しはボタン
  hud.classList.add("show");
}

function clearFocus() {
  if (G.focused) G.focused.userData.frame.material.emissive?.setHex(0x000000);
  G.focused = null;
  $("#hud").classList.remove("show");
}

function onClick() {
  // 拡大はしない(誤クリック対策)。見回し=何もしない / 歩行=視点ロックのみ。
  if (G.mode === "walk" && !G.walkControls.isLocked) G.walkControls.lock();
}

// クリックした絵の正面へカメラを滑らかに移動 → 到着したら深ズームを開く
function startFlight(art) {
  const { center, normal, artH, wallCfg, resolved } = art.userData;
  const fov = THREE.MathUtils.degToRad(G.camera.fov);
  const dist = (artH / 2) / Math.tan(fov / 2) * 1.2;
  G.flight = {
    fromPos: G.camera.position.clone(),
    toPos: center.clone().addScaledVector(normal, dist),
    fromTgt: G.controls.target.clone(),
    toTgt: center.clone(),
    t: 0,
    dur: G.cfg.flyDuration ?? 0.9,
    wall: { wallCfg, resolved },
  };
  G.controls.autoRotate = false;
  G.controls.enabled = false;
  if (G.idleTimer) clearTimeout(G.idleTimer);
  $("#hud").classList.remove("show");
}

export function updateFlight(dt) {
  if (!G.flight) return;
  const f = G.flight;
  f.t = Math.min(1, f.t + dt / f.dur);
  const k = easeInOutCubic(f.t);
  G.camera.position.lerpVectors(f.fromPos, f.toPos, k);
  G.controls.target.lerpVectors(f.fromTgt, f.toTgt, k);
  G.camera.lookAt(G.controls.target);
  if (f.t >= 1) {
    G.flight = null;
    openViewer(f.wall.wallCfg, f.wall.resolved);
  }
}
