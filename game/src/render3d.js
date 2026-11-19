// Solmar Bay — the three.js r187 renderer.
// createRenderer(canvas) returns { buildCity, sync, screenToGround,
// projectToScreen, getStats, resize, dispose, scene, camera, renderer }.
// The simulation runs on a 2D plane (x east, y south, 4800x3600); the
// renderer maps it to three.js space as (x - 2400, 0, y - 1800) and
// rotates by the negative angle, so the tested logic and the picture
// stay in sync. Meshes are a view of the state: nothing here changes
// the simulation (drift dust is visual only).
//
// Look: PBR standard materials, a sunset sky dome, a baked PMREM
// environment map, a warm sun with soft shadows, lit windows at dusk.
// Feel: FOV kick with speed, trauma-squared summed-sine shake with a
// slight roll, drift dust at the rear wheels. Performance: instanced
// buildings (one mesh per wall colour, per window variant), roofs,
// containers, trees, lamps and props; glTF cars and the hotel model
// with procedural fallbacks if a model fails to load.

import * as THREE from '../vendor/three.module.js';
import { CONFIG, CAR_MODELS } from './config.js';
import { loadModels, getModel, hasModel } from './models.js';

const OFF_X = 2400, OFF_Y = 1800;
const TAU = Math.PI * 2;

function mulberry(seed) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Sunset gradient: dusk purple up top, warm orange at the horizon.
function skyGradientTexture() {
  return canvasTexture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#241a4e');
    grad.addColorStop(0.35, '#5a3a72');
    grad.addColorStop(0.62, '#c96a4a');
    grad.addColorStop(0.78, '#ff9a4a');
    grad.addColorStop(1.0, '#7a4a30');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

// Building faces: wall colour with a window grid. The emissive map
// lights about 40% of the windows warm orange, chosen by a seeded
// pattern so the same building always glows the same way at dusk.
function windowTextures(wallColor, seed) {
  const rng = mulberry(seed);
  const cols = 6, rows = 10;
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rng() < 0.4);
  const map = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = wallColor;
    g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = '#232a38';
        g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
  });
  const emissiveMap = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!lit[r * cols + c]) continue;
        g.fillStyle = '#ff9a3c';
        g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
  });
  return { map, emissiveMap };
}

function textTexture(text, fg, bg) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = bg || '#20242c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg || '#ffd94a';
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg || '#ffd94a';
    g.font = 'bold 52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function stripeTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? '#d23c2e' : '#f2ede2';
      g.fillRect(0, (i * h) / 8, w, h / 8 + 1);
    }
  });
}

function dustTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(210,190,160,0.85)');
    grad.addColorStop(1, 'rgba(210,190,160,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function dollarTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffd94a';
    g.font = 'bold 52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', w / 2, h / 2 + 2);
  });
}

