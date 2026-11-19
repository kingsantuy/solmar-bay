// Solmar Bay — 3D presentation layer (three.js r160, vendored, no network).
// Builds the city once from game.city, then keeps a mesh per car / ped /
// bullet / particle and a smoothed chase camera. World coords: x east
// 0..4800, y south 0..3600. Three.js: (x - 2400, 0, y - 1800), y-up.
// A world heading angle (0 = east, increasing clockwise in the plane)
// maps to mesh rotation.y = -angle.
import * as THREE from '../vendor/three.module.min.js';

const WORLD_W = 4800;
const WORLD_H = 3600;
const CX = WORLD_W / 2;
const CY = WORLD_H / 2;

// Camera distances are scaled to the 4800-unit world: a car is ~48 long,
// so the spec's "16/7" would put the lens inside the car. Same framing,
// world-scale numbers.
const CAM_DRIVE = { dist: 150, height: 62, ahead: 90 };
const CAM_FOOT = { dist: 130, height: 62, ahead: 70 };

const toX = (x) => x - CX;
const toZ = (y) => y - CY;
const toWorld = (tx, tz) => ({ x: tx + CX, y: tz + CY });

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textSprite(text, color = '#ffd76a') {
  const tex = canvasTexture(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 52px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(20,16,10,0.85)';
    g.strokeText(text, w / 2, h / 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(220, 41, 1);
  return s;
}

// Shared unit geometries — one box / cylinder reused everywhere.
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  ring: new THREE.RingGeometry(0.85, 1, 40),
  plane: new THREE.PlaneGeometry(1, 1),
};

const MATS = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!MATS[key]) MATS[key] = new THREE.MeshLambertMaterial({ color, ...opts });
  return MATS[key];
}
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(GEO.box, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

const CAR_COLORS = {
  sedan: 0xc94f4f, taxi: 0xf2c230, sport: 0xe5322d, truck: 0x8a8f96,
  van: 0xe5e0d0, police: 0x20242c, classic: 0x7db8a0,
};
const MODEL_LEN = { sedan: 48, taxi: 48, sport: 46, truck: 64, van: 56, police: 48, classic: 48 };
const MODEL_WID = { sedan: 24, taxi: 24, sport: 22, truck: 26, van: 26, police: 24, classic: 24 };

// One low-poly figure: torso, head, legs. Shirt colour varies per ped.
const figureGeo = { torso: new THREE.BoxGeometry(13, 16, 8), head: new THREE.BoxGeometry(9, 9, 9), leg: new THREE.BoxGeometry(4, 12, 5) };
const figureMats = { skin: mat(0xd9a077), dark: mat(0x2e3440), red: mat(0xc0392b) };
function makeFigure(shirtColor) {
  const g = new THREE.Group();
  const shirt = mat(shirtColor);
  const torso = new THREE.Mesh(figureGeo.torso, shirt);
  torso.position.y = 18;
  torso.castShadow = true;
  const head = new THREE.Mesh(figureGeo.head, figureMats.skin);
  head.position.y = 30;
  head.castShadow = true;
  const legL = new THREE.Mesh(figureGeo.leg, figureMats.dark);
  legL.position.set(0, 6, -3.5);
  const legR = new THREE.Mesh(figureGeo.leg, figureMats.dark);
  legR.position.set(0, 6, 3.5);
  g.add(torso, head, legL, legR);
  g.userData.legs = [legL, legR];
  return g;
}

function makeCarMesh(car) {
  const g = new THREE.Group();
  const len = MODEL_LEN[car.model] || 48;
  const wid = MODEL_WID[car.model] || 24;
  const color = car.color || ('#' + (CAR_COLORS[car.model] || 0x888888).toString(16).padStart(6, '0'));
  const bodyMat = mat(color);
  const body = box(len, 9, wid, bodyMat, 0, 6, 0);
  body.castShadow = true;
  g.add(body);
  const cabinLen = len * (car.model === 'truck' ? 0.28 : 0.5);
  const cabin = box(cabinLen, 8, wid * 0.8, mat(0x1c2733), car.model === 'truck' ? len * 0.28 : -len * 0.05, 14, 0);
  cabin.castShadow = true;
  g.add(cabin);
  if (car.model === 'truck') {
    const bed = box(len * 0.55, 7, wid * 0.9, mat(0x6a6f76), -len * 0.2, 12, 0);
    g.add(bed);
  }
  // Wheels: cylinders rotated so their axis is across the car (z).
  const wheelGeo = new THREE.CylinderGeometry(5.5, 5.5, 4, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = mat(0x14161a);
  const wheels = [];
  const wx = len * 0.32;
  const wz = wid / 2;
  for (const [sx, sz] of [[wx, wz], [wx, -wz], [-wx, wz], [-wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(sx, 5.5, sz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.frontWheels = [wheels[0], wheels[1]];
  if (car.model === 'police' || car.kind === 'police') {
    const bar = box(10, 3, wid * 0.7, mat(0xdddddd), -2, 20, 0);
    const red = box(4.5, 3.5, wid * 0.72, new THREE.MeshLambertMaterial({ color: 0xcc1111, emissive: 0xff0000, emissiveIntensity: 1 }), -4.5, 20, 0);
    const blue = box(4.5, 3.5, wid * 0.72, new THREE.MeshLambertMaterial({ color: 0x1111cc, emissive: 0x0000ff, emissiveIntensity: 1 }), 0.5, 20, 0);
    g.add(bar, red, blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  if (car.model === 'taxi') {
    const sign = box(12, 4, 8, new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0xaa8800, emissiveIntensity: 0.6 }), -2, 21, 0);
    g.add(sign);
  }
  // Headlights (front, +x) and tail lights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  const tl = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0xcc0000, emissiveIntensity: 0.7 });
  g.add(box(2, 3, 5, hl, len / 2, 7, wid / 2 - 4));
  g.add(box(2, 3, 5, hl, len / 2, 7, -wid / 2 + 4));
  g.add(box(2, 3, 5, tl, -len / 2, 7, wid / 2 - 4));
  g.add(box(2, 3, 5, tl, -len / 2, 7, -wid / 2 + 4));
  return g;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9e66);
  scene.fog = new THREE.Fog(0xf2a06e, 500, 2100);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6000);
  camera.position.set(0, 120, 200);

  // Sunset lighting: low warm sun from the west, soft sky fill.
  const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x51603e, 0.9);
  scene.add(hemi);

  let cityGroup = null;
  let marker = null;
  let markerBeam = null;
  const carMeshes = new Map();
  let pedMeshes = [];
  let playerMesh = null;
  let heliGroup = null;
  let heliRotor = null;
  let heliLight = null;
  const bulletMeshes = new Map();
  let particleMeshes = [];
  const camPos = new THREE.Vector3(0, 120, 200);
  const camLook = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let built = false;
  let lastAngle = 0;
  let needSnap = true;

  function disposeGroup(group) {
    if (!group) return;
    group.traverse((o) => {
      if (o.geometry && o.geometry !== GEO.box && o.geometry !== GEO.cyl &&
        o.geometry !== GEO.cone && o.geometry !== GEO.sphere && o.geometry !== GEO.ring && o.geometry !== GEO.plane) {
        o.geometry.dispose();
      }
    });
    scene.remove(group);
  }

  function buildCity(game) {
    if (cityGroup) disposeGroup(cityGroup);
    if (marker) { scene.remove(marker); marker = null; }
    if (markerBeam) { scene.remove(markerBeam); markerBeam = null; }
    cityGroup = new THREE.Group();
    const city = game.city || {};
    const roadsV = city.roadsV || [420, 980, 1540, 2100, 2660, 3220, 3780, 4340];
    const roadsH = city.roadsH || [420, 980, 1540, 2100, 2660, 3220];
    const roadW = city.roadW || 116;
    const sidewalk = city.sidewalk || 26;
    const seaX = city.seaX ?? 110;
    const beachX1 = city.beachX1 ?? 300;

    // Ground: grass, then sea (west), sand strip, parks, lots.
    const ground = new THREE.Mesh(GEO.plane, mat(0x5d8a4a));
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(WORLD_W, WORLD_H, 1);
    ground.receiveShadow = true;
    cityGroup.add(ground);

    const sea = new THREE.Mesh(GEO.plane, new THREE.MeshLambertMaterial({ color: 0x2f6f8f }));
    sea.rotation.x = -Math.PI / 2;
    sea.scale.set(seaX, WORLD_H, 1);
    sea.position.set(toX(seaX / 2), -0.4, 0);
    cityGroup.add(sea);
    const sand = new THREE.Mesh(GEO.plane, mat(0xd9b380));
    sand.rotation.x = -Math.PI / 2;
    sand.scale.set(beachX1 - seaX, WORLD_H, 1);
    sand.position.set(toX((seaX + beachX1) / 2), 0.05, 0);
    sand.receiveShadow = true;
    cityGroup.add(sand);

    for (const p of city.parks || []) {
      const d = p.d ?? p.h;
      const m = new THREE.Mesh(GEO.plane, mat(0x4e7d3c));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(p.w, d, 1);
      // City rects are centre-based (x, y = centre).
      m.position.set(toX(p.x), 0.08, toZ(p.y));
      m.receiveShadow = true;
      cityGroup.add(m);
    }
    for (const l of city.lots || []) {
      const d = l.d ?? l.h;
      const m = new THREE.Mesh(GEO.plane, mat(0x777777));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(l.w, d, 1);
      m.position.set(toX(l.x), 0.08, toZ(l.y));
      m.receiveShadow = true;
      cityGroup.add(m);
    }

    // Roads: sidewalk slab, then asphalt with a dashed yellow centre line
    // (one shared canvas texture, repeated along the road length).
    const roadTex = canvasTexture(64, 128, (g, w, h) => {
      g.fillStyle = '#33333a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a13a';
      g.fillRect(w / 2 - 2, 8, 4, 44);
      g.fillRect(w / 2 - 2, 72, 4, 44);
    });
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    const swMat = mat(0x9a9a92);
    for (const x of roadsV) {
      const sw = new THREE.Mesh(GEO.plane, swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.scale.set(roadW + sidewalk * 2, WORLD_H, 1);
      sw.position.set(toX(x), 0.1, 0);
      sw.receiveShadow = true;
      cityGroup.add(sw);
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, WORLD_H / 128);
      const road = new THREE.Mesh(GEO.plane, new THREE.MeshLambertMaterial({ map: tex }));
      road.rotation.x = -Math.PI / 2;
      road.scale.set(roadW, WORLD_H, 1);
      road.position.set(toX(x), 0.15, 0);
      road.receiveShadow = true;
      cityGroup.add(road);
    }
    for (const y of roadsH) {
      const sw = new THREE.Mesh(GEO.plane, swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.scale.set(WORLD_W, roadW + sidewalk * 2, 1);
      sw.position.set(0, 0.1, toZ(y));
      sw.receiveShadow = true;
      cityGroup.add(sw);
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, WORLD_W / 128);
      const road = new THREE.Mesh(GEO.plane, new THREE.MeshLambertMaterial({ map: tex }));
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = Math.PI / 2;
      road.scale.set(roadW, WORLD_W, 1);
      road.position.set(0, 0.15, toZ(y));
      road.receiveShadow = true;
      cityGroup.add(road);
    }

    // Buildings: shared unit box + one window texture, tinted per building.
    const winTex = canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c3a4a';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 4; c++) {
          g.fillRect(12 + c * 28, 14 + r * 30, 16, 18);
        }
      }
    });
    const bmatCache = new Map();
    const bmat = (color) => {
      if (!bmatCache.has(color)) {
        bmatCache.set(color, new THREE.MeshLambertMaterial({ map: winTex, color }));
      }
      return bmatCache.get(color);
    };
    const roofMat = mat(0x6b5a4a);
    for (const b of city.buildings || []) {
      const depth = b.d ?? b.h; // new shape: d = footprint depth; old: h = depth
      const height = b.d !== undefined ? (b.h || 40) : ((b.floors || 3) * 16);
      const m = new THREE.Mesh(GEO.box, bmat(b.color || '#c96f4a'));
      m.scale.set(b.w, height, depth);
      m.position.set(toX(b.x), height / 2, toZ(b.y));
      m.castShadow = true;
      m.receiveShadow = true;
      cityGroup.add(m);
      const roof = new THREE.Mesh(GEO.plane, roofMat);
      roof.rotation.x = -Math.PI / 2;
      roof.scale.set(b.w + 2, depth + 2, 1);
      roof.position.set(toX(b.x), height + 0.2, toZ(b.y));
      cityGroup.add(roof);
    }

    // Trees (instanced trunks + canopies) and lamps (instanced poles + heads).
    const trees = city.trees || [];
    if (trees.length) {
      const trunkGeo = new THREE.CylinderGeometry(2.5, 3.5, 22, 6);
      const canopyGeo = new THREE.ConeGeometry(11, 26, 7);
      const trunkMat = mat(0x6b4a2f);
      const canopyMat = mat(0x3f7031);
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length);
      const dummy = new THREE.Object3D();
      trees.forEach((t, i) => {
        // Real city trees carry s as a scale factor (0.8–1.3); older
        // shapes carried a radius (9–15) — normalise both to a scale.
        const raw = t.s ?? t.r ?? 12;
        const s = raw <= 3 ? raw : raw / 12;
        const palm = t.x < 420;
        dummy.position.set(toX(t.x), palm ? 16 * s : 11 * s, toZ(t.y));
        dummy.scale.set(s, palm ? 1.5 * s : s, s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(toX(t.x), (palm ? 38 : 30) * s, toZ(t.y));
        dummy.updateMatrix();
        canopies.setMatrixAt(i, dummy.matrix);
      });
      trunks.castShadow = true;
      canopies.castShadow = true;
      cityGroup.add(trunks, canopies);
    }
    const lamps = city.lamps || [];
    if (lamps.length) {
      const poleGeo = new THREE.CylinderGeometry(1.5, 1.5, 34, 6);
      const headGeo = new THREE.SphereGeometry(3, 8, 6);
      const poles = new THREE.InstancedMesh(poleGeo, mat(0x2a2e33), lamps.length);
      const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.8 }), lamps.length);
      const dummy = new THREE.Object3D();
      lamps.forEach((l, i) => {
        dummy.position.set(toX(l.x), 17, toZ(l.y));
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
        dummy.position.set(toX(l.x), 35, toZ(l.y));
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      });
      cityGroup.add(poles, heads);
    }

    // Marina pier: wooden planks.
    const pier = city.pier || (city.landmarks && city.landmarks.pier
      ? { x: city.landmarks.pier.x, y: city.landmarks.pier.y, w: 140, d: 90 } : null);
    if (pier) {
      const d = pier.d ?? pier.h ?? 90;
      const m = new THREE.Mesh(GEO.plane, mat(0x8a6a44));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(pier.w, d, 1);
      m.position.set(toX(pier.x), 0.3, toZ(pier.y));
      m.receiveShadow = true;
      cityGroup.add(m);
    }

    // Port containers: coloured boxes.
    const cmap = new Map();
    for (const c of city.containers || []) {
      const d = c.d ?? c.h ?? 26;
      const key = c.color || '#c9563c';
      if (!cmap.has(key)) cmap.set(key, mat(key));
      const m = new THREE.Mesh(GEO.box, cmap.get(key));
      m.scale.set(c.w, 12, d);
      m.position.set(toX(c.x), 6, toZ(c.y));
      m.castShadow = true;
      cityGroup.add(m);
    }

    // Lighthouse: striped red-white cylinder + lamp.
    const lh = city.lighthouse || (city.landmarks && city.landmarks.lighthouse);
    if (lh) {
      const stripeTex = canvasTexture(64, 128, (g, w, h) => {
        for (let i = 0; i < 4; i++) {
          g.fillStyle = i % 2 ? '#e5322d' : '#f2ede2';
          g.fillRect(0, (i * h) / 4, w, h / 4);
        }
      });
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 20, 130, 12),
        new THREE.MeshLambertMaterial({ map: stripeTex }),
      );
      tower.position.set(toX(lh.x), 65, toZ(lh.y));
      tower.castShadow = true;
      cityGroup.add(tower);
      const lamp = new THREE.Mesh(GEO.sphere, new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe27a, emissiveIntensity: 1.5 }));
      lamp.scale.set(16, 16, 16);
      lamp.position.set(toX(lh.x), 136, toZ(lh.y));
      cityGroup.add(lamp);
    }

    // Landmark name signs above the hotel and Police HQ.
    const lm = city.landmarks || {};
    const sign = (key, text) => {
      const p = lm[key];
      if (!p) return;
      const b = (city.buildings || []).find((bb) => bb.landmark === key);
      const top = b ? ((b.d !== undefined ? (b.h || 40) : ((b.floors || 3) * 16)) + 30) : 120;
      const s = textSprite(text);
      s.position.set(toX(p.x), top, toZ(p.y));
      cityGroup.add(s);
    };
    sign('hotel', 'GRAND SOLMAR HOTEL');
    sign('policehq', 'POLICE HQ');

    scene.add(cityGroup);

    // Snap the chase camera on the next sync (no swoop from the origin).
    needSnap = true;

    // Mission waypoint: pulsing ring + light beam, repositioned each frame.
    marker = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xffd21a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    marker.rotation.x = -Math.PI / 2;
    marker.scale.set(46, 46, 1);
    marker.visible = false;
    scene.add(marker);
    markerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 300, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    markerBeam.visible = false;
    scene.add(markerBeam);

    built = true;
  }

  function missionTarget(game) {
    const m = game.mission;
    if (m && m.active !== false && m.def && m.def.steps) {
      const s = m.def.steps[Math.min(m.step || 0, m.def.steps.length - 1)];
      if (s) return { x: s.x, y: s.y };
    }
    if (game.taxi && game.taxi.active) {
      const t = game.taxi;
      if (t.state === 'toClient' && t.client) return { x: t.client.x, y: t.client.y };
      if (t.destX !== undefined) return { x: t.destX, y: t.destY };
    }
    return null;
  }

  function syncCarMesh(car, dt, time) {
    let g = carMeshes.get(car.id);
    if (!g) {
      g = makeCarMesh(car);
      carMeshes.set(car.id, g);
      scene.add(g);
      g.userData.prevAngle = car.angle;
    }
    g.position.set(toX(car.x), 0, toZ(car.y));
    g.rotation.y = -car.angle;
    const speed = car.speed || 0;
    const spin = (speed * dt) / 5.5;
    for (const w of g.userData.wheels) w.rotation.z += spin;
    const turn = car.angle - (g.userData.prevAngle ?? car.angle);
    g.userData.prevAngle = car.angle;
    const steer = Math.max(-0.4, Math.min(0.4, turn * 8));
    for (const w of g.userData.frontWheels) w.rotation.y = steer;
    // Police light bar flash.
    if (g.userData.lightRed) {
      const on = Math.floor(time * 4) % 2 === 0;
      g.userData.lightRed.material.emissiveIntensity = on ? 2.2 : 0.15;
      g.userData.lightBlue.material.emissiveIntensity = on ? 0.15 : 2.2;
      g.userData.lightRed.visible = on;
      g.userData.lightBlue.visible = !on;
    }
    // Damage smoke is handled by particles from the logic layer.
    return g;
  }

  function sync(game, dt) {
    if (!built) buildCity(game);
    const p = game.player || {};
    const time = game.time || 0;

    // Cars: create / dispose by id.
    const seen = new Set();
    for (const car of game.cars || []) {
      if (car.id === undefined) car.id = 'c' + (car.x | 0) + '_' + (car.y | 0);
      seen.add(car.id);
      syncCarMesh(car, dt, time);
    }
    for (const [id, g] of carMeshes) {
      if (!seen.has(id)) {
        scene.remove(g);
        carMeshes.delete(id);
      }
    }

    // Player on foot: low-poly figure in a red jacket; hidden while driving.
    const onFoot = p.onFoot !== undefined ? p.onFoot : !p.car;
    if (!playerMesh) {
      playerMesh = makeFigure(0xc0392b);
      scene.add(playerMesh);
    }
    playerMesh.visible = !!onFoot;
    if (onFoot) {
      playerMesh.position.set(toX(p.x), 0, toZ(p.y));
      playerMesh.rotation.y = -p.angle;
      const walk = p.moving ? Math.sin(time * 14) * 0.5 : 0;
      playerMesh.userData.legs[0].rotation.x = walk;
      playerMesh.userData.legs[1].rotation.x = -walk;
    }

    // Pedestrians, matched by index (peds carry no id).
    const peds = game.peds || [];
    while (pedMeshes.length < peds.length) {
      const m = makeFigure(0x7a8a99);
      scene.add(m);
      pedMeshes.push(m);
    }
    while (pedMeshes.length > peds.length) {
      const m = pedMeshes.pop();
      scene.remove(m);
    }
    peds.forEach((ped, i) => {
      const m = pedMeshes[i];
      m.position.set(toX(ped.x), 0, toZ(ped.y));
      m.rotation.y = -ped.angle;
      const shirt = ped.color || '#7a8a99';
      if (m.userData.shirtColor !== shirt) {
        m.userData.shirtColor = shirt;
        m.children[0].material = mat(shirt);
      }
      const walk = ped.state === 'walk' && ped.speed ? Math.sin(time * 10 + i) * 0.4 : 0;
      m.userData.legs[0].rotation.x = walk;
      m.userData.legs[1].rotation.x = -walk;
    });

    // Police helicopter.
    const heli = game.heli || {};
    if (heli.active) {
      if (!heliGroup) {
        heliGroup = new THREE.Group();
        const body = box(34, 12, 16, mat(0x20242c), 0, 0, 0);
        body.castShadow = true;
        const tail = box(26, 6, 6, mat(0x20242c), -28, 2, 0);
        heliGroup.add(body, tail);
        heliRotor = box(56, 1.5, 4, mat(0x888888), 0, 9, 0);
        heliGroup.add(heliRotor);
        heliLight = new THREE.Mesh(
          new THREE.ConeGeometry(26, 130, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
        );
        heliLight.position.set(0, -70, 0);
        heliLight.rotation.x = Math.PI;
        heliGroup.add(heliLight);
        scene.add(heliGroup);
      }
      heliGroup.visible = true;
      heliGroup.position.set(toX(heli.x), heli.z || 120, toZ(heli.y));
      heliGroup.rotation.y = -(heli.angle || 0);
      if (heliRotor) heliRotor.rotation.y += dt * 28;
    } else if (heliGroup) {
      heliGroup.visible = false;
    }

    // Bullets: small glowing tracers.
    const bullets = game.bullets || [];
    const bseen = new Set();
    bullets.forEach((b, i) => {
      const key = 'b' + i;
      bseen.add(key);
      let m = bulletMeshes.get(key);
      if (!m) {
        m = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: b.from === 'police' ? 0xff5533 : 0xffe27a }));
        bulletMeshes.set(key, m);
        scene.add(m);
      }
      m.position.set(toX(b.x), 14, toZ(b.y));
      m.rotation.y = -b.angle;
      m.scale.set(14, 2, 2);
    });
    for (const [key, m] of bulletMeshes) {
      if (!bseen.has(key)) {
        scene.remove(m);
        bulletMeshes.delete(key);
      }
    }

    // Particles: small boxes, pooled by index, shrinking with life.
    const parts = game.particles || [];
    while (particleMeshes.length < parts.length) {
      const m = new THREE.Mesh(GEO.box, mat(0x999999));
      scene.add(m);
      particleMeshes.push(m);
    }
    while (particleMeshes.length > parts.length) {
      scene.remove(particleMeshes.pop());
    }
    parts.forEach((pt, i) => {
      const m = particleMeshes[i];
      const f = Math.max(0.05, (pt.life || 0) / (pt.maxLife || 1));
      const size = (pt.size || 8) * (pt.kind === 'smoke' ? 2 - f : f);
      m.material = mat(pt.color || (pt.kind === 'spark' ? '#ffaa33' : '#999999'));
      m.position.set(toX(pt.x), pt.z || 10, toZ(pt.y));
      m.scale.set(size, size, size);
    });

    // Mission waypoint ring + beam.
    const target = missionTarget(game);
    if (marker) {
      if (target) {
        marker.visible = true;
        markerBeam.visible = true;
        const pulse = 1 + Math.sin(time * 4) * 0.12;
        marker.position.set(toX(target.x), 2, toZ(target.y));
        marker.scale.set(46 * pulse, 46 * pulse, 1);
        markerBeam.position.set(toX(target.x), 150, toZ(target.y));
      } else {
        marker.visible = false;
        markerBeam.visible = false;
      }
    }

    // Chase camera: behind the player, smoothed, with shake.
    const focusX = p.x ?? CX;
    const focusY = p.y ?? CY;
    const angle = p.angle || 0;
    const cam = onFoot ? CAM_FOOT : CAM_DRIVE;
    const backX = focusX - Math.cos(angle) * cam.dist;
    const backY = focusY - Math.sin(angle) * cam.dist;
    if (needSnap) {
      camPos.set(toX(backX), cam.height, toZ(backY));
      needSnap = false;
    }
    const k = 1 - Math.exp(-dt * 5);
    camPos.x += (toX(backX) - camPos.x) * k;
    camPos.y += (cam.height - camPos.y) * k;
    camPos.z += (toZ(backY) - camPos.z) * k;
    const shake = game.camera ? (game.camera.shake || 0) : 0;
    const shX = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    const shY = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    camera.position.set(camPos.x + shX, camPos.y + shY, camPos.z);
    camLook.set(
      toX(focusX + Math.cos(angle) * cam.ahead),
      6,
      toZ(focusY + Math.sin(angle) * cam.ahead),
    );
    camera.lookAt(camLook);

    // Sun follows the player so shadows stay tight around the action.
    sun.position.set(toX(focusX) - 260, 300, toZ(focusY) - 140);
    sun.target.position.set(toX(focusX), 0, toZ(focusY));
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  function screenToGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin;
    const d = raycaster.ray.direction;
    if (Math.abs(d.y) < 1e-6) return { x: CX, y: CY };
    const t = -o.y / d.y;
    if (t < 0) return { x: CX, y: CY };
    tmpV.copy(o).addScaledVector(d, t);
    const w = toWorld(tmpV.x, tmpV.z);
    return {
      x: Math.max(0, Math.min(WORLD_W, w.x)),
      y: Math.max(0, Math.min(WORLD_H, w.y)),
    };
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    renderer.dispose();
    if (cityGroup) disposeGroup(cityGroup);
  }

  return { buildCity, sync, screenToGround, resize, dispose };
}
