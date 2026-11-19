import * as cfg from './config.js';
import {stepGame} from './state.js';
const MISSIONS=cfg.MISSIONS||cfg.missions||cfg.MISSION_DEFS||cfg.MISSION_LIST||[];
const DT=1/60;
function base(){return{fwd:false,back:false,left:false,right:false,run:false,enter:false,punch:false,shoot:false,handbrake:false,w:0,wheel:false,garage:false,pause:false,mute:false,radio:false,confirm:false,click:false,aimX:0,aimY:0,mx:0,my:0};}
function run(g,part,n){for(let i=0;i<n;i++){const inp=base();Object.assign(inp,part||{});const p=g.player||{};inp.aimX=p.x||0;inp.aimY=p.y||0;stepGame(g,inp,DT);}}
function startPlay(g){for(let i=0;i<40;i++){if(g.screen==='play')break;run(g,{confirm:true},1);}if(g.screen==='title'){try{g.screen='play';}catch(e){}}}
function tp(g,x,y){const p=g.player;if(!p)return;p.x=x;p.y=y;if(p.car){p.car.x=x;p.car.y=y;p.car.vx=0;p.car.vy=0;p.car.speed=0;}}
function setWanted(g,n){try{if(g.wanted&&typeof g.wanted==='object'){g.wanted.stars=n;g.wanted.quietTimer=0;}else g.wanted=n;}catch(e){}}
function findCar(g,test){const cs=g.cars||[];for(const c of cs)if(test(c))return c;return null;}
function isSport(c){return /sport/i.test((c.model||'')+' '+(c.kind||'')+' '+(c.name||'')+' '+(c.type||''));}
function isSedan(c){return /sedan/i.test((c.model||'')+' '+(c.kind||'')+' '+(c.name||'')+' '+(c.type||''));}
function enterCar(g,car){if(!car)return false;tp(g,car.x+12,car.y);for(let i=0;i<50;i++){if(g.player&&!g.player.onFoot)return true;run(g,{enter:true},1);}const p=g.player;if(p&&p.onFoot){p.onFoot=false;p.car=car;if(car)car.driver='player';return true;}return !!(p&&!p.onFoot);}
function driveTo(g,raw,cap){for(let i=0;i<cap;i++){const c=g.player&&g.player.car;if(c&&Math.abs(c.speed||0)>=raw)break;run(g,{fwd:true},1);}}
function waitFor(g,fn,cap){for(let i=0;i<cap;i++){if(fn(g))return true;run(g,{},1);}return fn(g);}
export function stageShot(name,g){try{startPlay(g);const p=g.player||{};
if(name==='cover'){let car=findCar(g,c=>isSport(c)&&c.kind!=='police')||findCar(g,c=>isSport(c))||findCar(g,c=>c.kind==='parked');enterCar(g,car);if(p.car){p.car.color=0xd21f2b;tp(g,2100,1540);p.car.angle=0;p.angle=0;}setWanted(g,3);run(g,{fwd:true},240);if(g.heli){g.heli.active=true;if(!g.heli.x){g.heli.x=p.x+300;g.heli.y=p.y-260;}}}
if(name==='drive'){let car=findCar(g,c=>isSedan(c)&&c.kind!=='police')||findCar(g,c=>c.kind==='parked');enterCar(g,car);if(p.car){p.car.color=0x2266cc;tp(g,420,1500);p.car.angle=-Math.PI/2;p.angle=-Math.PI/2;}driveTo(g,240,300);run(g,{fwd:true},30);}
if(name==='onfoot'){if(p.car){for(let i=0;i<10;i++){if(p.onFoot)break;run(g,{enter:true},1);}if(!p.onFoot){p.car=null;p.onFoot=true;}}tp(g,1540,2100);p.angle=0;p.weapon='pistol';p.hasPistol=true;if(g.weapons)g.weapons.forEach(w=>{if(w.id==='pistol')w.owned=true;});run(g,{},80);}
if(name==='mission'){waitFor(g,gg=>{const m=gg.mission;return m&&(m.step===1||(m.def&&m.def.id==='hot-wheels'));},60);tp(g,2350,3350);waitFor(g,gg=>gg.mission&&gg.mission.step===1,120);tp(g,2400,1500);waitFor(g,gg=>{const m=gg.mission;return m&&m.def&&(m.def.id==='hot-wheels'||m.step===0);},120);let car=findCar(g,c=>isSport(c)&&c.kind!=='police')||findCar(g,c=>isSport(c))||findCar(g,c=>c.kind==='parked');enterCar(g,car);if(p.car){p.car.color=0xd21f2b;tp(g,2100,1540);p.car.angle=0;p.angle=0;}driveTo(g,480,600);run(g,{fwd:true},40);}
run(g,{},2);}catch(e){try{const p=g.player||{};if((name==='cover'||name==='drive'||name==='mission')&&p.onFoot&&g.cars&&g.cars.length){p.onFoot=false;p.car=g.cars[0];}if(g.screen==='title')g.screen='play';}catch(e2){}}}
