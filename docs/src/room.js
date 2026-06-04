// room.js — 展示室の3D構築: 配置計算(layoutWalls)・部屋(buildRoom)・作品(addArtwork)・銘板(makePlate)。
// 生成物はすべて G.galleryRoot 配下に追加し、展示の切替時にまとめて破棄できるようにする。

import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { G } from "./state.js";

// 光だまりを「加算合成の放射状グラデーション板」で擬似的に描く(本物のライトを増やさない=軽い)。
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}
// 接地影(低コストなリアリティ): 暗い放射状グラデの板を床に敷く。
let _shadowTex = null;
function shadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.6, "rgba(0,0,0,0.28)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
export function makeShadow(size, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  return m;
}

function glowPlane(w, h, color, opacity) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color(color),
      opacity,
      toneMapped: false,
    })
  );
}

// 正多角形の「閉じた部屋」。各壁は辺の中点(apothem)に内向きで置き、隣と頂点で接して連続する。
export function layoutWalls(n) {
  if (G.cfg.layout === "explicit") {
    return (G.cfg.walls || []).map((w) => ({
      position: w.position || [0, 1.55, -5],
      rotationY: (w.rotation && w.rotation[1]) || 0,
      segWidth: (G.cfg.polygon?.wallWidth ?? 4.2) + (G.cfg.polygon?.gap ?? 0.6),
      explicit: true,
    }));
  }
  const p = G.cfg.polygon || {};
  const wallWidth = p.wallWidth ?? 4.2;
  const gap = p.gap ?? 0.6;
  const hangY = G.cfg.room?.hangCenter ?? 1.55; // 絵の中心高さ(美術館の基準線)
  const seg = wallWidth + gap;
  const apothem = n > 2 ? seg / (2 * Math.tan(Math.PI / n)) : seg;
  const placements = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    placements.push({
      position: [Math.sin(a) * apothem, hangY, Math.cos(a) * apothem],
      rotationY: a + Math.PI,
      segWidth: seg,
      apothem,
      maxWidth: wallWidth,
      angle: a,
    });
  }
  return placements;
}

export function buildRoom(placements) {
  const room = G.cfg.room || {};
  const roomH = room.height || 5.5;
  const root = G.galleryRoot;
  G.colliders = []; // 当たり箱をリセット

  const wallMat = new THREE.MeshStandardMaterial({ color: room.wallColor || "#1b1e24", roughness: 0.95 });
  for (const pl of placements) {
    const seg = pl.segWidth || 4.8;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(seg + 0.02, roomH), wallMat);
    wall.position.set(pl.position[0], roomH / 2, pl.position[2]);
    wall.rotation.y = pl.rotationY;
    root.add(wall);
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(seg + 0.02, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 })
    );
    base.position.set(pl.position[0], 0.09, pl.position[2]);
    base.rotation.y = pl.rotationY;
    root.add(base);
  }

  // 床: 既定はマット(美術館同様)。reflectiveFloor:true かつ画質 low 以外なら反射床。
  const reach = (placements[0]?.apothem || 8) * 2.4 + 6;
  if (room.reflectiveFloor === true && G.QP.reflector > 0) {
    const floor = new Reflector(new THREE.CircleGeometry(reach, 64), {
      color: new THREE.Color(room.floorColor || "#0a0b0d"),
      textureWidth: G.QP.reflector,
      textureHeight: G.QP.reflector,
      clipBias: 0.003,
    });
    floor.rotateX(-Math.PI / 2);
    root.add(floor);
  } else {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(reach, 64),
      new THREE.MeshStandardMaterial({ color: room.floorColor || "#101216", roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    root.add(floor);
  }

  const ceil = new THREE.Mesh(
    new THREE.CircleGeometry(reach, 64),
    new THREE.MeshStandardMaterial({ color: room.ceilingColor || "#0c0d11", roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = roomH;
  root.add(ceil);

  if (room.downlights !== false && G.QP.downlights) buildDownlights(placements, roomH);
  if (room.furniture !== false) buildFurniture(placements, roomH);

  // 環境マップを使う場合、暗い雰囲気を保つため反映強度を抑える(質感は上がる)。
  if (G.envOn) {
    const intensity = room.envIntensity ?? 0.35;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m && "envMapIntensity" in m) m.envMapIntensity = intensity; });
    });
  }
}

