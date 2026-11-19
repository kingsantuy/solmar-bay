import * as THREE from '../vendor/three.module.js';
import { CONFIG, CAR_MODELS } from './config.js';
import { loadAll, get, has, ready } from './models.js';
const OX = 2400, OZ = 1800, TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function hashRnd(seed) { let s = (seed * 7919 + 13) >>> 0; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  window.__solmarModelsReady = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe08a6a, 900, 2600);
  const camera = new THREE.PerspectiveCamera(62, 1, 10, 9000);
  const sunDir = new THREE.Vector3(-0.88, 0.30, 0.36).normalize();
  const sun = new THREE.DirectionalLight(0xff8c3a, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -750; sun.shadow.camera.right = 750;
  sun.shadow.camera.top = 750; sun.shadow.camera.bottom = -750;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 4500;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xffb08a, 0x6a4a3a, 0.55));
  function skyCanvas() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5a3a6e'); gr.addColorStop(0.42, '#c65a6e');
    gr.addColorStop(0.68, '#ff7e4a'); gr.addColorStop(0.85, '#ffb347');
    gr.addColorStop(1, '#ffcf8a');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const skyTex = skyCanvas();
  const skyGroup = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  skyGroup.add(dome);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(300, 32), new THREE.MeshBasicMaterial({ color: 0xff8c3a, fog: false }));
  sunDisc.position.set(-4200, 380, 0); sunDisc.lookAt(0, 380, 0);
  skyGroup.add(sunDisc);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(750, 32), new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.32, fog: false }));
  glow.position.set(-4210, 380, 0); glow.lookAt(0, 380, 0);
  skyGroup.add(glow);
  scene.add(skyGroup);
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
  const envGround = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x8a6a4a }));
  envGround.rotation.x = -Math.PI / 2; envGround.position.y = -10;
  envScene.add(envGround);
  scene.environment = pm.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.35;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let city = null;
  let time = 0;
  let applied = false;
  let snapped = false;
  let orbitA = 0;
  const camPos = new THREE.Vector3(0, 400, 1500);
  const lookPt = new THREE.Vector3(0, 0, 0);
  const carMeshes = new Map();
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);
  let buildingMeshes = [];
  let hotelProc = null;
  let procPalms = null;
  let glbPalms = null;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const eul = new THREE.Euler();
  function inst(geo, mat, mats4) {
    const im = new THREE.InstancedMesh(geo, mat, mats4.length);
    for (let i = 0; i < mats4.length; i++) {
      const m = mats4[i];
      eul.set(m.rx || 0, m.ry || 0, m.rz || 0); tmpQ.setFromEuler(eul);
      tmpV.set(m.x, m.y || 0, m.z); tmpS.set(m.sx || 1, m.sy || 1, m.sz || 1);
      tmpM.compose(tmpV, tmpQ, tmpS); im.setMatrixAt(i, tmpM);
      if (m.color) im.setColorAt(i, new THREE.Color(m.color));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    return im;
  }
  function flat(w, d, color, y) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
    return m;
  }
  function winTex(hex, lit, seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, 128, 256);
    const e = document.createElement('canvas'); e.width = 128; e.height = 256;
    const ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
    const rnd = hashRnd(seed);
    for (let r = 0; r < 10; r++) for (let col = 0; col < 5; col++) {
      const x = 8 + col * 24, y = 8 + r * 24;
      const on = rnd() < lit;
      g.fillStyle = on ? '#4a3423' : '#232a33'; g.fillRect(x, y, 15, 13);
      if (on) { ge.fillStyle = '#ffb347'; ge.fillRect(x, y, 15, 13); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const et = new THREE.CanvasTexture(e); et.colorSpace = THREE.SRGBColorSpace;
    return { map: t, emissive: et };
  }
  function textTex(text, w, h, font, fg, bg, border) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function stripeTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#e5322d';
    for (let x = -64; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 0); g.lineTo(x + 64, 0); g.lineTo(x + 32, 64); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2;
    return t;
  }
  function buildBuildings(exclude) {
    for (const m of buildingMeshes) { cityGroup.remove(m); m.dispose(); }
    buildingMeshes = [];
    const groups = new Map();
    for (let i = 0; i < city.buildings.length; i++) {
      const b = city.buildings[i];
      if (b.landmark === 'hotel' || b.landmark === 'lighthouse' || (exclude && exclude.has(i))) continue;
      const key = b.color * 3 + b.variant;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ x: b.x - OX, y: (b.floors * 12) / 2, z: b.y - OZ, sx: b.w, sy: b.floors * 12, sz: b.d });
    }
    const roofMats = [];
    for (const [key, list] of groups) {
      const color = CONFIG.wallColors[Math.floor(key / 3)];
      const variant = key % 3;
      const lit = [0.65, 0.5, 0.78][variant];
      const wt = winTex(color, lit, key + 1);
      const mat = new THREE.MeshStandardMaterial({ map: wt.map, emissiveMap: wt.emissive, emissive: 0xff9a3c, emissiveIntensity: 1.3, roughness: 0.85, metalness: 0.05 });
      const im = inst(boxGeo, mat, list);
      cityGroup.add(im); buildingMeshes.push(im);
      for (const m of list) roofMats.push({ x: m.x, y: m.sy + 1.5, z: m.z, sx: m.sx + 6, sy: 3, sz: m.sz + 6 });
    }
    if (roofMats.length) {
      const rm = inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95 }), roofMats);
      cityGroup.add(rm); buildingMeshes.push(rm);
    }
  }
  function procCarMesh(car) {
    const m = CAR_MODELS[car.model] || CAR_MODELS.sedan;
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: car.color, roughness: 0.35, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(m.len, 12, m.wid), paint);
    body.position.y = 7; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(m.len * 0.45, 9, m.wid * 0.78), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.12, metalness: 0.2 }));
    cabin.position.set(-m.len * 0.04, 16, 0); cabin.castShadow = true; g.add(cabin);
    if (car.model === 'truck') {
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(m.len * 0.55, 18, m.wid * 0.92), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7 }));
      cargo.position.set(-m.len * 0.18, 17, 0); cargo.castShadow = true; g.add(cargo);
    }
    const wheels = [], fronts = [];
    const wg = new THREE.CylinderGeometry(8, 8, 5, 12);
    const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    for (const [wx, wz, front] of [[m.len * 0.32, m.wid / 2 - 2, true], [m.len * 0.32, -m.wid / 2 + 2, true], [-m.len * 0.32, m.wid / 2 - 2, false], [-m.len * 0.32, -m.wid / 2 + 2, false]]) {
      const wrap = new THREE.Group();
      wrap.position.set(wx, 8, wz);
      const wm2 = new THREE.Mesh(wg, wm);
      wm2.rotation.x = Math.PI / 2; wm2.castShadow = true;
      wrap.add(wm2); g.add(wrap); wheels.push(wrap);
      if (front) fronts.push(wrap);
    }
    return { grp: g, wheels, front: fronts, lights: null, prevAngle: car.angle, steer: 0, phase: (car.id.charCodeAt(3) || 0), owned: true };
  }
  function glbCarMesh(car) {
    const map = { sport: 'sportscar', sedan: 'sedan', taxi: 'taxi2', classic: 'sedan', police: 'police' };
    const name = map[car.model];
    if (!name || !has(name)) return null;
    const c = get(name);
    if (!c) return null;
    const pmap = new Map();
    c.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const rep = ms.map((mm) => {
        if (!mm || !mm.name) return mm;
        if (mm.name.indexOf('M_Paint') === 0) {
          if (!pmap.has(mm)) { const nm = mm.clone(); nm.color.set(car.color); pmap.set(mm, nm); }
          return pmap.get(mm);
        }
        if (car.kind === 'police' && (mm.name === 'M_Light_Red' || mm.name === 'M_Light_Blue')) {
          if (!pmap.has(mm)) pmap.set(mm, mm.clone());
          return pmap.get(mm);
        }
        return mm;
      });
      o.material = Array.isArray(o.material) ? rep : rep[0];
    });
    let lights = null;
    if (car.kind === 'police') {
      lights = { red: [], blue: [] };
      c.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const mm of ms) { if (mm.name === 'M_Light_Red') lights.red.push(mm); if (mm.name === 'M_Light_Blue') lights.blue.push(mm); }
      });
    }
    return { grp: c, wheels: c.userData.wheels || null, front: c.userData.frontWheels || null, lights, prevAngle: car.angle, steer: 0, phase: (car.id.charCodeAt(3) || 0), owned: false };
  }
  function makeCarMesh(car) {
    const g = glbCarMesh(car);
    return g || procCarMesh(car);
  }
  function disposeOwned(e) {
    e.grp.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.dispose) m.dispose(); } });
  }
  const figCap = 48;
  const figTorso = new THREE.InstancedMesh(new THREE.BoxGeometry(16, 20, 9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), figCap);
  const figLegs = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 14, 7), new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 }), figCap);
  const figHead = new THREE.InstancedMesh(new THREE.BoxGeometry(11, 11, 11), new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 }), figCap);
  figTorso.castShadow = true; figLegs.castShadow = true; figHead.castShadow = true;
  figTorso.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  figLegs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  figHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(figTorso); scene.add(figLegs); scene.add(figHead);
  const bulletGeo = new THREE.BoxGeometry(14, 2, 2);
  const bulletMatP = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const bulletMatC = new THREE.MeshBasicMaterial({ color: 0xff6a5a });
  const bullets = [];
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(bulletGeo, bulletMatP); m.visible = false; scene.add(m); bullets.push(m); }
  // Held gun: one small mesh, long axis on local +X (the same forward axis
  // bullets use: rotation.y = -angle puts +X along the aim direction).
  // Shown only when the player is on foot with a gun equipped.
  const gunGroup = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.7 });
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 4), gunMat);
  gunBody.castShadow = true; gunGroup.add(gunBody);
  const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 3), gunMat);
  gunBarrel.position.set(11, 1, 0); gunBarrel.castShadow = true; gunGroup.add(gunBarrel);
  const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), gunMat);
  gunGrip.position.set(-5, -5, 0); gunGroup.add(gunGrip);
  gunGroup.visible = false; scene.add(gunGroup);
  const GUN_LEN = { pistol: 1, smg: 1.3, shotgun: 1.55, rifle: 1.85 };
  const partGeo = new THREE.BoxGeometry(1, 1, 1);
  const parts = [];
  for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); m.visible = false; scene.add(m); parts.push(m); }
  const dustPool = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xc9a06a, transparent: true, opacity: 0 })); m.visible = false; scene.add(m); dustPool.push({ m, life: 0 }); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(30, 44, 32), new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 320, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.visible = false; scene.add(beam);
  const dollarTex = textTex('$', 128, 128, 'bold 96px Arial', '#ffd94a', null, null);
  const dollar = new THREE.Sprite(new THREE.SpriteMaterial({ map: dollarTex, transparent: true, depthWrite: false }));
  dollar.scale.set(40, 40, 1); dollar.visible = false; scene.add(dollar);
  const heliGroup = new THREE.Group();
  scene.add(heliGroup);
  let heliProc = null;
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(60, 220, 16, 1, true), coneMat);
  cone.visible = false; scene.add(cone);
  const barriers = [];
  const stripeT = stripeTex();
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(110, 9, 5), new THREE.MeshStandardMaterial({ map: stripeT, roughness: 0.6 }));
    bar.position.y = 10; bar.castShadow = true; g.add(bar);
    for (const lx of [-45, 45]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 8), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 })); leg.position.set(lx, 5, 0); g.add(leg); }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 4), new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffa500, emissiveIntensity: 2 }));
    lamp.position.set(0, 17, 0); g.add(lamp);
    g.visible = false; g.userData.lamp = lamp;
    scene.add(g); barriers.push(g);
  }
  function objectiveTarget(game) {
    if (game.mission) {
      const step = game.mission.def.steps[game.mission.step];
      if (step && step.kind !== 'escape') return { x: step.x, y: step.y };
      return null;
    }
    if (game.taxi && game.taxi.active) {
      if (game.taxi.state === 'toClient' && game.taxi.client) return { x: game.taxi.client.x, y: game.taxi.client.y };
      return { x: game.taxi.destX, y: game.taxi.destY };
    }
    return null;
  }
  function palmParts(name) {
    const c = get(name);
    if (!c) return null;
    c.updateMatrixWorld(true);
    const out = [];
    c.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      out.push({ geo: g, mat: o.material });
    });
    return out;
  }
  function swapPalms() {
    if (!has('palm')) return;
    if (procPalms) { scene.remove(procPalms); procPalms = null; }
    if (glbPalms) return;
    glbPalms = new THREE.Group();
    const beach = city.trees.filter((t) => t.x < 600);
    const inland = city.trees.filter((t) => t.x >= 600);
    const sets = [[beach, has('palm2') ? 'palm2' : 'palm'], [inland, 'palm']];
    for (const [list, name] of sets) {
      if (!list.length) continue;
      const partsList = palmParts(name);
      if (!partsList) continue;
      for (const p of partsList) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          eul.set(0, (t.x * 13 + t.y * 7) % TAU, 0); tmpQ.setFromEuler(eul);
          tmpV.set(t.x - OX, 0, t.y - OZ); tmpS.set(t.s, t.s, t.s);
          tmpM.compose(tmpV, tmpQ, tmpS); im.setMatrixAt(i, tmpM);
        }
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true;
        glbPalms.add(im);
      }
    }
    scene.add(glbPalms);
  }
  function placeHotel() {
    if (!has('hotel')) return;
    const h = get('hotel');
    if (!h) return;
    h.position.set(city.landmarks.hotel.x - OX, 0, city.landmarks.hotel.y - OZ);
    scene.add(h);
  }
  function placeGlbBuildings() {
    const exclude = new Set();
    let cand = 0, placed = 0;
    for (let i = 0; i < city.buildings.length && placed < 12; i++) {
      const b = city.buildings[i];
      if (b.landmark || b.floors < 7) continue;
      if (!(b.x >= 1800 && b.x <= 3400 && b.y >= 1200 && b.y <= 2400)) continue;
      cand++;
      if (cand % 3 !== 0) continue;
      const name = b.floors >= 9 ? 'buildingA' : 'buildingB';
      if (!has(name)) continue;
      const c = get(name);
      if (!c) continue;
      if (name === 'buildingA') c.scale.set(b.w / 120, (b.floors * 12) / 132, b.d / 90);
      else c.scale.set(b.w / 110, (b.floors * 12) / 60, b.d / 85);
      c.position.set(b.x - OX, 0, b.y - OZ);
      scene.add(c);
      exclude.add(i); placed++;
    }
    if (exclude.size) buildBuildings(exclude);
  }
  function applyModels() {
    if (applied || !ready()) return;
    applied = true;
    window.__solmarModelsReady = true;
    for (const [id, e] of carMeshes) { scene.remove(e.grp); if (e.owned) disposeOwned(e); carMeshes.delete(id); }
    if (hotelProc) { hotelProc.removeFromParent(); hotelProc = null; }
    if (heliGroup.userData.mesh) { heliGroup.remove(heliGroup.userData.mesh); heliGroup.userData.mesh = null; heliGroup.userData.proc = null; }
    placeHotel();
    placeGlbBuildings();
    swapPalms();
  }
  function buildCity(game) {
    city = game.city;
    loadAll();
    loadAll().then(() => { sync(game, 1 / 60); window.__solmarModelsReady = true; });
    cityGroup.clear();
    buildingMeshes = [];
    const land = flat(4800, 3600, 0x77875f, 0);
    land.position.set(0, 0, 0); cityGroup.add(land);
    const sea = flat(110, 3600, 0x3a7a9a, 0.1);
    sea.position.set(-2400 + 55, 0.1, 0); cityGroup.add(sea);
    const sand = flat(190, 3600, 0xe8c088, 0.2);
    sand.position.set(-2195, 0.2, 0); cityGroup.add(sand);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.95 });
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.95 });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8c832, roughness: 0.8 });
    const dashList = [];
    for (const r of CONFIG.roadsV) {
      const road = flat(116, 3600, 0x3a3230, 0.35); road.material = roadMat;
      road.position.set(r - OX, 0.35, 0); cityGroup.add(road);
      for (const s of [-71, 71]) { const w = flat(26, 3600, 0xb8a888, 0.4); w.material = walkMat; w.position.set(r + s - OX, 0.4, 0); cityGroup.add(w); }
      for (let y = 40; y < 3600; y += 90) dashList.push({ x: r - OX, y: 0.5, z: y - OZ, sx: 4, sy: 0.5, sz: 34 });
    }
    for (const r of CONFIG.roadsH) {
      const road = flat(4800, 116, 0x3a3230, 0.35); road.material = roadMat;
      road.position.set(0, 0.35, r - OZ); cityGroup.add(road);
      for (const s of [-71, 71]) { const w = flat(4800, 26, 0xb8a888, 0.4); w.material = walkMat; w.position.set(0, 0.4, r + s - OZ); cityGroup.add(w); }
      for (let x = 40; x < 4800; x += 90) dashList.push({ x: x - OX, y: 0.5, z: r - OZ, sx: 34, sy: 0.5, sz: 4 });
    }
    cityGroup.add(inst(boxGeo, dashMat, dashList));
    for (const p of city.parks) { const g = flat(p.w, p.d, 0x5a8a4a, 0.25); g.position.set(p.x - OX, 0.25, p.y - OZ); cityGroup.add(g); }
    for (const l of city.lots) {
      const g = flat(l.w, l.d, 0x4a4442, 0.3); g.position.set(l.x - OX, 0.3, l.y - OZ); cityGroup.add(g);
      const bays = [];
      for (let i = 0; i < 6; i++) bays.push({ x: l.x - l.w / 2 + 30 + i * ((l.w - 60) / 5) - OX, y: 0.45, z: l.y - OZ, sx: 1.5, sy: 0.4, sz: l.d - 40 });
      cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 }), bays));
    }
    const contList = [];
    for (const c of city.containers) {
      contList.push({ x: c.x - OX, y: 17, z: c.y - OZ, sx: c.w, sy: 34, sz: c.d, color: c.color });
      if (c.stack) contList.push({ x: c.x - OX + 6, y: 51, z: c.y - OZ, sx: c.w, sy: 34, sz: c.d, color: c.color });
    }
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.1 }), contList));
    buildBuildings(null);
    const hotelB = city.buildings.find((b) => b.landmark === 'hotel');
    hotelProc = new THREE.Group();
    const hb = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xc96f4a, roughness: 0.85 }));
    hb.scale.set(240, 144, 170); hb.position.y = 72; hb.castShadow = true; hotelProc.add(hb);
    const cap = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.4, roughness: 0.4 }));
    cap.scale.set(120, 6, 90); cap.position.y = 147; hotelProc.add(cap);
    hotelProc.position.set(hotelB.x - OX, 0, hotelB.y - OZ);
    cityGroup.add(hotelProc);
    const lightB = city.buildings.find((b) => b.landmark === 'lighthouse');
    const stripeC = document.createElement('canvas'); stripeC.width = 64; stripeC.height = 256;
    const sg = stripeC.getContext('2d');
    for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#e5322d' : '#f5f5f5'; sg.fillRect(0, i * 32, 64, 32); }
    const stripeT2 = new THREE.CanvasTexture(stripeC); stripeT2.colorSpace = THREE.SRGBColorSpace;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 108, 12), new THREE.MeshStandardMaterial({ map: stripeT2, roughness: 0.8 }));
    tower.position.set(lightB.x - OX, 54, lightB.y - OZ); tower.castShadow = true; cityGroup.add(tower);
    const lampBall = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 10), new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffdd55, emissiveIntensity: 3 }));
    lampBall.position.set(lightB.x - OX, 112, lightB.y - OZ); cityGroup.add(lampBall);
    const pierMats = [];
    for (let i = 0; i < 12; i++) pierMats.push({ x: city.landmarks.pier.x - OX, y: 2, z: city.landmarks.pier.y - OZ + i * 18, sx: 60, sy: 3, sz: 15 });
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 }), pierMats));
    const trunkGeo = new THREE.CylinderGeometry(2.4, 3.4, 30, 7);
    trunkGeo.translate(0, 15, 0);
    const frondGeo = new THREE.ConeGeometry(17, 15, 7);
    frondGeo.translate(0, 33, 0);
    const trunkMats = [], frondMats = [];
    for (const t of city.trees) {
      trunkMats.push({ x: t.x - OX, y: 0, z: t.y - OZ, sx: t.s, sy: t.s, sz: t.s, ry: (t.x * 13 + t.y * 7) % TAU });
      frondMats.push({ x: t.x - OX, y: 0, z: t.y - OZ, sx: t.s, sy: t.s, sz: t.s, ry: (t.x * 7 + t.y * 11) % TAU, color: ['#3a7a2a', '#4a8a2a', '#2a6a2a'][(t.x + t.y) % 3] });
    }
    procPalms = new THREE.Group();
    procPalms.add(inst(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }), trunkMats));
    procPalms.add(inst(frondGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), frondMats));
    scene.add(procPalms);
    const lampPole = [], lampHead = [];
    for (const l of city.lamps) {
      lampPole.push({ x: l.x - OX, y: 0, z: l.y - OZ, sx: 1, sy: 1, sz: 1 });
      lampHead.push({ x: l.x - OX, y: 26, z: l.y - OZ, sx: 1, sy: 1, sz: 1 });
    }
    const poleGeo = new THREE.CylinderGeometry(1.2, 1.6, 26, 6);
    poleGeo.translate(0, 13, 0);
    cityGroup.add(inst(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.4 }), lampPole));
    const headGeo = new THREE.SphereGeometry(3, 8, 6);
    cityGroup.add(inst(headGeo, new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffc860, emissiveIntensity: 2.2 }), lampHead));
    const benchAll = [...city.benches, ...city.streetSeats];
    const seatMats = [], backMats = [];
    for (const b of benchAll) {
      seatMats.push({ x: b.x - OX, y: 4, z: b.y - OZ, sx: 22, sy: 2, sz: 8, ry: -b.ang });
      backMats.push({ x: b.x - OX - Math.cos(b.ang) * 3.5, y: 9, z: b.y - OZ - Math.sin(b.ang) * 3.5, sx: 22, sy: 8, sz: 2, ry: -b.ang });
    }
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }), seatMats));
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }), backMats));
    const roofMats = [], postMats = [];
    for (const s of city.busStops) {
      roofMats.push({ x: s.x - OX, y: 26, z: s.y - OZ, sx: 40, sy: 2, sz: 16, ry: -s.ang });
      const cx = Math.cos(-s.ang), sz2 = -Math.sin(-s.ang);
      postMats.push({ x: s.x - OX + cx * 16, y: 13, z: s.y - OZ + sz2 * 16, sx: 2, sy: 26, sz: 2 });
      postMats.push({ x: s.x - OX - cx * 16, y: 13, z: s.y - OZ - sz2 * 16, sx: 2, sy: 26, sz: 2 });
    }
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.6 }), roofMats));
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 }), postMats));
    const umbPole = [], umbTop = [];
    for (const u of city.umbrellas) {
      umbPole.push({ x: u.x - OX, y: 0, z: u.y - OZ, sx: 1, sy: 1, sz: 1 });
      umbTop.push({ x: u.x - OX, y: 0, z: u.y - OZ, sx: 1, sy: 1, sz: 1, color: u.color });
    }
    const upGeo = new THREE.CylinderGeometry(1, 1, 16, 6);
    upGeo.translate(0, 8, 0);
    cityGroup.add(inst(upGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8 }), umbPole));
    const utGeo = new THREE.ConeGeometry(16, 8, 8);
    utGeo.translate(0, 20, 0);
    cityGroup.add(inst(utGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), umbTop));
    const towelMats = [];
    for (const t of city.towels) towelMats.push({ x: t.x - OX, y: 0.6, z: t.y - OZ, sx: 22, sy: 0.6, sz: 12, ry: -t.ang, color: t.color });
    cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), towelMats));
    const lotBody = [], lotCabin = [];
    for (const c of city.lotCars) {
      lotBody.push({ x: c.x - OX, y: 6, z: c.y - OZ, sx: 92, sy: 10, sz: 44, ry: -c.ang, color: c.color });
      lotCabin.push({ x: c.x - OX, y: 14, z: c.y - OZ, sx: 40, sy: 8, sz: 36, ry: -c.ang });
    }
    if (lotBody.length) {
      cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 }), lotBody));
      cityGroup.add(inst(boxGeo, new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.12, metalness: 0.2 }), lotCabin));
    }
    for (const b of city.billboards) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 4), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 }));
      pole.position.y = 30; pole.castShadow = true; g.add(pole);
      const tex = textTex(b.text, 512, 256, 'bold 76px Arial', '#ffd94a', '#1c2b4a', '#c9a24a');
      const board = new THREE.Mesh(new THREE.PlaneGeometry(130, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      board.position.y = 78; g.add(board);
      const back = board.clone(); back.rotation.y = Math.PI; back.position.z = -1; g.add(back);
      g.position.set(b.x - OX, 0, b.y - OZ);
      g.rotation.y = Math.PI / 2 - b.ang;
      cityGroup.add(g);
    }
    const signNames = { hotel: 'GRAND SOLMAR', casino: 'MARINA CASINO', chopshop: 'CHOP SHOP', hospital: 'SOLMAR GENERAL', policehq: 'POLICE HQ', hideout: 'HIDEOUT', lighthouse: 'LIGHTHOUSE', pier: 'MARINA PIER', docks: 'PORTSIDE DOCKS' };
    for (const key of Object.keys(signNames)) {
      const lm2 = city.landmarks[key];
      if (!lm2) continue;
      const b = city.buildings.find((bb) => bb.landmark === key);
      const h = b ? b.floors * 12 : 30;
      const tex = textTex(signNames[key], 512, 96, 'bold 56px Arial', '#ffd94a', null, null);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(150, 28), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false }));
      sign.position.set(lm2.x - OX, h + 26, lm2.y - OZ);
      cityGroup.add(sign);
      const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z -= 1; cityGroup.add(sign2);
    }
  }
  function sync(game, dt) {
    time += dt;
    applyModels();
    const p = game.player;
    const px = p.x - OX, pz = p.y - OZ;
    sun.position.set(px + sunDir.x * 1600, sunDir.y * 1600, pz + sunDir.z * 1600);
    sun.target.position.set(px, 0, pz);
    const allCars = game.cars.slice();
    for (const pc of (game.police || [])) if (!allCars.some((c) => c.id === pc.id)) allCars.push(pc);
    const seen = new Set();
    for (const car of allCars) {
      seen.add(car.id);
      let e = carMeshes.get(car.id);
      if (!e) { e = makeCarMesh(car); carMeshes.set(car.id, e); scene.add(e.grp); }
      e.grp.position.set(car.x - OX, 0, car.y - OZ);
      e.grp.rotation.y = -car.angle;
      const spin = car.speed * dt / 11;
      if (e.wheels) for (const w of e.wheels) w.rotation.z -= spin;
      const rate = angDiff(e.prevAngle, car.angle) / Math.max(dt, 0.001);
      const target = clamp(rate * 0.12, -0.5, 0.5);
      e.steer += (target - e.steer) * Math.min(1, dt * 10);
      if (e.front) for (const w of e.front) w.rotation.y = e.steer;
      e.prevAngle = car.angle;
      if (e.lights) {
        const ph = Math.sin(time * 9 + e.phase) > 0;
        for (const m of e.lights.red) m.emissiveIntensity = ph ? 3 : 0.15;
        for (const m of e.lights.blue) m.emissiveIntensity = ph ? 0.15 : 3;
      }
    }
    for (const [id, e] of carMeshes) {
      if (!seen.has(id)) { scene.remove(e.grp); if (e.owned) disposeOwned(e); carMeshes.delete(id); }
    }
    const figs = [];
    if (p.onFoot) figs.push({ x: p.x, y: p.y, angle: p.angle, color: '#c0392b', moving: p.moving });
    for (const ped of game.peds) figs.push({ x: ped.x, y: ped.y, angle: ped.angle, color: ped.kind === 'cop' ? '#1c2b4a' : ped.color, moving: ped.state !== 'wait' && ped.state !== 'stand' });
    for (let i = 0; i < figCap; i++) {
      if (i < figs.length) {
        const f = figs[i];
        const bob = f.moving ? Math.abs(Math.sin(time * 10 + i)) * 2 : 0;
        eul.set(0, -f.angle, 0); tmpQ.setFromEuler(eul);
        tmpV.set(f.x - OX, 22 + bob, f.y - OZ); tmpS.set(1, 1, 1);
        tmpM.compose(tmpV, tmpQ, tmpS); figTorso.setMatrixAt(i, tmpM);
        tmpV.set(f.x - OX, 7 + bob, f.y - OZ);
        tmpM.compose(tmpV, tmpQ, tmpS); figLegs.setMatrixAt(i, tmpM);
        tmpV.set(f.x - OX, 38 + bob, f.y - OZ);
        tmpM.compose(tmpV, tmpQ, tmpS); figHead.setMatrixAt(i, tmpM);
        figTorso.setColorAt(i, new THREE.Color(f.color));
      } else {
        tmpM.makeScale(0, 0, 0);
        figTorso.setMatrixAt(i, tmpM); figLegs.setMatrixAt(i, tmpM); figHead.setMatrixAt(i, tmpM);
      }
    }
    figTorso.instanceMatrix.needsUpdate = true;
    figLegs.instanceMatrix.needsUpdate = true;
    figHead.instanceMatrix.needsUpdate = true;
    if (figTorso.instanceColor) figTorso.instanceColor.needsUpdate = true;
    const showGun = p.onFoot && p.weapon !== 'fists';
    gunGroup.visible = showGun;
    if (showGun) {
      const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
      const bob = p.moving ? Math.abs(Math.sin(time * 10)) * 2 : 0;
      gunGroup.position.set(px + fx * 10 - fy * 12, 24 + bob, pz + fy * 10 + fx * 12);
      // Angled ~35 degrees out from the aim direction so the side profile
      // reads from the chase camera behind the player (straight forward
      // would foreshorten the gun to its butt end).
      gunGroup.rotation.y = -p.angle + 0.6;
      gunGroup.scale.set(GUN_LEN[p.weapon] || 1, 1, 1);
    }
    if (game.taxi && game.taxi.active && game.taxi.state === 'toClient' && game.taxi.client) {
      dollar.visible = true;
      dollar.position.set(game.taxi.client.x - OX, 60 + Math.sin(time * 3) * 4, game.taxi.client.y - OZ);
    } else dollar.visible = false;
    const heli = game.heli;
    if (heli && heli.active) {
      let hm = heliGroup.userData.mesh;
      if (!hm) {
        if (has('heli2')) {
          const c = get('heli2');
          if (c) { hm = c; heliGroup.add(c); }
        }
        if (!hm && !heliGroup.userData.proc) {
          const g = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(46, 12, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.2 }));
          body.position.y = 6; body.castShadow = true; g.add(body);
          const tail = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 6), new THREE.MeshStandardMaterial({ color: 0x1c2b4a, roughness: 0.5 }));
          tail.position.set(-34, 6, 0); g.add(tail);
          const rotor = new THREE.Mesh(new THREE.BoxGeometry(52, 1, 3), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
          rotor.position.y = 15; g.add(rotor);
          g.userData.rotor = rotor;
          heliGroup.add(g); heliGroup.userData.proc = g;
          hm = g;
        }
        heliGroup.userData.mesh = hm || null;
      }
      if (hm) {
        heliGroup.visible = true;
        heliGroup.position.set(heli.x - OX, heli.z, heli.y - OZ);
        heliGroup.rotation.y = -Math.atan2(p.y - heli.y, p.x - heli.x);
        const r = hm.userData.rotor;
        if (r) r.rotation.y = heli.rotor;
        const tr = hm.userData.tailRotor;
        if (tr) tr.rotation.z = heli.rotor * 3;
        cone.visible = true;
        const hx = heli.x - OX, hz = heli.y - OZ;
        cone.position.set(hx + (px - hx) * 0.25, heli.z - 110, hz + (pz - hz) * 0.25);
        const dir = new THREE.Vector3(px - hx, -heli.z, pz - hz).normalize();
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      }
    } else {
      heliGroup.visible = false;
      cone.visible = false;
    }
    for (let i = 0; i < bullets.length; i++) {
      const b = game.bullets[i];
      const m = bullets[i];
      if (!b) { m.visible = false; continue; }
      m.visible = true;
      m.material = (b.from === 'police' || b.fromPlayer === false) ? bulletMatC : bulletMatP;
      m.position.set(b.x - OX, 8, b.y - OZ);
      m.rotation.y = -b.angle;
    }
    for (let i = 0; i < parts.length; i++) {
      const pt = game.particles[i];
      const m = parts[i];
      if (!pt) { m.visible = false; continue; }
      m.visible = true;
      const pz = pt.z !== undefined ? pt.z : (pt.kind === 'smoke' ? 10 : 4);
      m.position.set(pt.x - OX, pz, pt.y - OZ);
      const s = pt.size * clamp(pt.life, 0.15, 1);
      m.scale.set(s, s, s);
      m.material.color.set(pt.color);
      m.material.opacity = pt.kind === 'smoke' ? 0.45 * clamp(pt.life / (pt.maxLife || 1), 0, 1) : 0.9;
    }
    if (p.car) {
      const car = p.car;
      const lat = Math.abs(-Math.sin(car.angle) * car.vx + Math.cos(car.angle) * car.vy);
      if (Math.abs(car.speed) > 150 && lat > 120) {
        for (const d of dustPool) {
          if (d.life <= 0) {
            d.life = 0.6;
            d.m.visible = true;
            d.m.position.set(car.x - OX - Math.cos(car.angle) * 30, 4, car.y - OZ - Math.sin(car.angle) * 30);
            break;
          }
        }
      }
    }
    for (const d of dustPool) {
      if (d.life > 0) {
        d.life -= dt;
        d.m.material.opacity = Math.max(0, d.life) * 0.5;
        const s = 6 + (0.6 - d.life) * 20;
        d.m.scale.set(s, s, s);
        if (d.life <= 0) d.m.visible = false;
      }
    }
    const target = objectiveTarget(game);
    if (target && game.screen === 'play') {
      ring.visible = true; beam.visible = true;
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ring.position.set(target.x - OX, 2, target.y - OZ);
      ring.scale.set(pulse, pulse, 1);
      ring.material.opacity = 0.6 + Math.sin(time * 4) * 0.25;
      beam.position.set(target.x - OX, 160, target.y - OZ);
      beam.material.opacity = 0.16 + Math.sin(time * 4) * 0.06;
    } else { ring.visible = false; beam.visible = false; }
    const rbs = game.roadblocks || [];
    for (let i = 0; i < barriers.length; i++) {
      const rb = rbs[i];
      const g = barriers[i];
      if (!rb) { g.visible = false; continue; }
      g.visible = true;
      g.position.set(rb.x - OX, 0, rb.y - OZ);
      g.rotation.y = -rb.ang;
      g.userData.lamp.material.emissiveIntensity = Math.sin(time * 6 + i * 2) > 0 ? 3 : 0.3;
    }
    skyGroup.position.set(camera.position.x, 0, camera.position.z);
    if (game.screen === 'title') {
      orbitA += dt * 0.05;
      const cx = -50 + Math.cos(orbitA) * 700, cz = 1380 + Math.sin(orbitA) * 700;
      camera.position.set(cx, 420, cz);
      camera.lookAt(-50, 0, 1380);
      camera.fov = 62; camera.updateProjectionMatrix();
    } else {
      const inCar = !!p.car;
      const back = inCar ? 250 : 150, up = inCar ? 120 : 85;
      const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
      const tx = px - fx * back, tz = pz - fy * back;
      const lx = px + fx * (inCar ? 60 : 30), lz = pz + fy * (inCar ? 60 : 30);
      if (!snapped) {
        camPos.set(tx, up, tz); lookPt.set(lx, 14, lz);
        snapped = true;
      } else {
        const k = 1 - Math.exp(-dt * 4.5);
        camPos.x += (tx - camPos.x) * k; camPos.y += (up - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
        const k2 = 1 - Math.exp(-dt * 7);
        lookPt.x += (lx - lookPt.x) * k2; lookPt.y += (14 - lookPt.y) * k2; lookPt.z += (lz - lookPt.z) * k2;
      }
      const tr = game.camera ? game.camera.shake || 0 : 0;
      const amp = tr * tr * 6;
      const sx = (Math.sin(time * 31) + Math.sin(time * 47 + 1.3)) * amp;
      const sy = (Math.sin(time * 39 + 2.1) + Math.sin(time * 53)) * amp;
      camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z);
      camera.lookAt(lookPt);
      camera.rotateZ(Math.sin(time * 13) * 0.02 * tr * tr);
      const top = p.car ? (CAR_MODELS[p.car.model] || CAR_MODELS.sedan).topSpeed : 430;
      const speedF = p.car ? clamp(Math.abs(p.car.speed) / top, 0, 1) : 0;
      const fov = 62 + speedF * 6;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    renderer.render(scene, camera);
  }
  const rc = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function screenToGround(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    rc.setFromCamera(ndc, camera);
    const o = rc.ray.origin, d = rc.ray.direction;
    if (d.y >= -0.001) return null;
    const t = -o.y / d.y;
    const px = o.x + d.x * t, pz = o.z + d.z * t;
    return { x: px + OX, y: pz + OZ };
  }
  function projectToScreen(x, y) {
    const v = new THREE.Vector3(x - OX, 0, y - OZ);
    const cs = v.clone().applyMatrix4(camera.matrixWorldInverse);
    const behind = cs.z > 0;
    v.project(camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const visible = !behind && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1 && v.z < 1;
    return { x: sx, y: sy, visible, behind };
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  function dispose() { renderer.dispose(); }
  function snapCamera() { snapped = false; }
  function getStats() {
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries };
  }
  resize();
  return { buildCity, sync, screenToGround, projectToScreen, resize, dispose, snapCamera, getStats, scene, renderer };
}
