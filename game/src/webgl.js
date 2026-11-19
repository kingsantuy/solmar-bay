export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function mul(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
export const transl=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
export const scal=(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
export function rotX(a){const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]}
export function rotY(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]}
export function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]}
export function persp(f,a,n,fa){const t=1/Math.tan(f/2);return[t/a,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]}
export function lookAt(e,t,u){const z=vn([e[0]-t[0],e[1]-t[1],e[2]-t[2]]);const x=vn(vc(u,z)),y=vc(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vd(x,e),-vd(y,e),-vd(z,e),1]}
export function ortho(l,r,b,t,n,f){return[2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]}
export const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const vsc=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const vd=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const vc=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const vl=a=>Math.hypot(a[0],a[1],a[2]);
export const vn=a=>{const l=vl(a)||1;return[a[0]/l,a[1]/l,a[2]/l]};
export function xform(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
export function clip(m,x,y,z){return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]]}
export function norm3(m){const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],g=m[2],h=m[6],i=m[10];const A=e*i-f*h,B=c*h-b*i,C=b*f-c*e,D=f*g-d*i,E=a*i-c*g,F=c*d-a*f,G=d*h-e*g,H=b*g-a*h,J=a*e-b*d;const det=a*A+b*D+c*G||1;const s=1/det;return new Float32Array([A*s,B*s,C*s,D*s,E*s,F*s,G*s,H*s,J*s])}
export function ctx(cv){const gl=cv.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});if(!gl)throw new Error('no webgl2');return gl}
function sh(gl,t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
export function prog(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
export function mesh(gl,g){const v=gl.createVertexArray();gl.bindVertexArray(v);const nb=(a,loc,sz)=>{if(!a||!a.length)return;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,0,0)};nb(g.p,0,3);nb(g.n,1,3);nb(g.c,2,4);nb(g.u,3,2);let n=g.p.length/3,idx=0;if(g.i&&g.i.length){let mx=0;for(const k of g.i)if(k>mx)mx=k;const b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);if(mx>65535){gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(g.i),gl.STATIC_DRAW);idx=2}else{gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(g.i),gl.STATIC_DRAW);idx=1}n=g.i.length}gl.bindVertexArray(null);return{v,n,idx}}
export function meshI(gl,g,mats,cols){const m=mesh(gl,g);gl.bindVertexArray(m.v);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mats),gl.STATIC_DRAW);for(let k=0;k<4;k++){gl.enableVertexAttribArray(4+k);gl.vertexAttribPointer(4+k,4,gl.FLOAT,false,64,k*16);gl.vertexAttribDivisor(4+k,1)}if(cols&&cols.length){const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cols),gl.STATIC_DRAW);gl.enableVertexAttribArray(8);gl.vertexAttribPointer(8,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(8,1);m.col=true}gl.bindVertexArray(null);m.inst=mats.length/16;return m}
export function tex(gl,c){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);return t}
export function cv(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c}
export function resize(gl,canvas){const d=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,Math.round(canvas.clientWidth*d)),h=Math.max(1,Math.round(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);return true}return false}