function buildDownlights(placements, roomH) {
  const room = G.cfg.room || {};
  const n = room.downlightCount ?? 6;
  const ringR = (placements[0]?.apothem || 8) * 0.42;
  const lightCol = new THREE.Color(room.lightColor || "#ffe9c4");
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.sin(a) * ringR;
    const z = Math.cos(a) * ringR;
    // 発光する器具(ブルームでにじむ・ライトコスト0)
    const fix = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 24),
      new THREE.MeshBasicMaterial({ color: lightCol, toneMapped: false })
    );
    fix.rotation.x = Math.PI / 2;
    fix.position.set(x, roomH - 0.12, z);
    G.galleryRoot.add(fix);
    // 床の光だまり(擬似)
    const pool = glowPlane(3.2, 3.2, lightCol, 0.28);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, z);
    G.galleryRoot.add(pool);
  }
}

function buildFurniture(placements, roomH) {
  const room = G.cfg.room || {};
  const lightCol = new THREE.Color(room.lightColor || "#ffe9c4");
  // 床の什器が暗闇に沈まないよう、明るめの石材色 + 床に淡い接地グロー。
  const stone = new THREE.MeshStandardMaterial({ color: 0x3a4049, roughness: 0.7, metalness: 0.05 });
  const floorGlow = (x, z, size) => {
    if (room.floorGlow === false) return;
    const g = glowPlane(size, size, lightCol, 0.22);
    g.rotation.x = -Math.PI / 2;
    g.position.set(x, 0.02, z);
    G.galleryRoot.add(g);
  };

  const pedR = 0.7;
  const pedH = 0.95;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(pedR, pedR * 1.05, pedH, 32), stone);
  ped.position.y = pedH / 2;
  G.galleryRoot.add(ped);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(pedR, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.4 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = pedH + 0.001;
  G.galleryRoot.add(top);
  floorGlow(0, 0, 3.2);
  const pedShadow = makeShadow(pedR * 2.8, 0.8); pedShadow.position.set(0, 0.016, 0); G.galleryRoot.add(pedShadow);
  G.pedestalR = pedR + 0.35;
  // 当たり箱: 台座(円柱)。横は通れず、上には乗れる。
  G.colliders.push({ kind: "cyl", x: 0, z: 0, r: pedR + 0.25, top: pedH });

  const benchMat = new THREE.MeshStandardMaterial({ color: 0x343a43, roughness: 0.8 });
  const benchR = (placements[0]?.apothem || 8) * 0.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.sin(a) * benchR, bz = Math.cos(a) * benchR;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.5), benchMat);
    bench.position.set(bx, 0.225, bz);
    bench.rotation.y = a + Math.PI / 2;
    G.galleryRoot.add(bench);
    floorGlow(bx, bz, 2.4);
    const bsh = makeShadow(1.9, 0.7); bsh.position.set(bx, 0.016, bz); G.galleryRoot.add(bsh);
    // 当たり箱: ベンチ(回転した箱)。半径方向に margin を足す。
    G.colliders.push({ kind: "obox", x: bx, z: bz, rotY: a + Math.PI / 2, hx: 0.8 + 0.2, hz: 0.25 + 0.2, top: 0.45 });
  }
}

