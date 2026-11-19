// Solmar Bay — glTF model loader (game/assets/*.glb, built in Blender).
// Loads all five models once; repeat calls return the same promise.
// It never throws and never rejects: a file that fails to load is logged
// and skipped, and the game falls back to its procedural meshes.
//
// Conventions (fixed at export time): one unit equals one game unit,
// every model faces +X with its origin at ground centre, car wheel nodes
// are named Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR with the axle
// along local Z, so the renderer's placement convention works as-is:
// place at (game x - 2400, 0, game y - 1800), rotate by -angle, spin
// wheels around Z, steer the front wheels around Y.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

export const MODEL_NAMES = ['sportscar', 'sedan', 'police', 'hotel', 'palm'];

export const MODEL_FILES = {
  sportscar: '../assets/sportscar.glb',
  sedan: '../assets/sedan.glb',
  police: '../assets/police.glb',
  hotel: '../assets/hotel.glb',
  palm: '../assets/palm.glb',
};

// The three car models (the ones with wheel nodes).
export const CAR_MODEL_NAMES = ['sportscar', 'sedan', 'police'];

export const WHEEL_NAMES = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'];
const FRONT_WHEEL_NAMES = ['Wheel_FL', 'Wheel_FR'];

let loadPromise = null;
let loaded = null; // Map<name, Object3D> once loadModels() resolves

// Load all five models once and return the map from name to object.
// Repeat calls return the same promise. Never rejects.
export function loadModels() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const map = new Map();
    try {
      const loader = new GLTFLoader();
      for (const name of MODEL_NAMES) {
        try {
          const url = new URL(MODEL_FILES[name], import.meta.url).href;
          const gltf = await loader.loadAsync(url);
          const root = gltf.scene;
          // Every mesh casts a shadow; clones inherit the flags.
          root.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          map.set(name, root);
        } catch (e) {
          console.warn('[models] failed to load ' + name + ': ' + (e && e.message ? e.message : e));
        }
      }
    } catch (e) {
      console.warn('[models] loader failed: ' + (e && e.message ? e.message : e));
    }
    loaded = map;
    return map;
  })();
  return loadPromise;
}

// A fresh clone of the loaded template (materials shared with the
// template, nodes independent). For cars the clone carries its wheel
// nodes: userData.wheels is all four in FL/FR/RL/RR order and
// userData.frontWheels is the two front ones. Returns null when the
// model is not loaded (yet or ever).
export function getModel(name) {
  if (!loaded || !loaded.has(name)) return null;
  const clone = loaded.get(name).clone();
  if (CAR_MODEL_NAMES.includes(name)) {
    const byName = {};
    clone.traverse((o) => {
      if (WHEEL_NAMES.includes(o.name)) byName[o.name] = o;
    });
    const wheels = WHEEL_NAMES.map((n) => byName[n]).filter(Boolean);
    clone.userData.wheels = wheels;
    clone.userData.frontWheels = wheels.filter((w) => FRONT_WHEEL_NAMES.includes(w.name));
  }
  return clone;
}

// True when the named model finished loading successfully.
export function hasModel(name) {
  return !!loaded && loaded.has(name);
}

// Bounding-box size of the loaded template, in game units, or null when
// the model is not loaded. Useful for scale and placement sanity checks.
export function modelSize(name) {
  if (!loaded || !loaded.has(name)) return null;
  const box = new THREE.Box3().setFromObject(loaded.get(name));
  const size = box.getSize(new THREE.Vector3());
  return { x: size.x, y: size.y, z: size.z };
}

// True once loadModels() has resolved (successfully or with skips).
export function modelsReady() {
  return loaded !== null;
}
