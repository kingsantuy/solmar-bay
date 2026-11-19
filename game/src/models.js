import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone } from '../vendor/utils/SkeletonUtils.js';
import * as THREE from '../vendor/three.module.js';
export const MODEL_FILES = { sportscar: 'sportscar.glb', sedan: 'sedan.glb', police: 'police.glb', hotel: 'hotel.glb', palm: 'palm.glb', buildingA: 'buildinga.glb', buildingB: 'buildingb.glb', palm2: 'palm2.glb', heli2: 'heli2.glb', taxi2: 'taxi2.glb' };
export const MODEL_NAMES = Object.keys(MODEL_FILES);
const SCALES = { sportscar: 2, sedan: 2, police: 2, taxi2: 2, palm: 3, palm2: 3, heli2: 1.2, hotel: 1, buildingA: 1, buildingB: 1 };
const loaded = {};
let settled = false;
let cache = null;
export function loadAll() {
  if (cache) return cache;
  cache = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(MODEL_NAMES.map(async (n) => {
      try {
        const g = await loader.loadAsync('../assets/' + MODEL_FILES[n]);
        g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        loaded[n] = g.scene;
      } catch (e) { console.warn('model failed: ' + n, e); }
    }));
    settled = true;
    return loaded;
  })();
  return cache;
}
export const loadModels = loadAll;
export function ready() { return settled; }
export function has(name) { return !!loaded[name]; }
export function get(name) {
  const t = loaded[name];
  if (!t) return null;
  const c = clone(t);
  c.scale.setScalar(SCALES[name] || 1);
  const w = [];
  c.traverse((o) => { if (o.name && !o.isMesh && o.name.indexOf('Wheel_') === 0) w.push(o); });
  if (w.length === 4) {
    c.userData.wheels = w;
    c.userData.frontWheels = w.filter((o) => o.name === 'Wheel_FL' || o.name === 'Wheel_FR');
  }
  const r = c.getObjectByName('Rotor');
  if (r) c.userData.rotor = r;
  const tr = c.getObjectByName('TailRotor');
  if (tr) c.userData.tailRotor = tr;
  const sl = c.getObjectByName('Searchlight');
  if (sl) c.userData.searchlight = sl;
  return c;
}
export function sizeOf(name) {
  const t = loaded[name];
  if (!t) return null;
  const b = new THREE.Box3().setFromObject(t);
  const s = b.getSize(new THREE.Vector3());
  const k = SCALES[name] || 1;
  return { x: s.x * k, y: s.y * k, z: s.z * k };
}