export function addArtwork(wallCfg, resolved, place) {
  const room = G.cfg.room || {};
  const roomH = room.height || 5.5;
  const aspect = resolved.width && resolved.height ? resolved.width / resolved.height : 1;

  // 高さ・幅に上限(m)を設け、壁いっぱいにせず余白を残すのが美術館の掛け方。
  const maxH = room.artMaxHeight ?? 1.9;
  const maxW = Math.min(room.artMaxWidth ?? 2.4, place.maxWidth ?? (place.segWidth ? place.segWidth - 1.0 : 3));
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }

  const group = new THREE.Group();
  group.position.set(place.position[0], place.position[1], place.position[2]);
  group.rotation.y = place.rotationY;
  G.galleryRoot.add(group);

  const normal = new THREE.Vector3(-place.position[0], 0, -place.position[2]);
  if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
  normal.normalize();

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.28, h + 0.28),
    new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.6, metalness: 0.2 })
  );
  frame.position.z = 0.02;
  group.add(frame);

  // 絵: まずグレーのプレースホルダ → サムネ読み込み後に差し替え。発色維持のため非ライティング材質。
  const artMat = new THREE.MeshBasicMaterial({ color: 0x23262d, toneMapped: false });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
  art.position.z = 0.04;
  group.add(art);

  const px = Math.max(512, Math.min(G.cfg.wallTexturePx || 1024, Math.round(Math.max(w, h) * 200)));
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    resolved.thumb(px),
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
      artMat.map = tex;
      artMat.color.setHex(0xffffff);
      artMat.needsUpdate = true;
    },
    undefined,
    () => console.warn("thumbnail load failed")
  );

  if (G.cfg.plates !== false && (wallCfg.label || wallCfg.by)) {
    const plate = makePlate(wallCfg.label, wallCfg.by, w);
    plate.position.set(0, -h / 2 - 0.22, 0.05);
    group.add(plate);
  }

  const center = group.position.clone();
  // 作品まわりの照明。quality=high は本物のスポット(立体的で realistic)、それ以外は擬似グロー(軽い)。
  if (room.spotlights !== false) {
    if (G.QP.spotMode === "real") {
      const spot = new THREE.SpotLight(
        new THREE.Color(room.lightColor || "#ffe9c4"),
        room.spotIntensity ?? 120,
        0,
        THREE.MathUtils.degToRad(room.spotAngleDeg ?? 28),
        room.spotPenumbra ?? 0.7,
        2
      );
      spot.position.copy(center).addScaledVector(normal, 2.2);
      spot.position.y = roomH - 0.4;
      spot.target.position.copy(center).setY(center.y - 0.6);
      G.galleryRoot.add(spot, spot.target);
    } else {
      const glow = glowPlane(w * 2.6, h * 2.3, room.lightColor || "#ffe9c4", room.glowStrength ?? 0.95);
      glow.position.z = 0.012; // 額(0.02)の背後 → 額の周囲に光が回り込む
      glow.position.y = 0.1;
      group.add(glow);
    }
  }

  art.userData = { wallCfg, resolved, frame, center, normal, artH: h };
  G.pickables.push(art);
}

// 題名/作者をキャンバスに描いて銘板テクスチャに(フォント読み込み不要)。実物大の小さなプレート。
function makePlate(title, by, artW) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 220;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0d0e12";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, c.width - 12, c.height - 12);

  const clip = (s, font, max) => {
    ctx.font = font;
    if (ctx.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
  };
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleFont = "600 60px -apple-system, 'Hiragino Sans', sans-serif";
  ctx.fillStyle = "#eef0f4";
  ctx.font = titleFont;
  ctx.fillText(clip(title || "", titleFont, c.width - 80), c.width / 2, by ? 86 : 110);
  if (by) {
    const byFont = "400 42px -apple-system, 'Hiragino Sans', sans-serif";
    ctx.fillStyle = "#9aa3b2";
    ctx.font = byFont;
    ctx.fillText(clip(by, byFont, c.width - 80), c.width / 2, 150);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pw = Math.min(Math.max(artW * 0.42, 0.42), 0.6);
  const ph = pw * (c.height / c.width);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
}
