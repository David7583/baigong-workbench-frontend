// ============================================================
// 文件名: scene_engine_v0002.mjs
// 中文名: 共享等轴测微缩景观引擎
// 版本号: v0002
// 主层级: action
// 层级: landscape / renderer
// 脚本定位: SceneSpec 的可释放三维表达
// 职责说明: 正交相机、增量对象、实例植被和交互拾取。
// 本脚本做什么: 消费结构化场景；只在交互或数据变化时渲染。
// 本脚本不做什么: 不调用 AI，不写业务库，不改动原始坐标。
// 制度边界声明: 渲染减去 origin，持久化仍保留双精度坐标；丢失上下文明确显示恢复入口。
// 可更新: True
// ============================================================
// ALIAS_META
// alias: scene_engine_v0002
// family: scene_engine
// role: shared_scene_renderer
// version: v0002
// status: active
// entry_point: frontend/local_ai_workbench/tools/landscape/shared/scene_engine_v0002.mjs
// input: landscape.scene.v1 and selection callbacks
// output: interactive WebGL view and resource diagnostics
// depends_on: Three.js, OrbitControls
// used_by: scene_editor_v0002
// ============================================================
import * as THREE from '/vendor/three.module.mjs';
import {OrbitControls} from '/vendor/OrbitControls.mjs';
import {EffectComposer} from '/vendor/addons/postprocessing/EffectComposer.mjs';
import {RenderPass} from '/vendor/addons/postprocessing/RenderPass.mjs';
import {SSAOPass} from '/vendor/addons/postprocessing/SSAOPass.mjs';
import {OutputPass} from '/vendor/addons/postprocessing/OutputPass.mjs';
import {RoomEnvironment} from '/vendor/addons/environments/RoomEnvironment.mjs';
import {component,pbr,materialKind} from './diorama_components_v0002.mjs';
import {AssetLibrary} from './landscape_assets_v0001.mjs';
const SCRIPT_NAME='scene_engine_v0002',SCRIPT_FAMILY='scene_engine',SCRIPT_VERSION='v0002',DEFAULT_ENCODING='utf8';
export class SceneEngine{
 constructor(host,{onSelect=()=>{},onStatus=()=>{},assetCatalog=null}={}){
  this.host=host;this.onSelect=onSelect;this.onStatus=onStatus;this.objects=new Map();this.batches=new Map();this.caches=new Map();this.assets=new AssetLibrary(assetCatalog);this.assetGeneration=0;this.frame=0;this.disposed=false;this.origin=[0,0,0];this.spec=null;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8e7df');this.scene.add(new THREE.HemisphereLight('#fff8ea','#899185',.95));
  const light=new THREE.DirectionalLight('#fff4df',2.6);light.position.set(40,70,30);light.castShadow=true;light.shadow.mapSize.set(1024,1024);this.scene.add(light);this.light=light;
  this.camera=new THREE.OrthographicCamera(-25,25,25,-25,.05,1000000);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.canvas=this.renderer.domElement;host.replaceChildren(this.canvas);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=false;this.controls.minPolarAngle=.08;this.controls.maxPolarAngle=Math.PI/2-.02;this.controls.addEventListener('change',this.changed=()=>this.render());
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.light.shadow.mapSize.set(2048,2048);this.light.shadow.bias=-.0002;this.light.shadow.normalBias=.015;this.scene.add(this.light.target);
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environmentTarget=pmrem.fromScene(environment,.04);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  this.composer=new EffectComposer(this.renderer);this.renderPass=new RenderPass(this.scene,this.camera);this.ao=new SSAOPass(this.scene,this.camera,512,512);this.ao.kernelRadius=.35;this.ao.minDistance=.001;this.ao.maxDistance=.12;this.outputPass=new OutputPass();this.composer.addPass(this.renderPass);this.composer.addPass(this.ao);this.composer.addPass(this.outputPass);
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.canvas.addEventListener('pointerdown',this.down=e=>{this.downPoint=[e.clientX,e.clientY];});this.canvas.addEventListener('pointerup',this.up=e=>{if(!this.downPoint||Math.hypot(e.clientX-this.downPoint[0],e.clientY-this.downPoint[1])>5)return;const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects([...this.objects.values()].map(x=>x.group).concat([...this.batches.values()].map(x=>x.group)),true);for(const hit of hits){let shown=true;for(let node=hit.object;node;node=node.parent)if(!node.visible){shown=false;break;}if(!shown)continue;const id=hit.object.userData.ids?.[hit.instanceId]||hit.object.userData.id;if(id){this.onSelect(id);break;}}});
  this.canvas.addEventListener('webglcontextlost',this.lost=e=>{e.preventDefault();this.contextLost=true;this.onStatus('WebGL 上下文丢失；数据已保留，请点击恢复三维');});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.visibility=()=>{if(!document.hidden)this.render();};document.addEventListener('visibilitychange',this.visibility);this.resize();this.fit();
 }
 geometry(key,factory){if(!this.caches.has(key))this.caches.set(key,factory());return this.caches.get(key);}
 material(obj){return pbr(this,materialKind(obj),obj.material.color,obj.material);}
 fingerprint(obj){return JSON.stringify([obj.type,obj.position,obj.size,obj.rotation,obj.geometry,obj.material,obj.properties,this.assets.models.has(this.assets.id(obj))?this.assets.id(obj):null]);}
 position(p){return new THREE.Vector3(p[0]-this.origin[0],p[2]-this.origin[2],-(p[1]-this.origin[1]));}
 mesh(geometry,material,id){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.id=id;return mesh;}
 build(obj){
  const asset=['point','box'].includes(obj.geometry.kind)?this.assets.instance(this,obj):null;if(asset)return asset;const detailed=component(this,obj);if(detailed)return detailed;
  const group=new THREE.Group(),g=obj.geometry,mat=this.material(obj),[w,d,h]=obj.size;let owned=[];
  if(g.kind==='point'||g.kind==='box'){
   if(obj.type==='tree'||obj.type==='shrub'){
    const trunk=this.mesh(this.geometry('trunk',()=>new THREE.CylinderGeometry(.08,.12,.65,6)),this.geometry('bark',()=>new THREE.MeshStandardMaterial({color:'#89735c',roughness:1})),obj.id);trunk.position.y=h*.3;trunk.scale.set(w,h/1.1,d);group.add(trunk);
    const crown=this.mesh(this.geometry('crown',()=>new THREE.IcosahedronGeometry(1,0)),mat,obj.id);crown.scale.set(w/2,h*.4,d/2);crown.position.y=h*.65;group.add(crown);
   }else if(obj.type==='bench'){
    const seat=this.mesh(this.geometry('unit-box',()=>new THREE.BoxGeometry(1,1,1)),mat,obj.id);seat.scale.set(w,h*.15,d);seat.position.y=h*.8;group.add(seat);for(const x of [-.35,.35]){const leg=this.mesh(this.geometry('unit-box',()=>new THREE.BoxGeometry(1,1,1)),mat,obj.id);leg.scale.set(w*.1,h*.7,d*.6);leg.position.set(x*w,h*.35,0);group.add(leg);}
   }else if(obj.type==='steps'){
    for(let i=0;i<5;i++){const stair=this.mesh(this.geometry('unit-box',()=>new THREE.BoxGeometry(1,1,1)),mat,obj.id);stair.scale.set(w,h*(i+1)/5,d/5);stair.position.set(0,h*(i+1)/10,(i-2)*d/5);group.add(stair);}
   }else{const mesh=this.mesh(this.geometry('unit-box',()=>new THREE.BoxGeometry(1,1,1)),mat,obj.id);mesh.scale.set(w,h,d);mesh.position.y=h/2;group.add(mesh);}
   group.position.copy(this.position(obj.position));group.rotation.y=THREE.MathUtils.degToRad(obj.rotation);
  }else if(g.kind==='polygon'){
   const rings=g.coordinates;const first=rings[0][0];const shape=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(p[0]-first[0],p[1]-first[1])));for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p[0]-first[0],p[1]-first[1]))));
   let geometry,mesh;if(obj.type==='terrain'){const contours=rings.map(r=>r.slice(0,-1)),vertices=contours.flat();const faces=THREE.ShapeUtils.triangulateShape(contours[0].map(p=>new THREE.Vector2(p[0],p[1])),contours.slice(1).map(r=>r.map(p=>new THREE.Vector2(p[0],p[1]))));geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>[p[0]-first[0],p[2]-first[2],-(p[1]-first[1])]),3));geometry.setIndex(faces.flat());geometry.computeVertexNormals();mesh=this.mesh(geometry,mat,obj.id);}else{geometry=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});mesh=this.mesh(geometry,mat,obj.id);mesh.rotation.x=-Math.PI/2;}owned.push(geometry);group.add(mesh);group.position.copy(this.position(first).add(new THREE.Vector3(obj.position[0],obj.position[2],-obj.position[1])));group.rotation.y=THREE.MathUtils.degToRad(obj.rotation);
  }else if(g.kind==='line'){
   const p=g.coordinates[0];const points=g.coordinates.map(v=>new THREE.Vector3(v[0]-p[0],v[2]-p[2],-(v[1]-p[1])));const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>1e-8)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
   if(curve.curves.length){const geometry=new THREE.TubeGeometry(curve,Math.min(2000,points.length*4),Math.max(.025,w/2),5,false);owned.push(geometry);group.add(this.mesh(geometry,mat,obj.id));}group.position.copy(this.position(p).add(new THREE.Vector3(obj.position[0],obj.position[2],-obj.position[1])));group.rotation.y=THREE.MathUtils.degToRad(obj.rotation);
  }else if(g.kind==='mesh'){
   const first=g.coordinates[0]||[0,0,0],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.coordinates.flatMap(p=>[p[0]-first[0],p[2]-first[2],-(p[1]-first[1])]),3));geometry.setIndex(g.faces.flat());geometry.computeVertexNormals();owned.push(geometry);group.add(this.mesh(geometry,mat,obj.id));group.position.copy(this.position(first).add(new THREE.Vector3(obj.position[0],obj.position[2],-obj.position[1])));
  }
  return {group,owned,fingerprint:this.fingerprint(obj)};
 }
 setScene(spec,{fit=false,assetsReady=false}={}){
  if(!assetsReady){const generation=++this.assetGeneration;this.assets.prepare(spec.objects).then(()=>{if(!this.disposed&&generation===this.assetGeneration&&this.spec===spec)this.setScene(spec,{fit,assetsReady:true});}).catch(error=>{if(!this.disposed&&generation===this.assetGeneration)this.onStatus('精细资产加载失败；当前保留程序构件：'+error.message);});}
  this.renderer.shadowMap.needsUpdate=true;
  const originChanged=JSON.stringify(this.origin)!==JSON.stringify(spec.origin);this.origin=spec.origin;this.spec=spec;
  const visible=new Set(spec.layers.filter(x=>x.visible).map(x=>x.id));const batchable=spec.objects.filter(o=>['tree','shrub'].includes(o.type)&&['point','box'].includes(o.geometry.kind));const batched=batchable.length>=200?batchable:[];const batchIds=new Set(batched.map(o=>o.id));
  const desired=new Map(spec.objects.filter(o=>!batchIds.has(o.id)).map(o=>[o.id,o]));for(const [id,item] of this.objects)if(!desired.has(id)||originChanged||item.fingerprint!==this.fingerprint(desired.get(id))){this.scene.remove(item.group);item.owned.forEach(g=>g.dispose());this.objects.delete(id);}
  for(const [id,obj] of desired){if(!this.objects.has(id)){const item=this.build(obj);this.scene.add(item.group);this.objects.set(id,item);}this.objects.get(id).group.visible=visible.has(obj.layer);}
  const groups=new Map();for(const obj of batched){const key=obj.layer+':'+obj.material.color;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(obj);}
  for(const [key,item] of this.batches)if(!groups.has(key)||item.count!==groups.get(key).length){this.scene.remove(item.group);item.group.children.forEach(m=>m.dispose());this.batches.delete(key);}
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const [key,items] of groups){let batch=this.batches.get(key);if(!batch){const group=new THREE.Group(),crown=new THREE.InstancedMesh(this.geometry('crown',()=>new THREE.IcosahedronGeometry(1,0)),this.material(items[0]),items.length),trunk=new THREE.InstancedMesh(this.geometry('trunk',()=>new THREE.CylinderGeometry(.08,.12,.65,6)),this.geometry('bark',()=>new THREE.MeshStandardMaterial({color:'#89735c',roughness:1})),items.length);group.add(crown,trunk);this.scene.add(group);batch={group,count:items.length};this.batches.set(key,batch);}
   batch.group.visible=visible.has(items[0].layer);for(const [j,mesh] of batch.group.children.entries()){mesh.userData.ids=items.map(o=>o.id);mesh.castShadow=true;mesh.receiveShadow=true;items.forEach((obj,i)=>{const [w,d,h]=obj.size,p=this.position(obj.position);p.y+=j===0?h*.65:h*.3;scale.set(j===0?w/2:w,j===0?h*.4:h/1.1,j===0?d/2:d);matrix.compose(p,q,scale);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  this.quality=spec.objects.length<1000;this.renderer.toneMappingExposure=spec.metadata?.render?.exposure??1.1;this.scene.background.set(spec.metadata?.render?.background||'#e8e7df');if(originChanged||fit)this.fit();this.highlight(this.selected);this.render();this.onStatus(`${spec.objects.length} 个对象 · ${batched.length} 个批量植被 · ${this.quality?'PBR + SSAO':'实例性能模式'}`);
 }
 highlight(id){this.selected=id;if(this.outline){this.scene.remove(this.outline);this.outline.geometry.dispose();this.outline.material.dispose();this.outline=null;}if(!id)return;const obj=this.spec?.objects.find(o=>o.id===id);if(!obj)return;let box;if(this.objects.has(id))box=new THREE.Box3().setFromObject(this.objects.get(id).group);else{const p=this.position(obj.position);box=new THREE.Box3(new THREE.Vector3(p.x-obj.size[0]/2,p.y,p.z-obj.size[1]/2),new THREE.Vector3(p.x+obj.size[0]/2,p.y+obj.size[2],p.z+obj.size[1]/2));}this.outline=new THREE.Box3Helper(box,'#e7a35c');this.scene.add(this.outline);this.render();}
 fit(){this.renderer.shadowMap.needsUpdate=true;const box=new THREE.Box3();for(const item of [...this.objects.values(),...this.batches.values()])if(item.group.visible)box.union(new THREE.Box3().setFromObject(item.group));if(box.isEmpty())box.set(new THREE.Vector3(-10,0,-10),new THREE.Vector3(10,1,10));const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(size.length(),5);this.radius=radius;this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(radius,radius,radius));this.camera.far=radius*30+100;this.camera.zoom=1;this.controls.minZoom=.1;this.controls.maxZoom=100;this.controls.maxDistance=radius*20;this.camera.updateProjectionMatrix();this.controls.update();this.resize();const extent=radius*.7;Object.assign(this.light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,far:radius*10+100});this.light.shadow.camera.updateProjectionMatrix();this.light.position.copy(center).add(new THREE.Vector3(radius,radius*2,radius));this.light.target.position.copy(center);this.render();}
 resize(){if(this.disposed)return;const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight),r=(this.radius||40)*.44;this.camera.left=-r*width/height;this.camera.right=r*width/height;this.camera.top=r;this.camera.bottom=-r;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.composer?.setSize(width,height);this.render();}
 render(){if(this.disposed||this.contextLost||this.frame||document.hidden)return;this.frame=requestAnimationFrame(()=>{this.frame=0;if(!this.disposed&&!this.contextLost){const start=performance.now();this.renderer.info.autoReset=false;this.renderer.info.reset();if(this.quality)this.composer.render();else this.renderer.render(this.scene,this.camera);this.lastFrameMs=performance.now()-start;}});}
 direction(view){const center=this.controls.target.clone(),r=this.radius||40;this.camera.position.copy(center).add(view==='top'?new THREE.Vector3(0,r*2,.001):view==='front'?new THREE.Vector3(0,r*.25,r*2):view==='side'?new THREE.Vector3(r*2,r*.25,0):new THREE.Vector3(r,r,r));this.controls.update();this.render();}
 orbit(degrees){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),degrees*Math.PI/180);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.render();}
 focus(id){const item=this.objects.get(id);if(!item)return;const box=new THREE.Box3().setFromObject(item.group),center=box.getCenter(new THREE.Vector3()),delta=this.camera.position.clone().sub(this.controls.target);this.controls.target.copy(center);this.camera.position.copy(center).add(delta);this.camera.zoom=Math.min(20,Math.max(1,(this.radius||40)/Math.max(box.getSize(new THREE.Vector3()).length(),1)*.5));this.camera.updateProjectionMatrix();this.controls.update();}
 setGrid(enabled){if(this.grid){this.scene.remove(this.grid);this.grid.geometry.dispose();this.grid.material.dispose();this.grid=null;}if(enabled){this.grid=new THREE.GridHelper(Math.max(20,this.radius||40),20,'#9ea698','#c5c9bd');this.scene.add(this.grid);}this.render();}
 setBackground(color){this.scene.background.set(color);this.render();}
 screenshot(){if(this.quality)this.composer.render();else this.renderer.render(this.scene,this.camera);return this.canvas.toDataURL('image/png');}
 diagnostics(){return {...this.renderer.info.memory,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,contexts:1,assetsLoaded:this.assets.models.size,assetInstances:[...this.objects.values()].filter(x=>x.asset).length,assetErrors:Object.fromEntries(this.assets.errors),sceneId:this.spec?.id,revision:this.spec?.revision,objects:this.objects.size,instanceBatches:this.batches.size,cameraPosition:this.camera.position.toArray(),cameraZoom:this.camera.zoom,lastFrameMs:this.lastFrameMs,quality:this.quality};}
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.removeEventListener('change',this.changed);this.controls.dispose();document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('webglcontextlost',this.lost);for(const item of this.objects.values())item.owned.forEach(g=>g.dispose());for(const item of this.batches.values())item.group.children.forEach(m=>m.dispose());for(const item of this.caches.values())item.dispose();if(this.outline){this.outline.geometry.dispose();this.outline.material.dispose();}if(this.grid){this.grid.geometry.dispose();this.grid.material.dispose();}this.ao.dispose();this.outputPass.dispose();this.renderPass.dispose();this.composer.dispose();this.environmentTarget.dispose();this.assets.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();this.objects.clear();this.batches.clear();this.caches.clear();}
}