// glTF car model for each game car model; truck and van keep their
// procedural meshes (no models were built for them).
const CAR_MODEL_MAP = {
  sport: 'sportscar',
  sedan: 'sedan',
  taxi: 'sedan',
  classic: 'sedan',
  police: 'police',
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  // r187: PCF shadows are soft already (r182); the old PCFSoft name
  // only logs a warning now.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9a6a72, 900, 2400);

  const camera = new THREE.PerspectiveCamera(62, 1, 1, 10000);
  camera.position.set(0, 120, 320);

  // ---- sunset sky dome + baked environment map -----------------------
  const skyTex = skyGradientTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4500, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  {
    // Cheap image-based lighting: bake a PMREM env map from a tiny
    // primitive gradient scene — no HDR file, no addon.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 12),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }),
    ));
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(50, 16),
      new THREE.MeshBasicMaterial({ color: 0x6a4a3a }),
    );
    envGround.rotation.x = -Math.PI / 2;
    envGround.position.y = -8;
    envScene.add(envGround);
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.4;
    pmrem.dispose();
  }

  // ---- lights ---------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700;
  sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700;
  sun.shadow.camera.bottom = -700;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 2;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x9a86c8, 0x54402e, 0.7);
  scene.add(hemi);

  // ---- shared materials ----------------------------------------------
  const paintMat = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.6,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x223344, roughness: 0.08, metalness: 0.9,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0 });

  // ---- dynamic pools ---------------------------------------------------
  const carMeshes = new Map(); // car.id -> entry
  const pedMeshes = new Map(); // ped object -> group
  const bulletMeshes = new Map(); // bullet object -> mesh
  const dustPool = [];
  const dustTex = dustTexture();
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dustTex, transparent: true, opacity: 0, depthWrite: false,
    }));
    s.visible = false;
    scene.add(s);
    dustPool.push({ sprite: s, life: 0, maxLife: 0.7, size: 10 });
  }
  let dustTimer = 0;

  const SMOKE_MAX = 60;
  const smokeMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1, metalness: 0, transparent: true, opacity: 0.55 }),
    SMOKE_MAX,
  );
  smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smokeMesh.frustumCulled = false;
  scene.add(smokeMesh);

  const SPARK_MAX = 300;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_MAX * 3);
  const sparkCol = new Float32Array(SPARK_MAX * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    size: 5, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);

  // ---- player figure -----------------------------------------------------
  const playerGroup = new THREE.Group();
  {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 11), paintMat(0xc0392b));
    torso.position.y = 22;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(6.5, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }));
    head.position.y = 37;
    head.castShadow = true;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(15, 14, 10), darkMat);
    legs.position.y = 7;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3), darkMat);
    gun.position.set(12, 24, 0);
    gun.name = 'gun';
    playerGroup.add(torso, head, legs, gun);
  }
  scene.add(playerGroup);

  // ---- helicopter ---------------------------------------------------------
  const heliGroup = new THREE.Group();
  let heliRotor;
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(56, 20, 30),
      new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.4, metalness: 0.5 }));
    body.castShadow = true;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(52, 8, 8), body.material);
    tail.position.set(-50, 4, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 26), glassMat);
    glass.position.set(22, 4, 0);
    heliRotor = new THREE.Mesh(new THREE.BoxGeometry(130, 2, 9), darkMat);
    heliRotor.position.y = 14;
    const light = new THREE.Mesh(
      new THREE.ConeGeometry(55, 150, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    light.position.y = -85;
    light.rotation.x = Math.PI; // cone opens downward
    heliGroup.add(body, tail, glass, heliRotor, light);
  }
  heliGroup.visible = false;
  scene.add(heliGroup);

  // ---- waypoint ring + beam ------------------------------------------------
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(40, 56, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 420, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd94a, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 210;
  const waypoint = new THREE.Group();
  waypoint.add(ring, beam);
  waypoint.visible = false;
  scene.add(waypoint);

  // ---- procedural car builder (fallback, and truck / van) -------------------
  function buildProceduralCar(car) {
    const m = CAR_MODELS[car.model] || CAR_MODELS.sedan;
    const group = new THREE.Group();
    const paint = paintMat(car.color || '#888888');
    const len = m.len, wid = m.wid;
    if (car.model === 'truck') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(len * 0.55, 20, wid), paint);
      bed.position.set(-len * 0.18, 14, 0);
      bed.castShadow = true;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.32, 22, wid), paint);
      cab.position.set(len * 0.32, 15, 0);
      cab.castShadow = true;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(4, 12, wid - 8), glassMat);
      shield.position.set(len * 0.46, 18, 0);
      group.add(bed, cab, shield);
    } else if (car.model === 'van') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 30, wid), paint);
      body.position.y = 19;
      body.castShadow = true;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(4, 14, wid - 8), glassMat);
      shield.position.set(len / 2 - 4, 22, 0);
      group.add(body, shield);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 14, wid), paint);
      body.position.y = 11;
      body.castShadow = true;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.45, 12, wid * 0.78), glassMat);
      cabin.position.set(-len * 0.04, 23, 0);
      cabin.castShadow = true;
      group.add(body, cabin);
      if (car.model === 'police') {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 20),
          new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
        bar.position.set(-2, 31, 0);
        const red = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 9),
          new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.5 }));
        red.position.set(-2, 34, -5);
        const blue = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 9),
          new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2244ff, emissiveIntensity: 2.5 }));
        blue.position.set(-2, 34, 5);
        group.add(bar, red, blue);
      }
    }
    // Headlights and taillights read at dusk.
    const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffeebb, emissiveIntensity: 2 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2222, emissiveIntensity: 1.6 });
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 8), headMat);
      hl.position.set(len / 2, 10, s * (wid / 2 - 8));
      const tl = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 8), tailMat);
      tl.position.set(-len / 2, 10, s * (wid / 2 - 8));
      group.add(hl, tl);
    }
    // Wheels: groups so spin (Z) and steer (Y) compose like the glTF nodes.
    const wheels = [], frontWheels = [];
    const wheelGeo = new THREE.CylinderGeometry(12, 12, 8, 12);
    wheelGeo.rotateX(Math.PI / 2); // axle along local Z
    for (const [wx, wz, front] of [
      [len / 2 - 14, -(wid / 2 - 2), true],
      [len / 2 - 14, wid / 2 - 2, true],
      [-len / 2 + 14, -(wid / 2 - 2), false],
      [-len / 2 + 14, wid / 2 - 2, false],
    ]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 12, wz);
      const wheel = new THREE.Mesh(wheelGeo, tyreMat);
      wheel.castShadow = true;
      pivot.add(wheel);
      group.add(pivot);
      wheels.push(pivot);
      if (front) frontWheels.push(pivot);
    }
    group.userData.wheels = wheels;
    group.userData.frontWheels = frontWheels;
    return group;
  }

  function makePedFigure(ped) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: ped.color || '#888888', roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(16, 17, 10), shirt);
    torso.position.y = 21;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }));
    head.position.y = 35;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(13, 13, 9), darkMat);
    legs.position.y = 6.5;
    group.add(torso, head, legs);
    if (ped.kind === 'client') {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dollarTexture(), transparent: true, depthWrite: false,
      }));
      sprite.scale.set(22, 22, 1);
      sprite.position.y = 56;
      sprite.name = 'dollar';
      group.add(sprite);
    }
    return group;
  }

  // ---- static city -----------------------------------------------------------
  let built = false;
  let hotelFallback = null;
  let hotelModel = null;
  const beachPalmSpots = []; // {group, x, y, s, upgraded}
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  function buildCity(game) {
    if (built) return;
    built = true;
    const city = game.city;

    // Ground, sea, sand.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.world.w, CONFIG.world.h),
      new THREE.MeshStandardMaterial({ color: 0x6f6f66, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, 4200),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a5f8a, roughness: 0.15, metalness: 0.1,
        sheen: 1, sheenColor: 0xffd9a0, sheenRoughness: 0.5,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-2940, 0.2, 0);
    scene.add(sea);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(190, CONFIG.world.h),
      new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 1, metalness: 0 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-2195, 0.1, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    // Roads: asphalt, sidewalks, dashed yellow centre lines.
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.95, metalness: 0 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8a8a82, roughness: 1, metalness: 0 });
    const dashGeo = new THREE.BoxGeometry(3, 0.4, 24);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8b93a });
    const dashCount = CONFIG.roadsV.length * 40 + CONFIG.roadsH.length * 53;
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    let di = 0;
    for (const r of CONFIG.roadsV) {
      const x = r - OFF_X;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadW, CONFIG.world.h), asphaltMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0, 0);
      road.receiveShadow = true;
      scene.add(road);
      for (const s of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.sidewalk, CONFIG.world.h), sidewalkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(x + s * (CONFIG.roadW / 2 + CONFIG.sidewalk / 2), 0.05, 0);
        walk.receiveShadow = true;
        scene.add(walk);
      }
      for (let y = 60; y < CONFIG.world.h - 30 && di < dashCount; y += 90) {
        dummy.position.set(x, 0.3, y - OFF_Y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dashes.setMatrixAt(di++, dummy.matrix);
      }
    }
    for (const r of CONFIG.roadsH) {
      const y = r - OFF_Y;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.world.w, CONFIG.roadW), asphaltMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, y);
      road.receiveShadow = true;
      scene.add(road);
      for (const s of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.world.w, CONFIG.sidewalk), sidewalkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(0, 0.05, y + s * (CONFIG.roadW / 2 + CONFIG.sidewalk / 2));
        walk.receiveShadow = true;
        scene.add(walk);
      }
      for (let x = 60; x < CONFIG.world.w - 30 && di < dashCount; x += 90) {
        dummy.position.set(x - OFF_X, 0.3, y);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dashes.setMatrixAt(di++, dummy.matrix);
      }
    }
    dashes.count = di;
    dashes.instanceMatrix.needsUpdate = true;
    scene.add(dashes);

    // Parks and parking lots.
    const parkMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1, metalness: 0 });
    for (const p of city.parks) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), parkMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x - OFF_X, 0.05, p.y - OFF_Y);
      m.receiveShadow = true;
      scene.add(m);
    }
    const lotMat = new THREE.MeshStandardMaterial({ color: 0x555550, roughness: 1, metalness: 0 });
    for (const p of city.lots) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), lotMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x - OFF_X, 0.05, p.y - OFF_Y);
      m.receiveShadow = true;
      scene.add(m);
    }

    // ---- buildings, instanced: one mesh per wall colour x window variant --
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const normal = city.buildings.filter((b) => b.landmark !== 'hotel' && b.landmark !== 'lighthouse');
    const VARIANTS = 4;
    const buckets = new Map(); // "colorIndex:variant" -> buildings
    for (const b of normal) {
      const variant = ((Math.floor(b.x * 0.37 + b.y * 0.73) % VARIANTS) + VARIANTS) % VARIANTS;
      const key = b.colorIndex + ':' + variant;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(b);
    }
    for (const [key, list] of buckets) {
      const [colorIndex, variant] = key.split(':').map(Number);
      const wallColor = CONFIG.wallColors[colorIndex];
      const { map, emissiveMap } = windowTextures(wallColor, colorIndex * 31 + variant * 7 + 3);
      const mat = new THREE.MeshStandardMaterial({
        map, emissiveMap,
        emissive: 0xff9a3c, emissiveIntensity: 0.85,
        roughness: 0.85, metalness: 0.05,
      });
      const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
      list.forEach((b, i) => {
        dummy.position.set(b.x - OFF_X, b.height / 2, b.y - OFF_Y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.w, b.height, b.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    // Roofs: one instanced mesh for all normal buildings.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9, metalness: 0 });
    const roofs = new THREE.InstancedMesh(boxGeo, roofMat, normal.length);
    normal.forEach((b, i) => {
      dummy.position.set(b.x - OFF_X, b.height + 2, b.y - OFF_Y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.w + 6, 4, b.d + 6);
      dummy.updateMatrix();
      roofs.setMatrixAt(i, dummy.matrix);
    });
    roofs.instanceMatrix.needsUpdate = true;
    roofs.castShadow = true;
    scene.add(roofs);

    // ---- hotel: procedural fallback box, replaced by the model when it loads
    const hotel = city.landmarks.hotel;
    {
      const { map, emissiveMap } = windowTextures(CONFIG.wallColors[7], 77);
      hotelFallback = new THREE.Group();
      const tower = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
        map, emissiveMap, emissive: 0xff9a3c, emissiveIntensity: 0.85, roughness: 0.85, metalness: 0.05,
      }));
      tower.scale.set(240, 146, 170);
      tower.position.y = 73;
      tower.castShadow = true;
      const cap = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
        color: 0xd4af37, roughness: 0.35, metalness: 0.35,
      }));
      cap.scale.set(244, 4, 174);
      cap.position.y = 148;
      hotelFallback.add(tower, cap);
      hotelFallback.position.set(hotel.x - OFF_X, 0, hotel.y - OFF_Y);
      scene.add(hotelFallback);
    }

    // ---- lighthouse: striped tower + lamp --------------------------------
    const lh = city.landmarks.lighthouse;
    {
      const group = new THREE.Group();
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(26, 32, 150, 12),
        new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.8, metalness: 0 }),
      );
      tower.position.y = 75;
      tower.castShadow = true;
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(12, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffeebb, emissiveIntensity: 3 }),
      );
      lamp.position.y = 158;
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 8, 12), darkMat);
      capTop.position.y = 148;
      group.add(tower, lamp, capTop);
      group.position.set(lh.x - OFF_X, 0, lh.y - OFF_Y);
      scene.add(group);
    }

    // ---- pier + docks -------------------------------------------------------
    const pier = city.landmarks.pier;
    {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(200, 4, 40),
        new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 }));
      deck.position.set(pier.x - OFF_X, 2, pier.y - OFF_Y);
      deck.receiveShadow = true;
      scene.add(deck);
    }
    const docks = city.landmarks.docks;
    {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(160, 3, 100),
        new THREE.MeshStandardMaterial({ color: 0x777770, roughness: 1 }));
      slab.position.set(docks.x - OFF_X, 1.5, docks.y - OFF_Y);
      slab.receiveShadow = true;
      scene.add(slab);
    }

    // ---- containers, instanced per colour ----------------------------------
    const contByColor = new Map();
    for (const c of city.containers) {
      if (!contByColor.has(c.color)) contByColor.set(c.color, []);
      contByColor.get(c.color).push(c);
    }
    for (const [color, list] of contByColor) {
      const stacked = list.filter((c) => c.stacked).length;
      const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({
        color, roughness: 0.7, metalness: 0.3,
      }), list.length + stacked);
      let i = 0;
      for (const c of list) {
        dummy.position.set(c.x - OFF_X, 13, c.y - OFF_Y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(c.w, 26, c.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
        if (c.stacked) {
          dummy.position.set(c.x - OFF_X, 39, c.y - OFF_Y);
          dummy.updateMatrix();
          mesh.setMatrixAt(i++, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // ---- trees, lamps, props (instanced) ------------------------------------
    const beachPalms = city.trees.filter((t) => t.x < 400);
    const palmSpots = [];
    for (let i = 0; i < 12 && beachPalms.length; i++) {
      palmSpots.push(beachPalms[Math.floor((i * beachPalms.length) / 12)]);
    }
    const palmSpotSet = new Set(palmSpots);
    const restTrees = city.trees.filter((t) => !palmSpotSet.has(t));
    const trunkGeo = new THREE.CylinderGeometry(2.5, 4, 26, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, restTrees.length);
    const canopyGeo = new THREE.SphereGeometry(16, 8, 6);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x7ab05a, roughness: 1, metalness: 0 });
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, restTrees.length);
    restTrees.forEach((t, i) => {
      dummy.position.set(t.x - OFF_X, 13 * t.s, t.y - OFF_Y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x - OFF_X, 34 * t.s, t.y - OFF_Y);
      dummy.scale.set(t.s, t.s * 0.8, t.s);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
      canopies.setColorAt(i, tmpColor.setHSL(0.29, 0.45, 0.42 + ((i * 37) % 10) * 0.008));
    });
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    trunks.castShadow = true;
    canopies.castShadow = true;
    scene.add(trunks, canopies);

    // The twelve beach-palm spots start as primitive palms and are
    // swapped for the palm glTF model once it loads (same upgrade
    // pattern as the cars).
    for (const t of palmSpots) {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(t.s, t.s * 1.2, t.s);
      trunk.position.y = 13 * t.s * 1.2;
      trunk.castShadow = true;
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.scale.set(t.s * 1.1, t.s * 0.9, t.s * 1.1);
      canopy.position.y = 36 * t.s;
      canopy.castShadow = true;
      group.add(trunk, canopy);
      group.position.set(t.x - OFF_X, 0, t.y - OFF_Y);
      scene.add(group);
      beachPalmSpots.push({ group, x: t.x, y: t.y, s: t.s, upgraded: false });
    }

    const lampPoleGeo = new THREE.CylinderGeometry(1.5, 2, 34, 6);
    const lampHeadGeo = new THREE.SphereGeometry(4, 8, 6);
    const lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0x333333, emissive: 0xffc860, emissiveIntensity: 2,
    });
    const poles = new THREE.InstancedMesh(lampPoleGeo, darkMat, city.lamps.length);
    const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, city.lamps.length);
    city.lamps.forEach((l, i) => {
      dummy.position.set(l.x - OFF_X, 17, l.y - OFF_Y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(l.x - OFF_X, 35, l.y - OFF_Y);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    scene.add(poles, heads);

    // Beach umbrellas: one instanced cone per colour via instance colours.
    if (city.umbrellas.length) {
      const umbGeo = new THREE.ConeGeometry(22, 12, 8);
      const umbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      const umbs = new THREE.InstancedMesh(umbGeo, umbMat, city.umbrellas.length);
      const umbPoles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1.5, 1.5, 16, 6), darkMat, city.umbrellas.length);
      city.umbrellas.forEach((u, i) => {
        dummy.position.set(u.x - OFF_X, 20, u.y - OFF_Y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        umbs.setMatrixAt(i, dummy.matrix);
        umbs.setColorAt(i, tmpColor.set(u.color));
        dummy.position.set(u.x - OFF_X, 8, u.y - OFF_Y);
        dummy.updateMatrix();
        umbPoles.setMatrixAt(i, dummy.matrix);
      });
      umbs.instanceMatrix.needsUpdate = true;
      if (umbs.instanceColor) umbs.instanceColor.needsUpdate = true;
      umbPoles.instanceMatrix.needsUpdate = true;
      umbs.castShadow = true;
      scene.add(umbs, umbPoles);
    }

    // Park benches.
    if (city.benches.length) {
      const benchGeo = new THREE.BoxGeometry(34, 5, 13);
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
      const benches = new THREE.InstancedMesh(benchGeo, benchMat, city.benches.length);
      city.benches.forEach((b, i) => {
        dummy.position.set(b.x - OFF_X, 8, b.y - OFF_Y);
        dummy.rotation.set(0, -b.angle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        benches.setMatrixAt(i, dummy.matrix);
      });
      benches.instanceMatrix.needsUpdate = true;
      benches.castShadow = true;
      scene.add(benches);
    }

    // Bus-stop shelters: roof, posts, bench.
    for (const s of city.busStops) {
      const group = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.BoxGeometry(76, 3, 30), darkMat);
      roof.position.y = 34;
      roof.castShadow = true;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(60, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }));
      bench.position.y = 8;
      group.add(roof, bench);
      for (const px of [-34, 34]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), darkMat);
        post.position.set(px, 17, -12);
        group.add(post);
      }
      group.position.set(s.x - OFF_X, 0, s.y - OFF_Y);
      group.rotation.y = -s.angle;
      scene.add(group);
    }

    // Billboards: posts, board, canvas-text face.
    for (const b of city.billboards) {
      const group = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(130, 30, 4), darkMat);
      board.position.y = 42;
      board.castShadow = true;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(126, 28),
        new THREE.MeshBasicMaterial({ map: textTexture(b.text, '#ffd94a', '#20242c') }),
      );
      face.position.set(0, 42, 2.5);
      group.add(board, face);
      for (const px of [-50, 50]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 4), darkMat);
        post.position.set(px, 14, 0);
        group.add(post);
      }
      group.position.set(b.x - OFF_X, 0, b.y - OFF_Y);
      group.rotation.y = -b.angle;
      scene.add(group);
    }

    // Landmark signs, one per landmark (nine in all).
    const signTexts = {
      hotel: 'GRAND SOLMAR HOTEL',
      casino: 'MARINA CASINO',
      chopshop: 'CHOP SHOP',
      hospital: 'SOLMAR GENERAL',
      policehq: 'POLICE HQ',
      hideout: 'HIDEOUT',
      docks: 'PORTSIDE DOCKS',
      pier: 'MARINA PIER',
      lighthouse: 'LIGHTHOUSE',
    };
    for (const [key, lm] of Object.entries(city.landmarks)) {
      const text = signTexts[key];
      if (!text) continue;
      const group = new THREE.Group();
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(150, 28),
        new THREE.MeshBasicMaterial({ map: textTexture(text, '#ffe9a0', '#1c2b4a'), transparent: true }),
      );
      const height = key === 'lighthouse' ? 175 : key === 'hotel' ? 62 : 42;
      face.position.y = height;
      const post = new THREE.Mesh(new THREE.BoxGeometry(4, height, 4), darkMat);
      post.position.y = height / 2;
      group.add(face, post);
      // Signs sit just south of their building so they read from the road.
      group.position.set(lm.x - OFF_X, 0, lm.y + lm.d / 2 + 24 - OFF_Y);
      scene.add(group);
    }

    // ---- glTF models (async, never blocks the game) ----------------------
    loadModels().then(() => {
      if (hasModel('hotel')) {
        const m = getModel('hotel');
        if (m) {
          // The model faces +Z (entrance canopy) and sits on its origin;
          // unrotated, the canopy overhangs the south face onto the
          // sidewalk only. Footprint 240x170 matches the nudged rect.
          m.position.set(hotel.x - OFF_X, 0, hotel.y - OFF_Y);
          m.rotation.y = 0;
          scene.add(m);
          hotelModel = m;
          if (hotelFallback) hotelFallback.visible = false;
        }
      }
      // Palm models on the twelve beach spots.
      if (hasModel('palm')) {
        for (const spot of beachPalmSpots) {
          if (spot.upgraded) continue;
          const m = getModel('palm');
          if (!m) continue;
          m.scale.setScalar(3);
          m.position.set(0, 0, 0);
          spot.group.clear();
          spot.group.add(m);
          spot.upgraded = true;
        }
      }
    }).catch(() => { /* fallbacks stay in place */ });
  }

  // ---- per-frame sync -------------------------------------------------------
  let clock = 0;
  let snapped = false;
  let fov = 62;
  const smoothLook = new THREE.Vector3(0, 30, 0);
  const smoothPos = new THREE.Vector3(0, 120, 320);
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  function currentTarget(game) {
    if (game.mission) {
      const step = game.mission.def.steps[game.mission.step];
      if (step && step.kind !== 'escape') return { x: step.x, y: step.y };
      return null;
    }
    if (game.taxi && game.taxi.active) {
      if (game.taxi.state === 'toClient' && game.taxi.client) {
        return { x: game.taxi.client.x, y: game.taxi.client.y };
      }
      return { x: game.taxi.destX, y: game.taxi.destY };
    }
    return null;
  }

  function syncCar(car, dt) {
    let entry = carMeshes.get(car.id);
    if (!entry) {
      const group = new THREE.Group();
      group.add(buildProceduralCar(car));
      scene.add(group);
      entry = {
        group, isGltf: false, prevAngle: car.angle,
        spin: 0, steer: 0, wheels: group.children[0].userData.wheels,
        frontWheels: group.children[0].userData.frontWheels,
      };
      carMeshes.set(car.id, entry);
    }
    // Upgrade to the glTF model once it is loaded (truck/van have none).
    if (!entry.isGltf && hasModel(CAR_MODEL_MAP[car.model] || '')) {
      const clone = getModel(CAR_MODEL_MAP[car.model]);
      if (clone) {
        clone.scale.setScalar(2); // models are built at half game scale
        entry.group.clear();
        entry.group.add(clone);
        entry.isGltf = true;
        entry.wheels = clone.userData.wheels || [];
        entry.frontWheels = clone.userData.frontWheels || [];
      }
    }
    const g = entry.group;
    g.position.set(car.x - OFF_X, 0, car.y - OFF_Y);
    g.rotation.y = -car.angle;
    // Wheel spin follows road speed; steering follows turn rate.
    entry.spin += ((car.speed || 0) * dt) / 11;
    let angVel = 0;
    if (dt > 0) {
      let d = car.angle - entry.prevAngle;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      angVel = d / dt;
    }
    entry.prevAngle = car.angle;
    const targetSteer = Math.max(-0.45, Math.min(0.45, angVel * 0.18));
    entry.steer += (targetSteer - entry.steer) * Math.min(1, dt * 8);
    for (const w of entry.wheels) w.rotation.set(0, 0, entry.spin);
    for (const w of entry.frontWheels) w.rotation.set(0, entry.steer, entry.spin);
    return entry;
  }

  function sync(game, dt) {
    dt = Math.max(0, Math.min(dt || 0, 0.1));
    clock += dt;
    const p = game.player;

    // Cars.
    const liveCars = new Set();
    for (const car of game.cars) {
      liveCars.add(car.id);
      syncCar(car, dt);
    }
    for (const [id, entry] of [...carMeshes]) {
      if (!liveCars.has(id)) {
        scene.remove(entry.group);
        carMeshes.delete(id);
      }
    }

    // Pedestrians.
    const livePeds = new Set();
    for (const ped of game.peds) {
      livePeds.add(ped);
      let g = pedMeshes.get(ped);
      if (!g) {
        g = makePedFigure(ped);
        scene.add(g);
        pedMeshes.set(ped, g);
      }
      g.position.set(ped.x - OFF_X, 0, ped.y - OFF_Y);
      g.rotation.y = -ped.angle;
      const moving = ped.state === 'walk' || ped.state === 'flee' || ped.state === 'chase';
      g.position.y = moving ? Math.abs(Math.sin(clock * 10 + ped.x)) * 2 : 0;
      const dollar = g.getObjectByName('dollar');
      if (dollar) dollar.visible = ped.kind === 'client' && ped.state === 'wait';
    }
    for (const [ped, g] of [...pedMeshes]) {
      if (!livePeds.has(ped)) {
        scene.remove(g);
        pedMeshes.delete(ped);
      }
    }

    // Player figure (hidden while driving — the player is in the car).
    if (p.onFoot) {
      playerGroup.visible = true;
      playerGroup.position.set(p.x - OFF_X, 0, p.y - OFF_Y);
      playerGroup.rotation.y = -p.angle;
      playerGroup.position.y = p.moving ? Math.abs(Math.sin(clock * 11)) * 2.5 : 0;
      const gun = playerGroup.getObjectByName('gun');
      if (gun) gun.visible = p.weapon === 'pistol';
    } else {
      playerGroup.visible = false;
    }

    // Helicopter.
    const heli = game.heli;
    heliGroup.visible = !!heli.active;
    if (heli.active) {
      heliGroup.position.set(heli.x - OFF_X, heli.z, heli.y - OFF_Y);
      heliGroup.rotation.y = -heli.angle;
      heliRotor.rotation.y = heli.rotor;
    }

    // Bullets.
    const liveBullets = new Set();
    for (const b of game.bullets) {
      liveBullets.add(b);
      let m = bulletMeshes.get(b);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.BoxGeometry(14, 2, 2),
          new THREE.MeshBasicMaterial({ color: 0xffe08a }),
        );
        scene.add(m);
        bulletMeshes.set(b, m);
      }
      m.position.set(b.x - OFF_X, 8, b.y - OFF_Y);
      m.rotation.y = -b.angle;
    }
    for (const [b, m] of [...bulletMeshes]) {
      if (!liveBullets.has(b)) {
        scene.remove(m);
        bulletMeshes.delete(b);
      }
    }

    // Particles: smoke as lit instanced spheres, sparks/muzzle as unlit points.
    const smokeList = [];
    let sparkCount = 0;
    const sparkColor = new THREE.Color();
    for (const pt of game.particles) {
      if (pt.kind === 'smoke') {
        if (smokeList.length < SMOKE_MAX) smokeList.push(pt);
      } else if (sparkCount < SPARK_MAX) {
        sparkPos[sparkCount * 3] = pt.x - OFF_X;
        sparkPos[sparkCount * 3 + 1] = pt.z || 4;
        sparkPos[sparkCount * 3 + 2] = pt.y - OFF_Y;
        sparkColor.set(pt.color || '#ffcc33');
        sparkCol[sparkCount * 3] = sparkColor.r;
        sparkCol[sparkCount * 3 + 1] = sparkColor.g;
        sparkCol[sparkCount * 3 + 2] = sparkColor.b;
        sparkCount++;
      }
    }
    smokeList.forEach((pt, i) => {
      const grow = 1.5 - (pt.life / (pt.maxLife || pt.life)) * 0.5;
      dummy.position.set(pt.x - OFF_X, pt.z || 10, pt.y - OFF_Y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.01, (pt.size || 8) * grow));
      dummy.updateMatrix();
      smokeMesh.setMatrixAt(i, dummy.matrix);
    });
    for (let i = smokeList.length; i < SMOKE_MAX; i++) {
      dummy.position.set(0, -100, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      smokeMesh.setMatrixAt(i, dummy.matrix);
    }
    smokeMesh.instanceMatrix.needsUpdate = true;
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    sparkGeo.setDrawRange(0, sparkCount);

    // Waypoint ring + beam on the current objective.
    const target = currentTarget(game);
    if (target) {
      waypoint.visible = true;
      waypoint.position.set(target.x - OFF_X, 0, target.y - OFF_Y);
      const pulse = 1 + Math.sin(clock * 4) * 0.15;
      ring.scale.set(pulse, pulse, 1);
      beam.material.opacity = 0.13 + Math.sin(clock * 4) * 0.05;
    } else {
      waypoint.visible = false;
    }

    // Drift dust: renderer-local, at the player's rear wheels when the
    // car slides sideways fast.
    dustTimer -= dt;
    for (const d of dustPool) {
      if (d.life > 0) {
        d.life -= dt;
        const k = 1 - d.life / d.maxLife;
        d.sprite.material.opacity = Math.max(0, 0.7 * (1 - k));
        const s = d.size * (1 + k * 1.6);
        d.sprite.scale.set(s, s, 1);
        d.sprite.position.y += dt * 12;
        if (d.life <= 0) d.sprite.visible = false;
      }
    }
    if (!p.onFoot && p.car && dustTimer <= 0) {
      const car = p.car;
      const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
      const lat = Math.abs(car.vx * -fy + car.vy * fx);
      if (lat > 140 && (car.speed || 0) > 150) {
        dustTimer = 0.06;
        const m = CAR_MODELS[car.model] || CAR_MODELS.sedan;
        for (const s of [-1, 1]) {
          const d = dustPool.find((dd) => dd.life <= 0);
          if (!d) break;
          const rx = car.x - fx * (m.len / 2 - 10) - fy * s * (m.wid / 2);
          const ry = car.y - fy * (m.len / 2 - 10) + fx * s * (m.wid / 2);
          d.sprite.position.set(rx - OFF_X, 6, ry - OFF_Y);
          d.sprite.visible = true;
          d.life = d.maxLife = 0.7;
          d.size = 16;
          d.sprite.material.opacity = 0.7;
          d.sprite.scale.set(16, 16, 1);
        }
      }
    }

    // ---- chase camera: exponential smooth follow + trauma shake --------
    const px = p.x - OFF_X, pz = p.y - OFF_Y;
    const inCar = !p.onFoot && p.car;
    const dist = inCar ? 300 : 190;
    const height = inCar ? 130 : 100;
    const backX = px - Math.cos(p.angle) * dist;
    const backZ = pz - Math.sin(p.angle) * dist;
    const lookX = px + Math.cos(p.angle) * 60;
    const lookZ = pz + Math.sin(p.angle) * 60;
    const lookY = 30;
    if (!snapped) {
      smoothPos.set(backX, height, backZ);
      smoothLook.set(lookX, lookY, lookZ);
      snapped = true;
    } else {
      const t = 1 - Math.exp(-5 * dt);
      smoothPos.x += (backX - smoothPos.x) * t;
      smoothPos.y += (height - smoothPos.y) * t;
      smoothPos.z += (backZ - smoothPos.z) * t;
      const t2 = 1 - Math.exp(-8 * dt);
      smoothLook.x += (lookX - smoothLook.x) * t2;
      smoothLook.y += (lookY - smoothLook.y) * t2;
      smoothLook.z += (lookZ - smoothLook.z) * t2;
    }
    // Trauma-squared summed-sine shake with a slight roll, riding on
    // top of the smooth follow (trauma comes from the logic layer).
    const trauma = (game.camera && game.camera.shake) || 0;
    const shake = trauma * trauma;
    const st = clock * 30;
    const ox = 14 * shake * Math.sin(st * 1.7);
    const oy = 9 * shake * Math.sin(st * 2.3);
    const roll = 0.05 * shake * Math.sin(st * 1.1);
    camera.position.set(smoothPos.x + ox, smoothPos.y + oy, smoothPos.z);
    camera.lookAt(smoothLook);
    camera.rotateZ(roll);
    // FOV kick with speed: 62 cruising, ~68 at top speed in a car.
    let fovTarget = 62;
    if (inCar && p.car) {
      const m = CAR_MODELS[p.car.model] || CAR_MODELS.sedan;
      fovTarget = 62 + 6 * Math.min(1, (p.car.speed || 0) / m.topSpeed);
    }
    if (Math.abs(fovTarget - fov) > 0.01) {
      fov += (fovTarget - fov) * Math.min(1, dt * 4);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // The sun follows the player so shadows stay crisp nearby.
    sun.position.set(px - 700, 650, pz + 350);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  function screenToGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!hit) return null;
    return { x: hit.x + OFF_X, y: hit.z + OFF_Y };
  }

  function projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x - OFF_X, z || 0, y - OFF_Y).project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
      behind: v.z > 1,
      visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    };
  }

  function getStats() {
    const info = renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    renderer.dispose();
  }

  // Forget the smoothed camera position so the next sync snaps to the
  // player (used after a restart / respawn teleport).
  function snapCamera() {
    snapped = false;
  }

  resize();
  return {
    buildCity, sync, screenToGround, projectToScreen,
    getStats, resize, dispose, snapCamera,
    scene, camera, renderer,
  };
}
