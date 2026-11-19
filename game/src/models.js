import {loadGlb} from './gltf.js';
const NAMES=['buildinga','buildingb','heli2','hotel','palm','palm2','police','sedan','sportscar','taxi2'];
const cache=new Map();let done=false;
export function isReady(){return done}
export async function loadAll(){for(const n of NAMES){try{const m=await loadGlb(new URL('../assets/'+n+'.glb',import.meta.url));if(m)cache.set(n,m)}catch(e){}}done=true;return done}
export function getModel(n){return cache.get(n)||null}
export function hasModel(n){return cache.has(n)}
