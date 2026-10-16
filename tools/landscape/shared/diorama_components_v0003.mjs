// ============================================================
// 文件名: diorama_components_v0003.mjs
// 中文名: 高细节景观构件与 PBR 材质组件
// 版本号: v0003
// 主层级: action
// 层级: landscape / assets
// 脚本定位: 可参数化的建筑、植物及家具资源库
// 职责说明: 真实立体构件、实例化枝叶和原创程序纹理。
// 本脚本做什么: 按 SceneSpec 构件参数构建几何和表面材质。
// 本脚本不做什么: 不使用参考图贴图，不硬编码整个庭院位置，不调用 AI。
// 制度边界声明: 所有资源本地；纹理为表面微细节；几何与实例资源可释放。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: diorama_components_v0003
// family: diorama_components
// role: parametric_component_library
// version: v0003
// status: active
// entry_point: frontend/local_ai_workbench/tools/landscape/shared/diorama_components_v0003.mjs
// input: SceneSpec object dimensions/material/properties
// output: detailed Object3D and owned resource list
// depends_on: Three.js, RoundedBoxGeometry, BufferGeometryUtils
// used_by: scene_engine_v0002
// ============================================================
import * as THREE from '/vendor/three.module.mjs';
import {RoundedBoxGeometry} from '/vendor/addons/geometries/RoundedBoxGeometry.mjs';
import {mergeGeometries} from '/vendor/addons/utils/BufferGeometryUtils.mjs';
const SCRIPT_NAME='diorama_components_v0003',SCRIPT_FAMILY='diorama_components',SCRIPT_VERSION='v0003',DEFAULT_ENCODING='utf8';
export function random(seed){let s=2166136261;for(const c of String(seed))s=Math.imul(s^c.charCodeAt(0),16777619);return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function surfaceTexture(type,bump=false){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),r=random(type),colors={wood:'#aa8d66',stone:'#b8b7af',concrete:'#d4d2ca',grass:'#739153',soil:'#635744',bark:'#76614a',fabric:'#e0dacb',leaf:'#789357',metal:'#999c99'};ctx.fillStyle=bump?'#808080':colors[type]||'#ffffff';ctx.fillRect(0,0,256,256);for(let i=0;i<10000;i++){const x=r()*256,y=r()*256,v=Math.floor(r()*75+85);ctx.fillStyle=bump?`rgb(${v},${v},${v})`:`rgba(${r()>.5?255:20},${r()>.5?255:35},${r()>.5?255:20},${type==='grass'?.18:.075})`;ctx.fillRect(x,y,type==='wood'?20+r()*60:1,type==='wood'?.45:1);}if(['wood','bark'].includes(type)){for(let i=0;i<90;i++){ctx.strokeStyle=bump?'#727272':'#4f3d2f26';ctx.lineWidth=.5+r();ctx.beginPath();const y=r()*256;ctx.moveTo(0,y);ctx.bezierCurveTo(80,y-4,170,y+6,256,y+2);ctx.stroke();}}const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=bump?THREE.NoColorSpace:THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
export function pbr(engine,kind,color,parameters={}){const key='pbr:'+JSON.stringify([kind,color,parameters]);return engine.geometry(key,()=>{const texture=kind!=='none'?engine.geometry('tex:'+kind,()=>surfaceTexture(kind)):null,bump=kind!=='none'&&kind!=='leaf'?engine.geometry('bump:'+kind,()=>surfaceTexture(kind,true)):null;return new THREE.MeshPhysicalMaterial({color,map:texture,bumpMap:bump,bumpScale:kind==='bark'?.025:kind==='grass'?.012:.006,roughness:parameters.roughness??(kind==='metal'?.3:kind==='fabric'?.92:.8),metalness:parameters.metalness??(kind==='metal'?.7:0),transmission:parameters.transmission??0,opacity:parameters.opacity??1,transparent:(parameters.opacity??1)<1,side:THREE.DoubleSide,clearcoat:kind==='wood'?.08:0});});}
export function materialKind(obj){return obj.material.texture||( /木|wood/i.test(obj.material.name)?'wood':/石|stone/i.test(obj.material.name)?'stone':/混凝土|concrete/i.test(obj.material.name)?'concrete':({tree:'bark',shrub:'leaf',lawn:'grass',planting:'soil',building:'concrete',road:'stone',platform:'wood',wall:'stone',bench:'wood'})[obj.type]||'none');}
function polylineCurve(points){const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>1e-8)curve.add(new THREE.LineCurve3(points[i-1],points[i]));return curve;}
export function component(engine,obj,level=0){
 const kind=obj.properties?.component||(obj.type==='road'&&obj.geometry.kind==='line'?'path':({building:'villa',tree:'tree',shrub:'shrub',bench:'bench',platform:'deck',wall:'wall',steps:'steps',light:'bollard'})[obj.type]);if(!kind||!['point','box'].includes(obj.geometry.kind)&&kind!=='path')return null;
 const group=new THREE.Group(),owned=[],r=random(obj.id),[w,d,h]=obj.size;const mat=pbr(engine,materialKind(obj),obj.material.color,obj.material),wood=pbr(engine,'wood','#c4ae8e'),metal=pbr(engine,'metal','#454c45'),fabric=pbr(engine,'fabric','#fff5e1'),stone=pbr(engine,'stone','#c7c5ba'),bark=pbr(engine,'bark','#897963');
 const box=engine.geometry('detail-box',()=>new THREE.BoxGeometry(1,1,1)),round=engine.geometry('rounded-box',()=>new RoundedBoxGeometry(1,1,1,3,.06));
 function mesh(geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=engine.mesh(geometry,material,obj.id);m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;}
 function block(x,y,z,sx,sy,sz,m=mat,rounded=false){return mesh(rounded?round:box,m,x,y,z,sx,sy,sz);}
 function branch(a,b,radius,material=bark){const distance=a.distanceTo(b),g=new THREE.CylinderGeometry(radius*.55,radius,distance,7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;}
 if(kind==='villa'){
  block(0,.08,0,w,.16,d,stone);block(0,h-.15,0,w+.25,.3,d+.25,mat);block(0,h/2,-d/2+.12,w,h,.24,mat);for(const x of [-w/2+.12,w/2-.12])block(x,h/2,0,.24,h,d,mat);
  const n=Math.max(3,Math.round(w/2.5)),pane=(w-.5)/n,glass=pbr(engine,'none','#a5bfb1',{roughness:.12,transmission:.12,opacity:.28});
  for(let i=0;i<=n;i++)block(-w/2+.25+i*pane,h/2,d/2-.02,.065,h-.3,.08,metal);for(let i=0;i<n;i++)block(-w/2+.25+(i+.5)*pane,h/2,d/2-.03,pane-.065,h-.42,.025,glass);
  block(0,.25,d/2,w-.5,.08,.08,metal);block(0,h-.27,d/2,w-.5,.08,.08,metal);
  const ceiling=pbr(engine,'none','#f7dfb0');ceiling.emissive.set('#e8b55a');ceiling.emissiveIntensity=.45;for(let i=0;i<3;i++){const x=(i-1)*w*.27;block(x,.45,0,Math.min(2,w*.15),.7,.85,fabric,true);const light=new THREE.PointLight('#ffd395',6,8,2);light.position.set(x,h*.8,0);group.add(light);block(x,h-.33,0,.16,.05,.16,ceiling);}
  // Roof joints, side wall reveals and front paving are real geometry.
  for(let x=-w/2;x<w/2;x+=.65)block(x,h+.006,0,.014,.008,d+.25,stone);for(let z=-d/2;z<d/2;z+=.6)block(0,h+.01,z,w+.25,.008,.012,stone);
 }else if(kind==='deck'){
  block(0,h/2,0,w,h,d,mat);const woodDeck=materialKind(obj)==='wood';if(woodDeck){for(let z=-d/2+.1;z<d/2;z+=.19)block(0,h+.012,z,w-.04,.024,.178,mat);}else{for(let x=-w/2+.31;x<w/2;x+=.62)for(let z=-d/2+.31;z<d/2;z+=.62)block(x,h+.014,z,.6,.028,.6,mat);}
 }else if(kind==='wall'||kind==='planter'||kind==='gate'){
  if(kind==='gate'){for(let x=-w/2;x<=w/2;x+=.105)block(x,h/2,0,.055,h,.06,wood);for(const y of [.2,h-.2])block(0,y,0,w,.05,.055,metal);block(w*.25,h*.55,.05,.03,.2,.03,metal);}else{block(0,h/2,0,w,h,d,mat);block(0,h+.035,0,w+.05,.07,d+.06,stone);for(let y=.2;y<h;y+=.23)block(0,y,d/2+.005,w,.009,.014,stone);}
 }else if(kind==='sofa'||kind==='armchair'||kind==='bench'){
  block(0,.25,0,w*.95,.14,d*.9,wood);for(const x of [-w*.38,w*.38])for(const z of [-d*.32,d*.32])block(x,.15,z,.06,.3,.06,metal);
  const cushions=kind==='sofa'?3:1;for(let i=0;i<cushions;i++)block((i-(cushions-1)/2)*w/cushions,.49,0,w/cushions*.9,.22,d*.72,fabric,true);
  block(0,.77,-d*.36,w,.48,.15,fabric,true);for(const x of [-w*.48,w*.48])block(x,.61,0,.13,.37,d,wood,true);
  if(kind!=='bench')for(const x of [-w*.31,w*.31]){const cushion=block(x,.72,-d*.16,.32,.35,.13,pbr(engine,'fabric',x<0?'#c2b89b':'#9da68e'),true);cushion.rotation.z=x<0?.12:-.1;}
 }else if(kind==='table'){
  block(0,h-.05,0,w,.1,d,wood,true);for(const x of [-w*.35,w*.35])for(const z of [-d*.35,d*.35])block(x,h/2,z,.055,h-.1,.055,metal);mesh(engine.geometry('cup',()=>new THREE.CylinderGeometry(.045,.035,.075,12)),fabric,w*.15,h+.038,0);mesh(engine.geometry('vase',()=>new THREE.CylinderGeometry(.06,.045,.15,12)),pbr(engine,'none','#bcbea0'),-w*.22,h+.075,0);
 }else if(kind==='umbrella'){
  mesh(engine.geometry('pole',()=>new THREE.CylinderGeometry(.025,.035,1,10)),metal,0,h/2,0,1,h,1);mesh(engine.geometry('umbrella-foot',()=>new THREE.CylinderGeometry(.25,.32,.06,16)),stone,0,.03,0);
  const geometry=new THREE.BufferGeometry(),vertices=[],normals=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;vertices.push(0,h,0,w/2*Math.cos(a),h-.36,d/2*Math.sin(a),w/2*Math.cos(b),h-.36,d/2*Math.sin(b));const g=branch(new THREE.Vector3(0,h-.015,0),new THREE.Vector3(w/2*Math.cos(a),h-.37,d/2*Math.sin(a)),.012,metal);owned.push(g);mesh(g,metal);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();owned.push(geometry);mesh(geometry,fabric);
 }else if(kind==='boulder'){
  const m=mesh(engine.geometry('rock',()=>new THREE.DodecahedronGeometry(1,1)),stone,0,h*.4,0,w/2,h/2,d/2);m.rotation.set(.2+r()*.5,r()*3,.1+r()*.2);
 }else if(kind==='bollard'){
  block(0,h*.4,0,w,h*.8,d,metal,true);const glow=pbr(engine,'none','#ffe7b6');glow.emissive.set('#ffc36f');glow.emissiveIntensity=1.1;block(0,h*.83,0,w*.82,h*.16,d*.82,glow);block(0,h-.025,0,w+.02,.05,d+.02,metal);
 }else if(kind==='tree'){
  const branches=[branch(new THREE.Vector3(0,0,0),new THREE.Vector3(.05,h*.58,.03),Math.max(.05,w*.065))];for(let i=0;i<11;i++){const a=i*2.399,endpoint=new THREE.Vector3(Math.cos(a)*w*.36,(.5+r()*.25)*h,Math.sin(a)*d*.36);branches.push(branch(new THREE.Vector3(.03,h*(.25+i*.025),0),endpoint,w*.018));for(let j=0;j<2;j++)branches.push(branch(endpoint.clone().multiplyScalar(.8),endpoint.clone().add(new THREE.Vector3((r()-.5)*w*.4,h*.14,(r()-.5)*d*.4)),w*.007));}
  const merged=mergeGeometries(branches);branches.forEach(g=>g.dispose());owned.push(merged);mesh(merged,bark);
  const leafGeometry=engine.geometry('true-leaf',()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,-.23,.02,0,0,.08,0,.23,.02,0,0,0,.5],3));g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();return g;});
  const detail=new THREE.Group(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),colors=obj.overrides?.material?[obj.material.color,obj.material.color,obj.material.color]:obj.properties?.leaf_colors||['#7a9558','#597944','#9baa68'];
  for(let c=0;c<3;c++){const count=level===0?Math.min(2000,Math.max(450,Math.round(w*d*120))):Math.min(600,Math.max(160,Math.round(w*d*32))),leaves=new THREE.InstancedMesh(leafGeometry,pbr(engine,'leaf',colors[c]),count);leaves.userData.id=obj.id;leaves.castShadow=true;leaves.receiveShadow=true;for(let i=0;i<count;i++){const a=r()*Math.PI*2,t=r()*2-1,radius=Math.pow(r(),.3);const lobe=i%11,az=lobe*2.399,centerX=Math.cos(az)*w*.22,centerZ=Math.sin(az)*d*.22;pos.set(centerX+Math.cos(a)*Math.sqrt(1-t*t)*radius*w*.23,h*(.62+.08*Math.sin(az))+t*radius*h*.22,centerZ+Math.sin(a)*Math.sqrt(1-t*t)*radius*d*.23);quat.setFromEuler(new THREE.Euler(r()*6.28,r()*6.28,r()*6.28));const length=.18+r()*.16;scale.set(length,length,length);matrix.compose(pos,quat,scale);leaves.setMatrixAt(i,matrix);}leaves.computeBoundingSphere();detail.add(leaves);owned.push(leaves);}
  group.add(detail);
 }else if(['shrub','grass','flowers','groundcover'].includes(kind)){
  const count=kind==='grass'?55:kind==='flowers'?80:220,geo=engine.geometry(kind==='grass'?'blade':'plant-leaf',()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,.02,.65,.04,0,1,.13,-.02,.65,.04],3));g.setIndex([0,1,2,0,2,4,4,2,3]);g.computeVertexNormals();return g;}),leaves=new THREE.InstancedMesh(geo,pbr(engine,'leaf',obj.material.color),count),matrix=new THREE.Matrix4();leaves.userData.id=obj.id;leaves.castShadow=true;for(let i=0;i<count;i++){const a=r()*6.28,radius=Math.sqrt(r()),pos=new THREE.Vector3(Math.cos(a)*radius*w*.4,0,Math.sin(a)*radius*d*.4),scale=new THREE.Vector3(1+r(),h*(.45+r()*.55),1+r()),quat=new THREE.Quaternion().setFromEuler(new THREE.Euler((r()-.5)*.8,a,(r()-.5)*.5));if(kind==='shrub'||kind==='groundcover'){pos.y=h*(.25+r()*.65);scale.set(2.5+r()*2,h*.65,2.5+r()*2);quat.setFromEuler(new THREE.Euler(r()*3.14,a,r()*3.14));}matrix.compose(pos,quat,scale);leaves.setMatrixAt(i,matrix);}leaves.computeBoundingSphere();group.add(leaves);owned.push(leaves);
  if(kind==='flowers'){const bloom=new THREE.InstancedMesh(engine.geometry('blossom',()=>{const parts=[];for(let j=0;j<7;j++){const petal=new THREE.SphereGeometry(.034,6,4);petal.scale(1.6,.28,1);petal.translate(Math.cos(j*6.28/7)*.036,0,Math.sin(j*6.28/7)*.036);parts.push(petal);}const flower=mergeGeometries(parts);parts.forEach(p=>p.dispose());return flower;}),pbr(engine,'none',obj.properties?.flower_color||'#9d7db1'),40);bloom.userData.id=obj.id;bloom.castShadow=true;for(let i=0;i<40;i++){matrix.compose(new THREE.Vector3((r()-.5)*w*.6,h*(.6+r()*.3),(r()-.5)*d*.6),new THREE.Quaternion(),new THREE.Vector3(1.2,1,1.2));bloom.setMatrixAt(i,matrix);}bloom.computeBoundingSphere();group.add(bloom);owned.push(bloom);}
 }else if(kind==='path'){
  const points=obj.geometry.coordinates.map(p=>new THREE.Vector3(p[0]-obj.geometry.coordinates[0][0],p[2]-obj.geometry.coordinates[0][2],-(p[1]-obj.geometry.coordinates[0][1]))),curve=obj.properties?.curve==='polyline'?polylineCurve(points):new THREE.CatmullRomCurve3(points,false,'centripetal'),length=curve.getLength(),count=Math.min(400,Math.ceil(length/.42));
  for(let i=0;i<count;i++){const t=(i+.5)/count,pos=curve.getPointAt(t),tangent=curve.getTangentAt(t),angle=Math.atan2(tangent.x,tangent.z);for(let j=0;j<2;j++){const tile=block(pos.x+Math.cos(angle)*(j-.5)*w/2,pos.y+h/2,pos.z-Math.sin(angle)*(j-.5)*w/2,w/2-.015,h,length/count-.02,mat);tile.rotation.y=angle;}}
 }else return null;
 // Merge only rigid meshes belonging to this one source object. Geometry detail and picking ID remain intact.
 const rigid=new Map();for(const child of [...group.children])if(child.isMesh&&!child.isInstancedMesh&&!Array.isArray(child.material)){const key=child.material.uuid+':'+Boolean(child.geometry.index)+':'+Object.keys(child.geometry.attributes).sort().map(k=>{const a=child.geometry.attributes[k];return k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name;}).join('|');if(!rigid.has(key))rigid.set(key,[]);rigid.get(key).push(child);}for(const meshes of rigid.values())if(meshes.length>1){const pieces=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);}),geometry=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());if(geometry){owned.push(geometry);for(const old of meshes)group.remove(old);mesh(geometry,meshes[0].material);}}
 if(['tree','shrub','grass','flowers','groundcover'].includes(kind)){const content=new THREE.Group();for(const child of [...group.children])content.add(child);group.add(content);const box=new THREE.Box3().setFromObject(content),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());content.scale.set(w/(size.x||1),h/(size.y||1),d/(size.z||1));content.position.set(-center.x*content.scale.x,-box.min.y*content.scale.y,-center.z*content.scale.z);}
 if(kind==='path')group.position.copy(engine.position(obj.geometry.coordinates[0]).add(new THREE.Vector3(obj.position[0],obj.position[2],-obj.position[1])));else group.position.copy(engine.position(obj.position));group.rotation.y=THREE.MathUtils.degToRad(obj.rotation);
 return {group,owned,fingerprint:engine.fingerprint(obj)};
}
