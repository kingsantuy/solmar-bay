import {createGame,stepGame} from './state.js';
import {createRenderer} from './render.js';
import {createHUD} from './hud.js';
import {createAudio} from './audio.js';
import {loadSave,saveGame} from './save.js';
import {stageShot} from './shots.js';
export function boot(){const q=new URLSearchParams(location.search);const seed=parseInt(q.get('seed')||'1',10)||1;const shot=q.get('shot')||null;
const canvas=document.getElementById('game');const renderer=createRenderer(canvas);const audio=createAudio();
let game=createGame(seed,loadSave(),audio);game.audio=audio;
const S={game,renderer,audio};window.__solmar=S;
let hud=null;const cb={shotMode:!!shot,project:(x,y,z)=>{try{return renderer.project?renderer.project(x,y,z||0):null;}catch(e){return null;}},onResume:()=>{S.game.screen='play';if(S.game.ui)S.game.ui.paused=false;},onRestart:()=>{restart();},onQuit:()=>{saveGame(S.game);S.game.screen='title';}};
hud=createHUD(S.game,cb);S.hud=hud;
function restart(){const g=createGame(seed,null,audio);g.audio=audio;S.game=g;game=g;}
const held=new Set(),just=new Set();let mx=innerWidth/2,my=innerHeight/2,shootHeld=false;
const KM={KeyW:'fwd',ArrowUp:'fwd',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run',Space:'handbrake'};
const JP={KeyE:'enter',KeyF:'punch',KeyQ:'wheel',KeyG:'garage',Escape:'pause',KeyP:'pause',KeyM:'mute',KeyR:'radio',Enter:'confirm'};
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;const h=KM[e.code];if(h)held.add(h);const j=JP[e.code];if(j)just.add(j);if(/^Digit[1-5]$/.test(e.code))just.add('w'+e.code.slice(5));if(e.code==='KeyR'&&S.game.screen==='pause')just.add('restart');if(e.code==='KeyQ'&&S.game.screen==='pause')just.add('quit');});
addEventListener('keyup',e=>{const h=KM[e.code];if(h)held.delete(h);});
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
addEventListener('mousedown',e=>{mx=e.clientX;my=e.clientY;shootHeld=true;just.add('click');});
addEventListener('mouseup',()=>{shootHeld=false;});
addEventListener('resize',()=>{try{renderer.resize();}catch(e){}});
function buildInput(){let aim={x:0,y:0};try{const a=renderer.screenToGround?renderer.screenToGround(mx,my):null;if(a)aim=Array.isArray(a)?{x:a[0],y:a[1]}:a;}catch(e){}const p=S.game.player||{};const inp={up:held.has('fwd'),down:held.has('back'),fwd:held.has('fwd'),back:held.has('back'),left:held.has('left'),right:held.has('right'),run:held.has('run'),enter:just.has('enter'),punch:just.has('punch'),shoot:shootHeld,handbrake:held.has('handbrake'),w:0,weapon1:false,weapon2:false,weapon3:false,weapon4:false,weapon5:false,wheel:just.has('wheel'),garage:just.has('garage'),pause:just.has('pause'),mute:just.has('mute'),radio:just.has('radio'),confirm:just.has('confirm'),click:just.has('click'),aimX:aim.x||p.x||0,aimY:aim.y||p.y||0,mx,my};for(let i=1;i<=5;i++)if(just.has('w'+i)){inp.w=i;inp['weapon'+i]=true;}return inp;}
let prevShots=0,prevMoney=0,prevMi=-1;
function frame(t){const g=S.game;if(g.screen==='pause'){if(just.has('restart'))restart();if(just.has('quit')){saveGame(g);g.screen='title';}}
const inp=buildInput();
if(inp.wheel&&typeof g.wheelOpen!=='boolean')hud.toggleWheel();
if(inp.garage&&typeof g.garageOpen!=='boolean'&&!(g.garage&&typeof g.garage.open==='boolean'))hud.toggleGarage();
if(inp.w&&typeof g.wheelOpen!=='boolean')hud.closeWheel();
stepGame(g,inp,1/60);
try{renderer.sync(g,1/60);}catch(e){}
hud.update(g);
try{const c=g.player&&g.player.car;audio.engine(c?Math.min(1,Math.abs(c.speed||0)/560):0);audio.siren((g.wanted&&g.wanted.stars||0)>=1);}catch(e){}
try{const sh=(g.stats&&g.stats.shotsFired)||0;if(sh>prevShots)audio.shot();prevShots=sh;const mon=(g.player&&g.player.money!=null)?g.player.money:(g.money||0);if(mon>prevMoney&&prevMoney>0)audio.cash();prevMoney=mon;const mi=g.missionIndex!=null?g.missionIndex:(g.mi||0);if(prevMi>=0&&mi>prevMi)audio.success();prevMi=mi;}catch(e){}
just.clear();requestAnimationFrame(frame);}
if(shot){(async()=>{try{await renderer.buildCity(S.game);}catch(e){}try{window.__solmarModelsReady=true;}catch(e){}stageShot(shot,S.game);hud.update(S.game);try{renderer.sync(S.game,1/60);renderer.sync(S.game,1/60);}catch(e){}hud.update(S.game);window.__solmarReady=true;})();}
else{try{renderer.buildCity(S.game).then(()=>{try{window.__solmarModelsReady=true;}catch(e){}}).catch(()=>{});}catch(e){}const sv=loadSave();prevMoney=sv?(sv.money||0):0;requestAnimationFrame(frame);}}
